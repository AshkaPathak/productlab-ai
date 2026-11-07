const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/engine/experiment.js');

test('CSV round-trips quotes, commas and newlines', () => {
  const rows = [{ a: 'x, y', b: 'he said "hi"', c: 'line1\nline2' }];
  assert.deepEqual(X.parseCSV(X.toCSV(rows)), rows);
});

test('ranks average ties', () => {
  assert.deepEqual(X.ranks([3, 1, 3, 2]), [3.5, 1, 3.5, 2]);
});

test('normCdf matches known values', () => {
  assert.ok(Math.abs(X.normCdf(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(X.normCdf(0) - 0.5) < 1e-9);
});

test('exact Wilcoxon p-value for all-positive differences (n=6) is 2/64', () => {
  const r = X.wilcoxon([1, 2, 3, 4, 5, 6]);
  assert.equal(r.method, 'exact');
  assert.equal(r.wPlus, 21);
  assert.ok(Math.abs(r.p - 2 / 64) < 1e-12);
});

test('Wilcoxon drops zero differences and is symmetric', () => {
  const a = X.wilcoxon([0, 1, -2, 3, 0]);
  const b = X.wilcoxon([0, -1, 2, -3, 0]);
  assert.equal(a.n, 3);
  assert.equal(a.p, b.p);
});

test('blind sheet hides conditions and import maps codes back', () => {
  const entries = [
    { id: 'a1', participant: 'P1', condition: 'A', name: 'Idea A1' },
    { id: 'b1', participant: 'P1', condition: 'B', name: 'Idea B1' },
    { id: 'a2', participant: 'P2', condition: 'A', name: 'Idea A2' },
    { id: 'b2', participant: 'P2', condition: 'B', name: 'Idea B2' }
  ];
  const sheet = X.blindSheet(entries, { seed: 1, raters: ['R1', 'R2'] });
  assert.doesNotMatch(sheet.csv, /condition|,A,|,B,/);
  assert.equal(sheet.rows.length, 8);
  // fill: B entries get 5s, A entries get 3s
  const filled = sheet.rows.map((r) => {
    const k = sheet.key.find((x) => x.code === r.code);
    const v = entries.find((e) => e.id === k.entryId).condition === 'B' ? 5 : 3;
    return Object.assign({}, r, { novelty: v, feasibility: v, explainability: v, confidence: v, quality: v });
  });
  const csv = X.toCSV(filled, Object.keys(filled[0]));
  const imp = X.importRatings(csv, sheet.key);
  assert.equal(imp.errors.length, 0);
  assert.equal(imp.ratings.length, 8);
  const res = X.analyze(entries, imp.ratings, { traceOf: (e) => (e.condition === 'B' ? 0.9 : 0.1) });
  assert.equal(res.descriptive.B.novelty.mean, 5);
  assert.equal(res.descriptive.A.novelty.mean, 3);
  assert.equal(res.paired.novelty.meanDiff, 2);
  assert.ok(Math.abs(res.paired.traceability.meanDiff - 0.8) < 1e-9);
  assert.equal(res.agreement.exact, 1);
});

test('importRatings reports bad codes and out-of-range scores', () => {
  const imp = X.importRatings('rater,code,novelty\nR1,S99,3\nR1,S01,9', [{ code: 'S01', entryId: 'x' }]);
  assert.equal(imp.errors.length, 2);
});
