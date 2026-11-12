'use strict';
/* The shared-AI backend: only the ProductLab site, only text generation, limits, key never echoed. */
const test = require('node:test');
const assert = require('node:assert');

const SITE = 'https://ashkapathak.github.io';
const env = { GEMINI_API_KEY: 'server-secret-key' };
const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }], generationConfig: { temperature: 0, maxOutputTokens: 99999 }, tools: [{ googleSearch: {} }] });
const req = (path, init) => new Request('https://proxy.example' + path, Object.assign({ method: 'POST', headers: { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': init && init.ip || '1.2.3.4' }, body }, init || {}));

let W; let seen;
test.before(async () => {
  W = (await import('../proxy/worker.mjs')).default;
  global.fetch = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 }); };
});
test.beforeEach(() => { W.hits.clear(); seen = null; });

test('forwards a request from the site to Gemini with the server key, trimmed to text generation', async () => {
  const r = await W.handle(req('/v1beta/models/gemini-3.5-flash-lite:generateContent'), env, Date.now());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), SITE);
  assert.match(seen.url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(seen.init.headers['x-goog-api-key'], 'server-secret-key');
  const sent = JSON.parse(seen.init.body);
  assert.equal(sent.tools, undefined, 'search grounding is stripped');
  assert.equal(sent.generationConfig.maxOutputTokens, 4096, 'output length is capped');
  assert.ok(!(await r.text()).includes('server-secret-key'), 'the key is never sent back');
});

test('refuses other websites, other models and other endpoints', async () => {
  const other = await W.handle(new Request('https://proxy.example/v1beta/models/gemini-3.5-flash-lite:generateContent', { method: 'POST', headers: { Origin: 'https://evil.example' }, body }), env, Date.now());
  assert.equal(other.status, 403);
  const model = await W.handle(req('/v1beta/models/gemini-9-ultra:generateContent'), env, Date.now());
  assert.equal(model.status, 400);
  const path = await W.handle(req('/v1beta/files'), env, Date.now());
  assert.equal(path.status, 404);
  assert.equal(seen, null, 'nothing reached Google');
});

test('limits each visitor per minute but not other visitors', async () => {
  const now = Date.now();
  for (let i = 0; i < 12; i++) assert.equal((await W.handle(req('/v1beta/models/gemini-3.5-flash-lite:generateContent'), env, now + i)).status, 200);
  const blocked = await W.handle(req('/v1beta/models/gemini-3.5-flash-lite:generateContent'), env, now + 20);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  assert.equal((await W.handle(req('/v1beta/models/gemini-3.5-flash-lite:generateContent', { ip: '5.6.7.8' }), env, now + 21)).status, 200);
  assert.equal((await W.handle(req('/v1beta/models/gemini-3.5-flash-lite:generateContent'), env, now + 61e3)).status, 200, 'allowed again a minute later');
});

test('answers the browser pre-check and a health check, and says when no key is set', async () => {
  const pre = await W.handle(new Request('https://proxy.example/v1beta/models/x:generateContent', { method: 'OPTIONS', headers: { Origin: SITE } }), env, Date.now());
  assert.equal(pre.status, 204);
  const health = await (await W.handle(new Request('https://proxy.example/', { headers: { Origin: SITE } }), {}, Date.now())).json();
  assert.equal(health.ok, true); assert.equal(health.keyConfigured, false);
  const nokey = await W.handle(req('/v1beta/models/gemini-3.5-flash-lite:generateContent'), {}, Date.now());
  assert.equal(nokey.status, 500);
});
