const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/engine/decision.js');

// Ratings from the team's slide 6 (judgements on a 1-5 scale).
const criteria = [
  { id: 'des', name: 'Desirability', weight: 30 },
  { id: 'fea', name: 'Feasibility', weight: 20 },
  { id: 'via', name: 'Viability', weight: 20 },
  { id: 'imp', name: 'Impact', weight: 20 },
  { id: 'nov', name: 'Novelty', weight: 10 }
];
const alts = [
  { id: 'C1', name: 'CycleSync AI' }, { id: 'C2', name: 'NutriBalance' }, { id: 'C3', name: 'PCOS Risk Radar' },
  { id: 'C4', name: 'Hormone Harmony' }, { id: 'C5', name: 'Clinician Insight Dashboard' }
];
const raw = {
  C1: [4.7, 4.2, 4.3, 4.8, 4.0], C2: [4.0, 4.0, 3.9, 4.1, 3.6], C3: [4.2, 3.8, 3.7, 4.3, 4.1],
  C4: [3.8, 3.9, 3.6, 4.0, 3.8], C5: [3.9, 3.6, 4.0, 4.1, 3.5]
};
const ratings = {};
Object.keys(raw).forEach((k) => { ratings[k] = {}; criteria.forEach((c, i) => { ratings[k][c.id] = { value: raw[k][i] }; }); });

test('weighted decision matrix reproduces the hand calculation', () => {
  const r = D.wdm(alts, criteria, ratings);
  const by = Object.fromEntries(r.map((x) => [x.id, Number(x.total.toFixed(2))]));
  assert.deepEqual(by, { C1: 4.47, C2: 3.96, C3: 4.03, C4: 3.82, C5: 3.86 });
  assert.deepEqual(r.map((x) => x.id), ['C1', 'C3', 'C2', 'C5', 'C4']);
  assert.equal(r[0].rank, 1);
});

test('the course exemplar (healthcare triage) gives 390 / 425 / 370', () => {
  const crit = [{ id: 'i', weight: 30 }, { id: 'f', weight: 25 }, { id: 'c', weight: 15 }, { id: 'u', weight: 15 }, { id: 's', weight: 15 }];
  const a = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const rt = { A: { i: 5, f: 3, c: 4, u: 4, s: 3 }, B: { i: 4, f: 5, c: 3, u: 5, s: 4 }, C: { i: 3, f: 4, c: 5, u: 3, s: 4 } };
  const r = D.wdm(a, crit, rt);
  assert.deepEqual(r.map((x) => Math.round(x.total * 100)), [425, 390, 370]);
});

test('reweight keeps weights summing to one', () => {
  const w = D.reweight([0.3, 0.2, 0.2, 0.2, 0.1], 0, 0.6);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(w[0], 0.6);
  assert.ok(Math.abs(w[1] / w[4] - 2) < 1e-9);
});

test('sensitivity reports no flip when one option dominates every criterion', () => {
  const s = D.sensitivity(alts.slice(0, 2), criteria, ratings);
  assert.ok(s.every((x) => x.flip === null));
});

test('sensitivity finds the flip point when options trade off', () => {
  const a = [{ id: 'X' }, { id: 'Y' }];
  const crit = [{ id: 'p', weight: 50 }, { id: 'q', weight: 50 }];
  const rt = { X: { p: 5, q: 2 }, Y: { p: 3, q: 4.5 } };
  const s = D.sensitivity(a, crit, rt);
  // At 50/50: X = 3.5, Y = 3.75, so Y wins. X overtakes once the weight on p exceeds 2.5/4.5 = 0.556.
  assert.equal(D.wdm(a, crit, rt)[0].id, 'Y');
  assert.ok(s[0].flip && Math.abs(s[0].flip.at - 0.56) < 0.01, JSON.stringify(s[0]));
  assert.equal(s[0].flip.newWinner, 'X');
});

test('monte carlo is reproducible and win rates sum to 1', () => {
  const a = D.monteCarlo(alts, criteria, ratings, { runs: 500, seed: 7 });
  const b = D.monteCarlo(alts, criteria, ratings, { runs: 500, seed: 7 });
  assert.deepEqual(a, b);
  assert.ok(Math.abs(a.reduce((s, x) => s + x.winRate, 0) - 1) < 1e-9);
  assert.equal(a[0].id, 'C1');
});
