'use strict';
// Free-tier behaviour: retry when asked to slow down, and explain failures plainly.
const test = require('node:test');
const assert = require('node:assert');
const L = require('../js/engine/llm.js');

const reply = (status, body) => ({ ok: status < 400, status, statusText: 'x', json: async () => body });
const gemini = { provider: 'gemini', baseUrl: 'https://example.test/v1beta', model: 'gemini-3.8-flash', apiKey: 'k', retryScale: 0 };
const ok = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };

test('default Gemini model is the current recommended Flash model', () => {
  assert.equal(L.PRESETS.gemini.model, 'gemini-3.8-flash');
  assert.ok(L.GEMINI_MODELS.some((m) => m.id === 'gemini-3.5-flash-lite'));
});

test('a per-minute rate limit is retried after the delay Google asks for', async () => {
  const waits = []; let calls = 0;
  const f = async () => (++calls === 1 ? reply(429, { error: { message: 'Resource exhausted', details: [{ retryDelay: '7s' }] } }) : reply(200, ok));
  const out = await L.chat(Object.assign({ onWait: (s) => waits.push(s) }, gemini), [{ role: 'user', content: 'hi' }], f);
  assert.equal(out, '{"ok":true}');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [7]);
});

test('a used-up daily quota is not retried and says what to do', async () => {
  let calls = 0;
  const f = async () => { calls++; return reply(429, { error: { message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier' } }); };
  await assert.rejects(L.chat(gemini, [{ role: 'user', content: 'hi' }], f), /free quota .* used up.*gemini-3\.5-flash-lite/);
  assert.equal(calls, 1);
});

test('gives up after three attempts on a persistent rate limit', async () => {
  let calls = 0;
  const f = async () => { calls++; return reply(429, { error: { message: 'Resource exhausted' } }); };
  await assert.rejects(L.chat(gemini, [{ role: 'user', content: 'hi' }], f), /limiting how fast/);
  assert.equal(calls, 3);
});

test('bad keys and unknown models get plain explanations', async () => {
  await assert.rejects(L.chat(gemini, [{ role: 'user', content: 'x' }], async () => reply(400, { error: { message: 'API key not valid. Please pass a valid API key.' } })), /did not accept the key/);
  await assert.rejects(L.chat(gemini, [{ role: 'user', content: 'x' }], async () => reply(404, { error: { message: 'models/x is not found' } })), /not available to this key/);
});
