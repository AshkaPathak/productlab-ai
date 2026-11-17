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
  const r = P.recommendStack({ kind: 'mobile', accounts: true, sensitiveData: true, ai: 'llm', wearables: true, budget: 'low', region: 'India' });
  const layers = r.map((x) => x.layer);
  ['Languages', 'App', 'Backend', 'Intelligence', 'Privacy & security', 'Integrations'].forEach((l) => assert.ok(layers.includes(l), l));
  r.forEach((x) => assert.ok(x.why.length > 0 || x.layer === 'Languages', x.layer));
  assert.match(r.find((x) => x.layer === 'Privacy & security').why.join(' '), /DPDP/);
});

test('not every idea gets accounts and a database: the simplest way that fits comes first', () => {
  const site = P.buildOptions({ kind: 'website', ai: 'none' });
  assert.equal(site.options[0].id, 'static');
  assert.ok(!site.chosen.stack.some((x) => /Supabase|PostgreSQL|Auth/i.test(x.choice)), 'a website has no database or sign-in');
  const tool = P.buildOptions({ kind: 'webapp', offline: true });
  assert.equal(tool.options[0].id, 'browser');
  assert.ok(tool.needs.includes('No sign-in needed'));
  assert.ok(!tool.options.some((o) => o.id === 'accounts'), 'no accounts option when nobody signs in');
  assert.equal(P.buildOptions({ kind: 'webapp', sharedData: true }).options[0].id, 'serverless');
  assert.equal(P.buildOptions({ kind: 'chat', messaging: true }).options[0].id, 'chat');
  const hw = P.buildOptions({ kind: 'hardware', hardware: true });
  assert.deepEqual(hw.options.map((o) => o.id).sort(), ['hardware', 'kit']);
  assert.equal(P.buildOptions({ kind: 'mobile', accounts: true, sensitiveData: true }).options.some((o) => o.id === 'accounts'), true);
});

test('every way to build it says why it fits, how to start and what to watch for', () => {
  [{ kind: 'website' }, { kind: 'webapp' }, { kind: 'mobile', accounts: true }, { kind: 'chat', messaging: true }, { kind: 'hardware' }, { kind: 'service', accounts: true, expectedUsers: 300000 }].forEach((c) => {
    const o = P.buildOptions(c);
    assert.ok(o.options.length >= 2 && o.options.length <= 4, JSON.stringify(c));
    o.options.forEach((w) => {
      assert.ok(w.why.length && w.steps.length >= 3 && w.languages.length && w.cost && w.complexity >= 1, w.id);
      assert.equal(w.stack[0].layer, 'Languages');
    });
    assert.equal(o.options.filter((w) => w.recommended).length, 1);
  });
});

test('the team can pick another way, and older projects still get sensible options', () => {
  const o = P.buildOptions({ kind: 'webapp', offline: true, stack: 'static' });
  assert.equal(o.chosen.id, 'static');
  assert.equal(o.options[0].id, 'browser', 'the recommendation itself does not change');
  assert.equal(P.buildOptions({ kind: 'webapp', stack: 'hardware' }).chosen.id, 'browser', 'an option that does not fit is ignored');
  const old = P.buildOptions({ platform: 'web', ai: 'rules' });
  assert.equal(old.kind, 'webapp');
  assert.equal(old.options[0].id, 'browser');
});
