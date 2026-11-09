/*
 * ProductLab AI - optional language-model assistant
 * Provider-agnostic client (any OpenAI-compatible endpoint, or Google Gemini),
 * prompt builders for evidence-grounded vs. baseline concept generation, and
 * robust JSON extraction. Generated claims are never trusted directly: the
 * caller runs them through the evidence engine's citation guard.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.PL = root.PL || {}).llm = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRESETS = {
    gemini: { label: 'Google Gemini (free tier available)', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.8-flash' },
    openai: { label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    groq: { label: 'Groq (OpenAI-compatible)', provider: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    openrouter: { label: 'OpenRouter (OpenAI-compatible)', provider: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
    ollama: { label: 'Ollama on this computer (no key)', provider: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' }
  };

  const SCHEMA_HINT = '{"concepts":[{"name":"string","tagline":"string","description":"string","needs":["N1"],"claims":[{"text":"string","evidence":["E1"]}]}]}';

  function clip(s, n) { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

  /**
   * mode 'grounded': the model sees needs and numbered evidence and must cite IDs.
   * mode 'baseline': the model sees only the challenge (ordinary AI brainstorming).
   */
  function buildConceptPrompt(project, options) {
    const o = Object.assign({ mode: 'grounded', count: 3, maxEvidence: 60 }, options || {});
    const system = o.mode === 'grounded'
      ? 'You are a product strategist. You generate product concepts strictly from the evidence provided. ' +
        'Every claim must cite one or more evidence IDs from the list (e.g. "E3"). Never invent IDs, statistics or sources. ' +
        'If the evidence does not support something, do not claim it. Reply with JSON only.'
      : 'You are a product strategist. Generate creative product concepts. Reply with JSON only.';
    const lines = [];
    lines.push('Challenge: ' + clip(project.challenge || project.name, 600));
    if (project.hmw) lines.push('How might we: ' + clip(project.hmw, 400));
    if (o.mode === 'grounded') {
      lines.push('', 'Needs:');
      (project.needs || []).forEach((n) => lines.push(n.id + ': ' + clip(n.statement, 240)));
      lines.push('', 'Evidence (cite by ID):');
      (project.findings || []).slice(0, o.maxEvidence).forEach((f) => lines.push(f.id + ': ' + clip(f.text, 260)));
      lines.push('', 'Generate ' + o.count + ' distinct product concepts. Each concept needs 3-5 claims; each claim cites the evidence IDs that support it. ' +
        'List the need IDs each concept addresses.');
    } else {
      lines.push('', 'Generate ' + o.count + ' distinct product concepts. For each, give 3-5 claims explaining why it would work. Use an empty evidence array.');
    }
    lines.push('', 'JSON shape: ' + SCHEMA_HINT);
    return [{ role: 'system', content: system }, { role: 'user', content: lines.join('\n') }];
  }

  /** Pull the first JSON object/array out of a model reply (handles ``` fences and chatter). */
  function extractJSON(text) {
    const t = String(text || '').replace(/```(?:json)?/gi, '').trim();
    try { return JSON.parse(t); } catch (e) { /* fall through */ }
    const start = t.search(/[[{]/);
    if (start < 0) throw new Error('No JSON found in model reply');
    const open = t[start]; const close = open === '{' ? '}' : ']';
    let depth = 0; let inStr = false; let esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth += 1;
      else if (ch === close) { depth -= 1; if (depth === 0) return JSON.parse(t.slice(start, i + 1)); }
    }
    throw new Error('Unbalanced JSON in model reply');
  }

  /** Sanitise model output into ProductLab concept objects. */
  function normalizeConcepts(parsed, origin) {
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.concepts) ? parsed.concepts : []);
    const asIds = (a, re) => (Array.isArray(a) ? a : []).map((x) => String(x).trim().toUpperCase()).filter((x) => re.test(x)).slice(0, 8);
    return list.slice(0, 10).map((c) => ({
      name: clip(c.name || 'Untitled concept', 80),
      tagline: clip(c.tagline || '', 160),
      description: clip(c.description || '', 900),
      origin: origin || 'ai',
      needs: asIds(c.needs, /^N\d+$/),
      claims: (Array.isArray(c.claims) ? c.claims : []).slice(0, 8).map((cl) => (typeof cl === 'string'
        ? { text: clip(cl, 400), evidence: [] }
        : { text: clip(cl.text || cl.claim || '', 400), evidence: asIds(cl.evidence || cl.citations, /^[A-Z]{1,3}\d+$/) }))
        .filter((cl) => cl.text)
    })).filter((c) => c.name);
  }

  /* Gemini models suggested in Settings. Free-tier limits are set per Google
     project and shown in Google AI Studio; Flash-Lite allows more requests. */
  const GEMINI_MODELS = [
    { id: 'gemini-3.8-flash', note: 'best quality; lower free limits' },
    { id: 'gemini-3.6-flash', note: 'previous Flash' },
    { id: 'gemini-3.5-flash-lite', note: 'faster; higher free limits' }
  ];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Seconds Google asks us to wait, from a 429 body ("retryDelay": "17s"), if any. */
  function retryDelay(data) {
    const d = ((data && data.error && data.error.details) || []).find((x) => x && x.retryDelay);
    const m = d && String(d.retryDelay).match(/([\d.]+)s/);
    return m ? Number(m[1]) : null;
  }

  /** Turn a provider error into something a non-expert can act on. */
  function explain(status, message, model) {
    const msg = String(message || '');
    if (/API key not valid|API_KEY_INVALID|invalid api key|Incorrect API key/i.test(msg) || status === 401) return 'The AI provider did not accept the key. Check it in Settings (Gemini keys start with "AIza").';
    if (status === 404 || /not found|is not supported/i.test(msg)) return 'The model "' + model + '" is not available to this key. In Settings, try gemini-3.8-flash or gemini-3.5-flash-lite.';
    if (status === 429 && /per ?day|PerDay|daily/i.test(msg)) return 'Today\u2019s free quota for ' + model + ' is used up. It resets at midnight US Pacific time. Meanwhile, switch the model to gemini-3.5-flash-lite in Settings, which allows more free requests.';
    if (status === 429) return 'The AI provider is limiting how fast this key can make requests. Wait a minute and run again.';
    if (status === 403) return 'This key is not allowed to use ' + model + '. Check the key\u2019s project in Google AI Studio.';
    if (status >= 500) return 'The AI provider had a temporary problem (' + status + '). Try again in a minute.';
    return 'AI provider error ' + status + ': ' + msg;
  }

  /** POST with up to two retries on rate limits and server hiccups, waiting as long as the provider asks. */
  async function send(f, url, init, s) {
    let res; let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await f(url, init);
      data = await res.json().catch(() => ({}));
      const msg = (data.error && (data.error.message || data.error)) || res.statusText;
      const daily = /per ?day|PerDay|daily/i.test(String(msg));
      if (res.ok || !(res.status === 429 || res.status === 500 || res.status === 503) || daily || attempt === 2) break;
      const wait = Math.min(60, retryDelay(data) || (attempt ? 30 : 12));
      if (typeof s.onWait === 'function') s.onWait(wait);
      await sleep((s.retryScale == null ? 1000 : s.retryScale) * wait);
    }
    return { res, data };
  }

  /** Call the configured provider. fetchImpl is injectable for tests. */
  async function chat(settings, messages, fetchImpl) {
    const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!f) throw new Error('fetch is not available in this environment');
    const s = Object.assign({ temperature: 0.7 }, settings || {});
    if (!s.model) throw new Error('No model configured');
    const base = String(s.baseUrl || '').replace(/\/+$/, '');
    let res; let data;
    if (s.provider === 'gemini') {
      if (!s.apiKey) throw new Error('Gemini needs an API key');
      const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
      const contents = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      ({ res, data } = await send(f, base + '/models/' + encodeURIComponent(s.model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: s.temperature, responseMimeType: 'application/json' } })
      }, s));
      if (!res.ok) throw new Error(explain(res.status, (data.error && data.error.message) || res.statusText, s.model));
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      return parts.map((p) => p.text || '').join('');
    }
    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;
    ({ res, data } = await send(f, base + '/chat/completions', {
      method: 'POST', headers, body: JSON.stringify({ model: s.model, messages, temperature: s.temperature })
    }, s));
    if (!res.ok) throw new Error(explain(res.status, (data.error && (data.error.message || data.error)) || res.statusText, s.model));
    return (((data.choices || [])[0] || {}).message || {}).content || '';
  }

  async function generateConcepts(project, settings, options, fetchImpl) {
    const o = Object.assign({ mode: 'grounded', count: 3 }, options || {});
    const messages = buildConceptPrompt(project, o);
    const reply = await chat(settings, messages, fetchImpl);
    return { concepts: normalizeConcepts(extractJSON(reply), o.mode === 'grounded' ? 'ai' : 'ai-baseline'), raw: reply, messages };
  }

  return { PRESETS, GEMINI_MODELS, buildConceptPrompt, extractJSON, normalizeConcepts, chat, generateConcepts, explain, retryDelay };
});
