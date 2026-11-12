'use strict';
/* The app side of the shared AI: no key needed, nothing secret sent, plain errors. */
const test = require('node:test');
const assert = require('node:assert');

function freshLLM(sharedAI) {
  global.PL = { config: { sharedAI } };
  delete require.cache[require.resolve('../js/engine/llm.js')];
  return require('../js/engine/llm.js');
}
const ok = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
const reply = (status, body) => ({ ok: status < 400, status, statusText: 'x', json: async () => body });

test('with a shared AI configured, it is offered, needs no key and sends none', async () => {
  const L = freshLLM('https://proxy.example/');
  const sh = L.PRESETS.shared;
  assert.equal(sh.baseUrl, 'https://proxy.example/v1beta');
  const s = { preset: 'shared', provider: sh.provider, baseUrl: sh.baseUrl, model: sh.model, apiKey: '' };
  assert.equal(L.ready(s), true);
  let seen;
  const out = await L.chat(s, [{ role: 'user', content: 'hi' }], async (url, init) => { seen = { url, init }; return reply(200, ok); });
  assert.equal(out, '{"ok":true}');
  assert.equal(seen.url, 'https://proxy.example/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(seen.init.headers['x-goog-api-key'], undefined);
});

test('without a shared AI configured, it is not ready and Gemini still needs a key', () => {
  const L = freshLLM('');
  assert.equal(L.PRESETS.shared.baseUrl, '');
  assert.equal(L.ready({ preset: 'shared', provider: 'gemini', baseUrl: '', model: 'gemini-3.5-flash-lite' }), false);
  assert.equal(L.ready({ preset: 'gemini', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.8-flash', apiKey: '' }), false);
});

test('shared-AI errors tell people what to do', async () => {
  const L = freshLLM('https://proxy.example');
  const s = { preset: 'shared', provider: 'gemini', baseUrl: 'https://proxy.example/v1beta', model: 'gemini-3.5-flash-lite', retryScale: 0 };
  await assert.rejects(L.chat(s, [{ role: 'user', content: 'hi' }], async () => reply(429, { error: { message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier' } })),
    /shared AI has used today.s free allowance.*add your own free Gemini key/);
  await assert.rejects(L.chat(s, [{ role: 'user', content: 'hi' }], async () => reply(403, { error: { message: 'This service only answers the ProductLab site.' } })),
    /only works on the ProductLab website/);
});

test('when the shared model is busy, the shared AI falls back to the previous Flash model', async () => {
  const L = freshLLM('https://proxy.example/');
  L.resetBusy();
  const sh = L.PRESETS.shared;
  const s = { preset: 'shared', provider: sh.provider, baseUrl: sh.baseUrl, model: sh.model, apiKey: '', retryScale: 0 };
  assert.equal(L.fallbackFor(s), 'gemini-3.6-flash');
  const urls = [];
  const out = await L.chat(s, [{ role: 'user', content: 'hi' }], async (url) => {
    urls.push(url);
    return /flash-lite/.test(url) ? reply(503, { error: { message: 'This model is currently experiencing high demand.' } }) : reply(200, ok);
  });
  assert.equal(out, '{"ok":true}');
  assert.match(urls[urls.length - 1], /gemini-3\.6-flash:generateContent$/);
  L.resetBusy();
});

test('shared-AI errors never point people to model settings, and offline is explained plainly', async () => {
  const L = freshLLM('https://proxy.example/');
  L.resetBusy();
  const sh = L.PRESETS.shared;
  const s = { preset: 'shared', provider: sh.provider, baseUrl: sh.baseUrl, model: sh.model, apiKey: '', retryScale: 0 };
  await assert.rejects(L.chat(s, [{ role: 'user', content: 'hi' }], async () => reply(503, { error: { message: 'high demand' } })),
    (e) => /very busy/.test(e.message) && !/Settings/.test(e.message));
  L.resetBusy();
  await assert.rejects(L.chat(s, [{ role: 'user', content: 'hi' }], async () => { throw new TypeError('Failed to fetch'); }),
    (e) => /internet connection/.test(e.message) && e.offline === true);
  assert.match(L.explain(413, 'too large', sh.model, true), /too large/);
  L.resetBusy();
});
