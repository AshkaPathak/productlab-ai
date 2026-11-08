/*
 * ProductLab AI - automated research
 * Turns a problem statement into evidence with real sources:
 *  - scholarly papers from OpenAlex (free, no key needed for light use);
 *    findings are sentences extracted verbatim from the abstracts
 *  - optional web research through Gemini's Google Search grounding; only
 *    statements the API links to a web source are kept
 * Nothing in the evidence base is written from model memory.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./text.js'));
  else (root.PL = root.PL || {}).research = factory(root.PL.text);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  const OPENALEX = 'https://api.openalex.org/works';

  function getFetch(f) {
    const fn = f || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fn) throw new Error('fetch is not available');
    return fn;
  }

  /** OpenAlex stores abstracts as {word: [positions]}. */
  function reconstructAbstract(inv) {
    if (!inv || typeof inv !== 'object') return '';
    const words = [];
    Object.keys(inv).forEach((w) => (inv[w] || []).forEach((pos) => { words[pos] = w; }));
    return words.filter((w) => w != null).join(' ').replace(/\s+([,.;:!?%)])/g, '$1').replace(/\(\s+/g, '(').trim();
  }

  function splitSentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+(?=[A-Z0-9(“"])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Normalise an OpenAlex work into a ProductLab reference. */
  function normalizeWork(w) {
    const title = w.display_name || w.title || '';
    const loc = w.primary_location || {};
    const src = loc.source || {};
    const b = w.biblio || {};
    const isReview = /systematic review|meta-analy|scoping review|guideline|umbrella review/i.test(title) || w.type === 'review';
    const isPreprint = w.type === 'preprint' || /arxiv|biorxiv|medrxiv|ssrn|preprint/i.test(src.display_name || '');
    const doi = w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : '';
    return {
      type: isReview ? 'review' : 'journal',
      strength: isReview ? 3 : isPreprint ? 1 : 2,
      authors: (w.authorships || []).slice(0, 7).map((a) => (a.author && a.author.display_name) || '').filter(Boolean),
      title: title.replace(/<[^>]+>/g, ''),
      venue: src.display_name || '',
      year: w.publication_year || undefined,
      volume: b.volume || undefined,
      issue: b.issue || undefined,
      pages: b.first_page ? (b.last_page && b.last_page !== b.first_page ? b.first_page + '-' + b.last_page : b.first_page) : undefined,
      doi: doi || undefined,
      url: doi ? undefined : (loc.landing_page_url || w.id || undefined),
      citedBy: w.cited_by_count || 0,
      openalex: w.id,
      abstract: reconstructAbstract(w.abstract_inverted_index)
    };
  }

  /** Search OpenAlex for works with abstracts. */
  async function searchOpenAlex(query, options) {
    const o = Object.assign({ perPage: 8, apiKey: '', fetch: null }, options || {});
    const f = getFetch(o.fetch);
    const params = new URLSearchParams({
      search: query,
      'per-page': String(o.perPage),
      filter: 'has_abstract:true',
      select: 'id,doi,display_name,publication_year,authorships,primary_location,abstract_inverted_index,cited_by_count,type,biblio'
    });
    if (o.apiKey) params.set('api_key', o.apiKey);
    const res = await f(OPENALEX + '?' + params.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const msg = res.status === 429 ? 'OpenAlex daily limit reached — add a free OpenAlex API key in Settings or try tomorrow' : 'OpenAlex error ' + res.status;
      throw new Error(msg);
    }
    const data = await res.json();
    return (data.results || []).map(normalizeWork).filter((w) => w.title && w.abstract && w.abstract.split(' ').length > 20);
  }

  const RESULT_CUE = /\b(found|find|finds|show(ed|s|n)?|reveal(ed|s)?|report(ed|s)?|associated|significant(ly)?|increase[ds]?|decrease[ds]?|majority|most|more likely|less likely|predict(ed|s)?|prevalence|percent|participants|respondents|users)\b|%|\d/i;
  const METHOD_CUE = /^(this|the present|the current|our|in this) (study|paper|article|research|work|review)|\b(aim(ed|s)? to|objective(s)? (was|were|is)|we (conducted|used|propose|present|developed|describe|performed)|method(s|ology)?:|background:|purpose:|keywords?:)|copyright|©|all rights reserved/i;

  /**
   * Extract the most relevant result sentences from abstracts.
   * Returns [{refIndex, text, score, kind}] with text quoted verbatim.
   */
  function extractFindings(works, problem, options) {
    const o = Object.assign({ max: 24, perWork: 2, synonyms: null, minWords: 8, maxWords: 60 }, options || {});
    const cands = [];
    works.forEach((w, wi) => splitSentences(w.abstract).forEach((s, si) => {
      const n = s.split(/\s+/).length;
      if (n < o.minWords || n > o.maxWords) return;
      cands.push({ id: wi + ':' + si, refIndex: wi, text: s });
    }));
    if (!cands.length) return [];
    const corpus = new T.Corpus(cands.map((c) => ({ id: c.id, text: c.text })), { synonyms: o.synonyms || undefined });
    const q = corpus.vectorize(problem);
    cands.forEach((c) => {
      let s = T.cosine(q, corpus.vector(c.id));
      if (RESULT_CUE.test(c.text)) s += 0.05;
      if (/\d/.test(c.text)) s += 0.04;
      if (METHOD_CUE.test(c.text)) s -= 0.12;
      c.score = s;
    });
    const perWork = new Map();
    const picked = [];
    cands.slice().sort((a, b) => b.score - a.score).forEach((c) => {
      if (picked.length >= o.max || c.score < 0.03) return;
      const k = perWork.get(c.refIndex) || 0;
      if (k >= o.perWork) return;
      perWork.set(c.refIndex, k + 1);
      picked.push(c);
    });
    return picked.map((c) => ({ refIndex: c.refIndex, text: c.text, score: c.score, kind: /\d/.test(c.text) ? 'statistic' : 'insight' }));
  }

  /* ---------------- Web research via Gemini grounding ---------------- */

  const WEB_PROMPT = (problem) => 'Research this problem with Google Search: "' + problem + '".\n\n' +
    'Write 12-18 short factual statements, one per line, each starting with "- ". Each statement must be a single checkable fact from a source you found, ' +
    'with numbers where available. Cover: who is affected and how many; user behaviour and pain points; existing products or services and their limitations; ' +
    'regulations or standards; relevant technology. Do not give advice or opinions.';

  function domainOf(uri, title) {
    if (title && /\./.test(title) && !/\s/.test(title)) return title;
    try { return new URL(uri).hostname.replace(/^www\./, ''); } catch (e) { return title || 'web source'; }
  }

  /**
   * Ask Gemini with the google_search tool and keep only the text segments
   * that groundingSupports links to web sources.
   * Returns {sources:[{title, url, org}], findings:[{text, sourceIndexes:[]}], queries}
   */
  async function webResearch(problem, settings, options) {
    const o = Object.assign({ fetch: null }, options || {});
    const s = settings || {};
    if (s.provider !== 'gemini' || !s.apiKey) throw new Error('Web research needs a Google Gemini API key');
    const f = getFetch(o.fetch);
    const base = String(s.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const res = await f(base + '/models/' + encodeURIComponent(s.model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: WEB_PROMPT(problem) }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.2 } })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Gemini web search error ' + res.status + ': ' + ((data.error && data.error.message) || res.statusText));
    const cand = (data.candidates || [])[0] || {};
    const gm = cand.groundingMetadata || {};
    const chunks = (gm.groundingChunks || []).map((c) => c.web || {}).map((w) => ({ url: w.uri || '', title: w.title || '', org: domainOf(w.uri, w.title) }));
    const findings = [];
    const seen = new Set();
    (gm.groundingSupports || []).forEach((sup) => {
      const idx = (sup.groundingChunkIndices || []).filter((i) => chunks[i]);
      const text = String((sup.segment && sup.segment.text) || '').replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').trim();
      if (!idx.length || text.split(' ').length < 6 || seen.has(text)) return;
      seen.add(text);
      findings.push({ text, sourceIndexes: idx });
    });
    return { sources: chunks, findings, queries: gm.webSearchQueries || [] };
  }

  return { OPENALEX, reconstructAbstract, splitSentences, normalizeWork, searchOpenAlex, extractFindings, webResearch, WEB_PROMPT };
});
