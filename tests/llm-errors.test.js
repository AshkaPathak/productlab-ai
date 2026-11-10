'use strict';
// Free-tier behaviour: retry when asked to slow down, and explain failures plainly.
const test = require('node:test');
const assert = require('node:assert');
const L = require('../js/engine/llm.js');

const reply = (status, body) => ({ ok: status < 400, status, statusText: 'x', json: async () => body });
const gemini = { provider: 'gemini', baseUrl: 'https://example.test/v1beta', model: 'gemini-3.8-flash', apiKey: 'k', retryScale: 0 };
const ok = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
const DAILY = 'Quota exceeded for metric: generate_content_free_tier_requests, limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const BUSY = 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.';
test.beforeEach(() => L.resetBusy());

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
  const f = async () => { calls++; return reply(429, { error: { message: DAILY } }); };
  await assert.rejects(L.chat(Object.assign({}, gemini, { fallback: false }), [{ role: 'user', content: 'hi' }], f), /free quota .* used up.*gemini-3\.5-flash-lite/);
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

test('an overloaded model gets one quick retry, then the request moves to Flash-Lite', async () => {
  const seen = []; const switched = [];
  const f = async (url) => { seen.push(url.match(/models\/([^:]+)/)[1]); return /3\.8/.test(url) ? reply(503, { error: { message: BUSY } }) : reply(200, ok); };
  const out = await L.chat(Object.assign({ onFallback: (a, b) => switched.push([a, b]) }, gemini), [{ role: 'user', content: 'hi' }], f);
  assert.equal(out, '{"ok":true}');
  assert.deepEqual(seen, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.deepEqual(switched, [['gemini-3.8-flash', 'gemini-3.5-flash-lite']]);
});

test('once a model is busy, later requests go straight to Flash-Lite', async () => {
  const f1 = async (url) => (/3\.8/.test(url) ? reply(503, { error: { message: BUSY } }) : reply(200, ok));
  await L.chat(gemini, [{ role: 'user', content: 'a' }], f1);
  const seen = [];
  await L.chat(gemini, [{ role: 'user', content: 'b' }], async (url) => { seen.push(url); return reply(200, ok); });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /gemini-3\.5-flash-lite/);
});

test('a used-up daily quota switches to Flash-Lite without waiting', async () => {
  const seen = []; const waits = [];
  const f = async (url) => { seen.push(url); return /3\.8/.test(url) ? reply(429, { error: { message: DAILY } }) : reply(200, ok); };
  const out = await L.chat(Object.assign({ onWait: (w) => waits.push(w) }, gemini), [{ role: 'user', content: 'hi' }], f);
  assert.equal(out, '{"ok":true}');
  assert.equal(seen.length, 2);
  assert.deepEqual(waits, []);
});

test('when Flash-Lite is also busy, the error is plain and names it', async () => {
  const f = async () => reply(503, { error: { message: BUSY } });
  await assert.rejects(L.chat(gemini, [{ role: 'user', content: 'hi' }], f), /gemini-3\.5-flash-lite is very busy/);
});

test('a provider that never answers is cut off with a plain message', async () => {
  const f = (url, init) => new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }); });
  await assert.rejects(L.chat(Object.assign({}, gemini, { timeoutMs: 30, fallback: false }), [{ role: 'user', content: 'hi' }], f), /did not answer within/);
});

test('new-style keys get a key hint that mentions both formats', () => {
  assert.match(L.explain(400, 'API key not valid. Please pass a valid API key.', 'm'), /"AQ\." or "AIza"/);
});
