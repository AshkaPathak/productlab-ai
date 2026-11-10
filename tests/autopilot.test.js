const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/engine/autopilot.js');
const E = require('../js/engine/evidence.js');
const D = require('../js/engine/decision.js');
const P = require('../js/engine/planning.js');
const { makeFetch, PAPERS } = require('./fixtures/mock-apis.js');

const gemini = { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-test', apiKey: 'test' };
const PROBLEM = 'People save posts on Instagram, YouTube and X but can never find them again and the pile keeps growing.';

test('autopilot turns a problem statement into a complete project', async () => {
  const f = makeFetch();
  const steps = {};
  const p = await A.run(PROBLEM, gemini, { fetch: f, onStep: (id, st) => { steps[id] = st; } });
  ['plan', 'research', 'users', 'ideas', 'evaluate', 'build'].forEach((s) => assert.equal(steps[s], 'done', s));
  assert.equal(p.name, 'Saved Posts Organiser');
  assert.equal(f.calls.filter((u) => u.startsWith('https://api.openalex.org/')).length, 3, 'one paper search per query');

  // evidence is verbatim from sources and every finding points at a reference
  const refIds = new Set(p.references.map((r) => r.id));
  p.findings.forEach((x) => assert.ok(refIds.has(x.ref), x.id));
  const paperText = PAPERS.map((x) => x.abstract).join(' ');
  p.findings.filter((x) => x.locator.startsWith('Abstract')).forEach((x) => assert.ok(paperText.includes(x.text), 'verbatim: ' + x.text));
  assert.ok(p.findings.some((x) => x.locator === 'Web (grounded)'), 'web facts included');
  assert.ok(p.references.some((r) => r.doi === '10.9999/mock.1' && r.strength === 3), 'review gets strength 3');

  // users, concepts, matrix, plan
  assert.equal(p.needs.length, 3);
  assert.equal(p.concepts.length, 2);
  assert.equal(p.morph.params.length, 2);
  assert.equal(p.morph.rules.length, 1);
  assert.equal(p.ratings.C1.feasibility.value, 3.5, 'bare numbers accepted as ratings');
  assert.equal(p.selectedConcept, D.wdm(p.concepts, p.criteria, p.ratings)[0].id);
  assert.equal(p.features.length, 3);
  assert.deepEqual(p.features[1].dependsOn, ['F1'], 'dependencies resolved by name');
  assert.equal(P.recommendStack(p.constraints)[0].layer, 'Languages');
  assert.match(p.caveats, /AI drafts/);
});

test('the citation guard catches hallucinated IDs in autopilot output', async () => {
  const p = await A.run(PROBLEM, gemini, { fetch: makeFetch() });
  const a = E.audit(p);
  const bad = a.items.find((i) => (i.evidence || []).includes('E99'));
  assert.equal(bad.result.status, 'invalid');
  assert.ok(a.summary.total > 10);
});

test('buildPlan can be re-run for the concept the team chooses', async () => {
  const f = makeFetch();
  const p = await A.run(PROBLEM, gemini, { fetch: f });
  const b = await A.buildPlan(p, 'C2', gemini, f);
  assert.equal(b.conceptId, 'C2');
  assert.ok(b.features.length > 0);
});

test('without an AI model, autopilot still researches and drafts needs from evidence themes', async () => {
  const steps = {};
  const p = await A.run(PROBLEM, { provider: 'gemini', model: 'x', apiKey: '' }, { fetch: makeFetch(), onStep: (id, st) => { steps[id] = st; } });
  assert.equal(steps.research, 'done');
  assert.equal(steps.ideas, 'skipped');
  assert.ok(p.findings.length >= 3);
  assert.ok(!p.findings.some((x) => x.locator === 'Web (grounded)'), 'no web search without a key');
  assert.match(p.caveats, /Research-only/);
});

test('autopilot stops cleanly when no evidence can be found', async () => {
  const steps = {};
  const p = await A.run(PROBLEM, { provider: 'openai', model: 'm', apiKey: 'k', baseUrl: 'https://x.test/v1' }, { fetch: makeFetch({ failOpenAlex: true }), onStep: (id, st) => { steps[id] = st; } });
  assert.equal(steps.research, 'failed');
  assert.equal(p.findings.length, 0);
});

test('when the chosen model is busy, the run switches models once and records the one that answered', async () => {
  require('../js/engine/llm.js').resetBusy();
  const inner = makeFetch();
  const f = async (url, init) => (/gemini-busy:generateContent$/.test(url)
    ? { ok: false, status: 503, statusText: 'x', json: async () => ({ error: { message: 'This model is currently experiencing high demand.' } }) }
    : inner(url, init));
  const logs = [];
  const p = await A.run(PROBLEM, Object.assign({}, gemini, { model: 'gemini-busy', retryScale: 0 }), { fetch: f, web: false, onLog: (m) => logs.push(m) });
  assert.equal(p.autopilot.model, 'gemini-3.5-flash-lite');
  assert.match(p.caveats, /with gemini-3\.5-flash-lite\./);
  assert.equal(logs.filter((m) => /busy or out of free quota/.test(m)).length, 1);
  require('../js/engine/llm.js').resetBusy();
});
