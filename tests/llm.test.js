const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/engine/llm.js');

const project = {
  name: 'Demo', challenge: 'Help women manage PCOS', hmw: 'How might we...',
  needs: [{ id: 'N1', statement: 'Faster diagnosis' }],
  findings: [{ id: 'E1', text: 'A third waited over two years for diagnosis' }]
};

test('grounded prompt lists evidence IDs; baseline prompt does not', () => {
  const g = L.buildConceptPrompt(project, { mode: 'grounded' });
  const b = L.buildConceptPrompt(project, { mode: 'baseline' });
  assert.match(g[1].content, /E1: A third waited/);
  assert.match(g[0].content, /Never invent IDs/);
  assert.doesNotMatch(b[1].content, /E1:/);
});

test('extractJSON copes with fences and chatter', () => {
  assert.deepEqual(L.extractJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(L.extractJSON('Sure! Here it is: {"a":"x}y","b":[1,2]} hope it helps'), { a: 'x}y', b: [1, 2] });
  assert.throws(() => L.extractJSON('no json here'));
});

test('normalizeConcepts sanitises ids and strings', () => {
  const out = L.normalizeConcepts({ concepts: [{ name: '  A  ', needs: ['n1', 'bad'], claims: [{ text: 'x', evidence: ['e1', 'DROP TABLE'] }, 'plain'] }] });
  assert.equal(out[0].name, 'A');
  assert.deepEqual(out[0].needs, ['N1']);
  assert.deepEqual(out[0].claims[0].evidence, ['E1']);
  assert.deepEqual(out[0].claims[1], { text: 'plain', evidence: [] });
});

test('chat speaks the OpenAI-compatible protocol', async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ choices: [{ message: { content: '{"concepts":[]}' } }] }) }; };
  const out = await L.chat({ provider: 'openai', baseUrl: 'https://x.test/v1/', model: 'm', apiKey: 'k' }, [{ role: 'user', content: 'hi' }], fake);
  assert.equal(out, '{"concepts":[]}');
  assert.equal(seen.url, 'https://x.test/v1/chat/completions');
  assert.equal(seen.init.headers.Authorization, 'Bearer k');
});

test('chat speaks the Gemini protocol and surfaces API errors', async () => {
  const ok = async (url, init) => {
    assert.match(url, /models\/g-1:generateContent$/);
    assert.equal(init.headers['x-goog-api-key'], 'k');
    const body = JSON.parse(init.body);
    assert.equal(body.systemInstruction.parts[0].text, 'sys');
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"x":1}' }] } }] }) };
  };
  const s = { provider: 'gemini', baseUrl: 'https://g.test/v1beta', model: 'g-1', apiKey: 'k' };
  assert.equal(await L.chat(s, [{ role: 'system', content: 'sys' }, { role: 'user', content: 'u' }], ok), '{"x":1}');
  const bad = async () => ({ ok: false, status: 400, statusText: 'Bad', json: async () => ({ error: { message: 'API key not valid' } }) });
  await assert.rejects(L.chat(s, [{ role: 'user', content: 'u' }], bad), /did not accept the key/);
});
