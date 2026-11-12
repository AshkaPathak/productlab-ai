/*
 * ProductLab AI - shared AI backend (Cloudflare Worker)
 *
 * Lets people use ProductLab without an API key of their own. The site sends
 * its Gemini requests here; this Worker adds the team's key, which is stored
 * as a Cloudflare secret and never reaches the browser or the repository.
 *
 * Guard rails, because the key is shared:
 * - only requests from the ProductLab site are accepted (ALLOWED_ORIGINS);
 * - only text generation with the listed models (no search grounding, no other APIs);
 * - request size and output length are capped;
 * - each visitor (IP address) gets a limited number of requests per minute and per hour.
 *
 * Settings (Cloudflare dashboard, Worker, Settings, Variables and Secrets):
 *   GEMINI_API_KEY   secret, required: the Gemini key from Google AI Studio
 *   ALLOWED_ORIGINS  optional, comma separated; defaults to the GitHub Pages site
 */

const DEFAULT_ORIGINS = ['https://ashkapathak.github.io'];
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_BODY = 120000;          // bytes; ProductLab's largest prompt is about 40 KB
const MAX_OUTPUT_TOKENS = 4096;
const PER_MINUTE = 12;            // per visitor
const PER_HOUR = 120;             // per visitor

// Best-effort limits kept in memory. Cloudflare may run several copies of the
// Worker, so this slows abuse rather than guaranteeing an exact count.
const hits = new Map();

function allowedOrigins(env) {
  const extra = String((env && env.ALLOWED_ORIGINS) || '').split(',').map((s) => s.trim()).filter(Boolean);
  return extra.length ? extra : DEFAULT_ORIGINS;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}

function limited(ip, now) {
  const minute = 60e3; const hour = 3600e3;
  const list = (hits.get(ip) || []).filter((t) => now - t < hour);
  const lastMinute = list.filter((t) => now - t < minute).length;
  if (lastMinute >= PER_MINUTE) return Math.ceil((minute - (now - list.filter((t) => now - t < minute)[0])) / 1000);
  if (list.length >= PER_HOUR) return Math.ceil((hour - (now - list[0])) / 1000);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return 0;
}

async function handle(request, env, now) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const ok = allowedOrigins(env).includes(origin);
  const h = ok ? cors(origin) : {};

  if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: h });
  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return json(200, { ok: true, service: 'ProductLab shared AI', models: MODELS, keyConfigured: !!(env && env.GEMINI_API_KEY) }, h);
  }
  if (!ok) return json(403, { error: { message: 'This service only answers the ProductLab site.' } });

  const m = url.pathname.match(/^\/v1beta\/models\/([a-z0-9.\-]+):generateContent$/);
  if (request.method !== 'POST' || !m) return json(404, { error: { message: 'Only text generation is available here.' } }, h);
  if (!MODELS.includes(m[1])) return json(400, { error: { message: 'Model not available on the shared service: ' + m[1] } }, h);
  if (!env || !env.GEMINI_API_KEY) return json(500, { error: { message: 'The shared AI is not set up yet (no key on the server).' } }, h);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const wait = limited(ip, now);
  if (wait) return json(429, { error: { message: 'Too many requests from this device; please wait a moment.', status: 'RESOURCE_EXHAUSTED' } }, Object.assign({ 'Retry-After': String(wait) }, h));

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: { message: 'Request too large for the shared service.' } }, h);
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json(400, { error: { message: 'Request is not valid JSON.' } }, h); }

  // text in, text out: keep only the fields ProductLab uses
  const gen = Object.assign({}, body.generationConfig || {});
  gen.maxOutputTokens = Math.min(Number(gen.maxOutputTokens) || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
  const clean = { contents: body.contents, generationConfig: gen };
  if (body.systemInstruction) clean.systemInstruction = body.systemInstruction;
  if (!Array.isArray(clean.contents) || !clean.contents.length) return json(400, { error: { message: 'Nothing to send.' } }, h);

  const upstream = await fetch(UPSTREAM + m[1] + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(clean)
  });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: Object.assign({ 'Content-Type': 'application/json' }, h) });
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env, Date.now()); } catch (e) { return json(502, { error: { message: 'The shared AI could not reach Google: ' + e.message } }); }
  },
  // exposed for the tests in tests/proxy.test.js
  handle,
  hits,
  MODELS
};
