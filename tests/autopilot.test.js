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

test('with a model connected, papers on a different topic are left out before findings are taken', async () => {
  const inner = makeFetch();
  const offTopic = { id: 'https://openalex.org/W999', doi: 'https://doi.org/10.9999/offtopic', display_name: 'Barriers to voluntary HIV counselling and testing among undergraduates', publication_year: 2020, type: 'article',
    authorships: [{ author: { display_name: 'A. Author' } }], primary_location: { source: { display_name: 'Journal X' } }, biblio: {}, cited_by_count: 1,
    abstract_inverted_index: Object.fromEntries('Results showed that most undergraduates saved no posts but reported barriers to HIV counselling and testing on campus because of stigma and fear of results.'.split(' ').map((w, i) => [w, [i]])) };
  const f = async (url, init) => {
    if (url.startsWith('https://api.openalex.org/')) {
      const r = await inner(url, init); const j = await r.json();
      return { ok: true, json: async () => Object.assign({}, j, { results: j.results.concat([offTopic]) }) };
    }
    if (/generateContent$/.test(url) && /paper numbers/.test(init.body)) {
      const body = JSON.parse(init.body).contents[0].parts[0].text;
      const nums = body.split('\n').filter((l) => /^\d+\. /.test(l) && !/HIV/.test(l)).map((l) => Number(l.split('.')[0]));
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ relevant: nums }) }] } }] }) };
    }
    return inner(url, init);
  };
  const logs = [];
  const p = await A.run(PROBLEM, gemini, { fetch: f, web: false, onLog: (m) => logs.push(m) });
  assert.ok(!p.references.some((r) => /HIV/.test(r.title)), 'the HIV paper is not a source');
  assert.ok(!p.findings.some((x) => /HIV/.test(x.text)), 'and gives no findings');
  assert.ok(logs.some((m) => /Left out 1 paper about a different topic/.test(m)), 'the run log says what was left out');
});

test('without a model, a "need an app that helps me…" problem gets a clean name and question', () => {
  const f = A.fallbackPlan('need a tool or an app that helps me reach me destination the quickest. tell me alternate routes, public commute options');
  assert.equal(f.name, 'Reach their destination the quickest');
  assert.equal(f.hmw, 'How might we help people reach their destination the quickest?');
  const g = A.fallbackPlan('People save posts, reels and videos on Instagram, YouTube and X but can never find them again.');
  assert.equal(g.name, 'People save posts');
  assert.match(g.hmw, /^How might we address this: people save posts/);
});

test('text that is not a problem stops the run before any research', async () => {
  const inner = makeFetch();
  let searched = false;
  const f = async (url, init) => {
    if (url.startsWith('https://api.openalex.org/')) searched = true;
    if (/generateContent$/.test(url) && /isProblem/.test(init.body)) {
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"isProblem": false}' }] } }] }) };
    }
    return inner(url, init);
  };
  const steps = {};
  await assert.rejects(A.run('hello hello hello hello hello hello', gemini, { fetch: f, web: false, onStep: (id, st) => { steps[id] = st; } }), (e) => e.unclear === true && /does not read like a problem/.test(e.message));
  assert.equal(searched, false);
  assert.equal(steps.plan, 'failed');
});

test('when ideas fail, the run says why and the missing steps can be retried', async () => {
  require('../js/engine/llm.js').resetBusy();
  const inner = makeFetch();
  let down = true;
  const f = async (url, init) => (down && /generateContent$/.test(url) && /Generate 4 distinct product concepts/.test(init.body)
    ? { ok: false, status: 400, statusText: 'x', json: async () => ({ error: { message: 'Bad request' } }) }
    : inner(url, init));
  const p = await A.run(PROBLEM, Object.assign({}, gemini, { retryScale: 0 }), { fetch: f, web: false });
  assert.equal(p.concepts.length, 0);
  assert.equal(p.autopilot.steps.ideas.status, 'failed');
  assert.equal(p.autopilot.steps.evaluate.status, 'skipped');
  assert.match(p.caveats, /could not generate ideas/);
  const evidence = p.findings.length;
  down = false;
  await A.resume(p, Object.assign({}, gemini, { retryScale: 0 }), { fetch: f });
  assert.ok(p.concepts.length > 0);
  assert.equal(p.autopilot.steps.ideas.status, 'done');
  assert.equal(p.autopilot.steps.evaluate.status, 'done');
  assert.ok(p.features.length > 0);
  assert.equal(p.findings.length, evidence, 'evidence is kept');
  require('../js/engine/llm.js').resetBusy();
});

test('when the paper search is rate limited, the run says so instead of asking for a new wording', async () => {
  const p = await A.run(PROBLEM, gemini, { fetch: makeFetch({ failOpenAlex: true }), web: false });
  assert.equal(p.autopilot.steps.research.status, 'failed');
  assert.match(p.autopilot.steps.research.detail, /OpenAlex/);
  assert.doesNotMatch(p.autopilot.steps.research.detail, /Rephrase/);
});

test('a problem written in another language still finds evidence through the English search queries', async () => {
  const hindi = 'लोग इंस्टाग्राम और यूट्यूब पर पोस्ट सेव करते हैं लेकिन बाद में उन्हें कभी ढूँढ नहीं पाते।';
  const p = await A.run(hindi, gemini, { fetch: makeFetch(), web: false });
  assert.ok(p.findings.length >= 3, 'found ' + p.findings.length + ' findings');
  assert.equal(p.autopilot.steps.research.status, 'done');
});

test('a cut-off JSON reply is asked for once more before a step fails', async () => {
  require('../js/engine/llm.js').resetBusy();
  const inner = makeFetch();
  let cut = 1;
  const f = async (url, init) => {
    if (cut > 0 && /generateContent$/.test(url) && /Score each concept/.test(init.body)) {
      cut--;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ratings": {"C1": {"desirability": {"value": 4, "note": "cut off' }] } }] }) };
    }
    return inner(url, init);
  };
  const p = await A.run(PROBLEM, gemini, { fetch: f, web: false });
  assert.equal(p.autopilot.steps.evaluate.status, 'done');
  assert.ok(p.selectedConcept);
});
