const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine/evidence.js');

const project = {
  glossary: [['diagnosis', 'diagnose', 'diagnostic'], ['app', 'mobile', 'application']],
  references: [
    { id: 'R1', authors: ['M. Gibson-Helm', 'H. Teede', 'A. Dunaif', 'A. Dokras'], title: 'Delayed diagnosis', venue: 'J. Clin. Endocrinol. Metab.', volume: '102', issue: '2', pages: '604-612', year: 2017, doi: '10.1210/jc.2016-2963', type: 'journal', strength: 3 },
    { id: 'R2', authors: ['Some Blog'], title: 'Opinion', type: 'web', strength: 1 }
  ],
  findings: [
    { id: 'E1', ref: 'R1', text: 'One third of women waited more than two years for a PCOS diagnosis', tags: ['diagnosis', 'delay'] },
    { id: 'E2', ref: 'R1', text: 'Only 15.6% were satisfied with the information received at diagnosis', tags: ['information'] },
    { id: 'E3', ref: 'R2', text: 'Mobile apps for PCOS lack evidence-based information', tags: ['apps'] }
  ],
  needs: [
    { id: 'N1', statement: 'Women need a faster path to PCOS diagnosis', evidence: ['E1'] },
    { id: 'N2', statement: 'Women need trustworthy information', evidence: ['E9'] },
    { id: 'N3', statement: 'Users want gamified badges', evidence: [] },
    { id: 'N4', statement: 'Users want gamified badges', evidence: ['E1'] }
  ]
};

test('verify marks a well-cited claim as supported', () => {
  const idx = E.buildIndex(project);
  const r = E.verify(idx, { text: 'Diagnosis of PCOS is often delayed by more than two years', evidence: ['E1'] });
  assert.equal(r.status, 'supported');
  assert.equal(r.best.id, 'E1');
});

test('verify flags missing (hallucinated) evidence ids', () => {
  const idx = E.buildIndex(project);
  const r = E.verify(idx, { text: 'Women need trustworthy information', evidence: ['E9'] });
  assert.equal(r.status, 'invalid');
  assert.deepEqual(r.missing, ['E9']);
  assert.ok(r.suggestions.some((s) => s.id === 'E2'), 'should suggest E2');
});

test('verify flags uncited and irrelevant citations', () => {
  const idx = E.buildIndex(project);
  assert.equal(E.verify(idx, { text: 'Users want gamified badges', evidence: [] }).status, 'uncited');
  assert.equal(E.verify(idx, { text: 'Users want gamified badges', evidence: ['E1'] }).status, 'unsupported');
});

test('audit summarises traceability across a project', () => {
  const a = E.audit(project);
  assert.equal(a.summary.total, 4);
  assert.equal(a.summary.supported + a.summary.partial, 1);
  assert.equal(a.summary.invalid, 1);
  assert.equal(a.summary.uncited, 1);
  assert.equal(a.summary.unsupported, 1);
  assert.equal(a.summary.traceability, 0.25);
});

test('evidence score weighs source strength', () => {
  const idx = E.buildIndex(project);
  const strong = E.evidenceScore(idx, [{ text: 'PCOS diagnosis delayed two years', evidence: ['E1'] }]);
  const weak = E.evidenceScore(idx, [{ text: 'PCOS apps lack evidence-based information', evidence: ['E3'] }]);
  assert.ok(strong > weak, `${strong} should exceed ${weak}`);
});

test('formatIEEE produces an IEEE-style journal reference', () => {
  const s = E.formatIEEE(project.references[0]);
  assert.equal(s, 'M. Gibson-Helm, H. Teede, A. Dunaif, and A. Dokras, “Delayed diagnosis,” J. Clin. Endocrinol. Metab., vol. 102, no. 2, pp. 604–612, 2017, doi: 10.1210/jc.2016-2963.');
});

test('formatAuthors abbreviates long author lists', () => {
  assert.equal(E.formatAuthors(['A. One', 'B. Two', 'C. Three', 'D. Four', 'E. Five', 'F. Six', 'G. Seven']), 'A. One et al.');
  assert.equal(E.formatAuthors(['Teede, Helena J.']), 'H. J. Teede');
});
