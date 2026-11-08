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
    gemini: { label: 'Google Gemini (free tier available)', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.5-flash' },
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
      res = await f(base + '/models/' + encodeURIComponent(s.model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: s.temperature, responseMimeType: 'application/json' } })
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Gemini error ' + res.status + ': ' + ((data.error && data.error.message) || res.statusText));
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      return parts.map((p) => p.text || '').join('');
    }
    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;
    res = await f(base + '/chat/completions', {
      method: 'POST', headers, body: JSON.stringify({ model: s.model, messages, temperature: s.temperature })
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Model error ' + res.status + ': ' + ((data.error && (data.error.message || data.error)) || res.statusText));
    return (((data.choices || [])[0] || {}).message || {}).content || '';
  }

  async function generateConcepts(project, settings, options, fetchImpl) {
    const o = Object.assign({ mode: 'grounded', count: 3 }, options || {});
    const messages = buildConceptPrompt(project, o);
    const reply = await chat(settings, messages, fetchImpl);
    return { concepts: normalizeConcepts(extractJSON(reply), o.mode === 'grounded' ? 'ai' : 'ai-baseline'), raw: reply, messages };
  }

  return { PRESETS, buildConceptPrompt, extractJSON, normalizeConcepts, chat, generateConcepts };
});
