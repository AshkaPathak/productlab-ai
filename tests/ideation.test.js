const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine/evidence.js');
const I = require('../js/engine/ideation.js');
const C = require('../js/engine/cluster.js');

const project = {
  glossary: [['app', 'mobile']],
  findings: [
    { id: 'E1', text: 'Women wait years for a diagnosis and see many doctors', tags: ['diagnosis'] },
    { id: 'E2', text: 'Women want trustworthy evidence-based information on their phone', tags: ['information', 'app'] },
    { id: 'E3', text: 'Continuous wearable sensing can track sleep and activity', tags: ['wearable'] },
    { id: 'E4', text: 'Doctors lack time to review patient symptom history', tags: ['clinician'] }
  ],
  needs: [
    { id: 'N1', statement: 'Earlier diagnosis with fewer doctor visits', evidence: ['E1'], severity: 5 },
    { id: 'N2', statement: 'Trustworthy information in a mobile app', evidence: ['E2'], severity: 4 }
  ],
  morph: {
    params: [
      { id: 'user', name: 'Target user', options: [{ label: 'Women', hint: 'women patients' }, { label: 'Clinicians', hint: 'doctors clinician' }] },
      { id: 'ui', name: 'Interface', options: [{ label: 'Mobile app', hint: 'phone app information' }, { label: 'Wearable', hint: 'wearable sensing sleep activity' }] },
      { id: 'out', name: 'Output', options: [{ label: 'Evidence summary', hint: 'evidence-based information summary' }, { label: 'Doctor report', hint: 'symptom history for doctors diagnosis' }] }
    ],
    rules: [{ a: ['user', 'Clinicians'], b: ['ui', 'Wearable'], reason: 'Clinicians do not wear patient sensors' }]
  }
};

test('rng is deterministic for a seed', () => {
  const a = I.rng(5); const b = I.rng(5);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('random association returns prompts tied to needs', () => {
  const r = I.randomAssociation(project.needs, { seed: 3, count: 3 });
  assert.equal(r.length, 3);
  r.forEach((x) => { assert.ok(['N1', 'N2'].includes(x.need)); assert.match(x.prompt, /What if/); });
});

test('morphological enumeration covers the full space and applies rules', () => {
  assert.equal(I.comboCount(project.morph.params), 8);
  const all = Array.from(I.enumerate(project.morph.params));
  assert.equal(all.length, 8);
  const bad = all.filter((s) => I.violations(s, project.morph.rules).length);
  assert.equal(bad.length, 2);
});

test('topCombos ranks feasible combinations by need coverage', () => {
  const idx = E.buildIndex(project);
  const r = I.topCombos(project, idx, 3, { maxShared: 3 });
  assert.equal(r.total, 8);
  assert.equal(r.feasible, 6);
  assert.equal(r.rejected, 2);
  assert.ok(r.top[0].score >= r.top[1].score);
  r.top.forEach((t) => assert.equal(I.violations(t.selection, project.morph.rules).length, 0));
});

test('synthesised concepts carry verifiable citations', () => {
  const idx = E.buildIndex(project);
  const best = I.topCombos(project, idx, 1).top[0];
  const c = I.synthesizeConcept(best.selection, project, idx);
  assert.ok(c.claims.length >= 2);
  const statuses = c.claims.map((cl) => E.verify(idx, cl).status);
  assert.ok(statuses.every((s) => s === 'supported' || s === 'partial'), statuses.join(','));
});

test('clustering groups related findings into themes', () => {
  const p = {
    findings: [
      { id: 'a', text: 'food waste in hostel mess plates' },
      { id: 'b', text: 'plate waste by students in the mess' },
      { id: 'c', text: 'privacy of personal health data' },
      { id: 'd', text: 'consent for health data sharing privacy' }
    ],
    needs: [{ id: 'N1', statement: 'reduce plate waste in the mess' }]
  };
  const idx = E.buildIndex(p);
  const th = C.themes(p, idx, { threshold: 0.1 });
  assert.equal(th.length, 2);
  const waste = th.find((t) => t.members.includes('a'));
  assert.deepEqual(waste.members.sort(), ['a', 'b']);
  assert.equal(waste.need.id, 'N1');
  assert.deepEqual(C.orphanFindings(p), ['a', 'b', 'c', 'd']);
});
