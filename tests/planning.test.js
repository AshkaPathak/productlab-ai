const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/engine/planning.js');

test('RICE matches the textbook formula and evidence lowers unsupported scores', () => {
  const f = { reach: 60, impact: 2, confidence: 80, effort: 4 };
  assert.equal(P.rice(f).raw, 24);
  assert.equal(P.rice(f, 1).adjusted, 24);
  assert.equal(P.rice(f, 0).adjusted, 12);
});

test('PERT expected effort', () => {
  assert.equal(P.expectedEffort({ effort: 4, effortMin: 2, effortMax: 12 }), 5);
  assert.equal(P.expectedEffort({ effort: 4 }), 4);
});

test('schedule respects dependencies and skips Won\'t features', () => {
  const project = {
    features: [
      { id: 'A', name: 'Login', effort: 2, moscow: 'Must' },
      { id: 'B', name: 'Log', effort: 4, moscow: 'Must', dependsOn: ['A'] },
      { id: 'C', name: 'Insights', effort: 6, moscow: 'Should', dependsOn: ['B'] },
      { id: 'D', name: 'Gamification', effort: 3, moscow: "Won't" }
    ]
  };
  const s = P.schedule(project, { teamSize: 2, focus: 1, buffer: 0, sprintWeeks: 2 });
  assert.deepEqual(s.tasks.map((t) => t.id), ['A', 'B', 'C']);
  const t = Object.fromEntries(s.tasks.map((x) => [x.id, x]));
  assert.equal(t.A.end, 1);
  assert.equal(t.B.start, 1);
  assert.equal(t.B.end, 3);
  assert.equal(t.C.end, 6);
  assert.equal(s.mvpWeeks, 3);
  assert.equal(s.totalEffort, 12);
});

test('dependency cycles are reported, not looped forever', () => {
  const s = P.schedule({ features: [{ id: 'A', effort: 1, dependsOn: ['B'] }, { id: 'B', effort: 1, dependsOn: ['A'] }] });
  assert.deepEqual(s.cyclic.sort(), ['A', 'B']);
});

test('stack recommender explains every pick from the constraints', () => {
  const r = P.recommendStack({ platform: 'mobile', sensitiveData: true, ai: 'llm', wearables: true, budget: 'low', region: 'India' });
  const layers = r.map((x) => x.layer);
  ['Client', 'Backend', 'Intelligence', 'Privacy & security', 'Integrations'].forEach((l) => assert.ok(layers.includes(l), l));
  r.forEach((x) => assert.ok(x.why.length > 0, x.layer));
  assert.match(r.find((x) => x.layer === 'Privacy & security').why.join(' '), /DPDP/);
});
