/*
 * ProductLab AI - autopilot
 * From a single problem statement to a complete, evidence-linked project:
 *   1. plan       refine the problem, How Might We, search queries
 *   2. research   real sources (OpenAlex papers + optional grounded web search)
 *   3. users      needs, proto-personas, domain vocabulary, competitors
 *   4. ideas      morphological parameters and evidence-grounded concepts
 *   5. evaluate   AI-suggested decision-matrix ratings and risks (for the team to review)
 *   6. build      features (RICE), constraints -> tech stack, business model
 * Every generated statement must cite evidence IDs; the citation guard audits
 * the result. The team decides which concept to pursue; buildPlan() can be
 * re-run for any concept.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./text.js'), require('./llm.js'), require('./research.js'), require('./cluster.js'), require('./evidence.js'), require('./decision.js'));
  } else (root.PL = root.PL || {}).autopilot = factory(root.PL.text, root.PL.llm, root.PL.research, root.PL.cluster, root.PL.evidence, root.PL.decision);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T, L, R, CL, E, D) {
  'use strict';

  const STEPS = [
    { id: 'plan', label: 'Understand the problem' },
    { id: 'research', label: 'Research real sources' },
    { id: 'users', label: 'Identify users and needs' },
    { id: 'ideas', label: 'Generate concepts' },
    { id: 'evaluate', label: 'Score concepts (decision matrix)' },
    { id: 'build', label: 'Plan features and tech stack' }
  ];

  const CRITERIA = [
    { id: 'desirability', name: 'Desirability', weight: 30, description: 'Do target users want it?' },
    { id: 'feasibility', name: 'Feasibility', weight: 20, description: 'Can a small team build it?' },
    { id: 'viability', name: 'Viability', weight: 20, description: 'Can it sustain itself (business, regulation)?' },
    { id: 'impact', name: 'Impact', weight: 20, description: 'Size of the benefit' },
    { id: 'novelty', name: 'Novelty', weight: 10, description: 'Differentiation from existing solutions' }
  ];

  const SYSTEM = 'You are a careful product strategist and researcher. Reply with valid JSON only, no commentary. ' +
    'When evidence is listed, every claim must cite evidence IDs from that list (e.g. "E3"). Never invent IDs, statistics, sources or quotes.';

  const clip = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const ids = (a, re) => (Array.isArray(a) ? a : typeof a === 'string' ? a.split(/[,\s]+/) : []).map((x) => String(x).trim().toUpperCase()).filter((x) => re.test(x)).slice(0, 8);
  const EID = /^E\d+$/; const NID = /^N\d+$/;

  async function ask(settings, user, f) {
    const reply = await L.chat(Object.assign({ temperature: 0.4 }, settings), [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], f);
    return L.extractJSON(reply);
  }

  function evidenceList(project, max) {
    return project.findings.slice(0, max || 60).map((x) => x.id + ': ' + clip(x.text, 280)).join('\n');
  }
  function needList(project) { return project.needs.map((n) => n.id + ': ' + n.statement).join('\n'); }

  /* ---------------- step 1: plan ---------------- */

  /* Without a model: turn "I need an app that helps me get there faster" into a
     short name ("Get there faster") and a proper How-might-we question. */
  function problemCore(problem) {
    const first = String(problem || '').split(/(?<=[.?!])\s+|\n/)[0].replace(/[.?!]+$/, '').trim();
    const core = first
      .replace(/^(i|we)\s+(really\s+)?(need|want|would like|wish for)\s+/i, '')
      .replace(/^(need|want)\s+/i, '')
      .replace(/^(a|an|some)\s+(\w+\s+){0,2}?(tool|app|application|platform|website|site|system|product|service|way)(\s+or\s+(a|an)\s+(\w+\s+){0,2}?(tool|app|application|platform|website|site|system|product|service))?\s+(that|which|to)\s+/i, '')
      .replace(/^(helps?|lets?|allows?)\s+(me|us|people|users|students|everyone)\s+(to\s+)?/i, '')
      .trim();
    const changed = core.length && core.length < first.length;
    return { first, core: core || first, changed };
  }

  function fallbackPlan(problem) {
    const words = T.normalize(problem).split(' ').filter((w) => w.length > 2 && !T.STOPWORDS.has(w));
    const q = words.slice(0, 7).join(' ');
    const c = problemCore(problem);
    // stop at the first natural break (a comma, "but", "and", "so") when it comes early enough
    const clause = c.core.split(/,|;|\s+(?:but|and|so|because|while)\s+/i)[0];
    const shortWords = (clause.split(/\s+/).length >= 2 ? clause : c.core).split(/\s+/).slice(0, 7).join(' ').replace(/[,;:]+$/, '');
    const personal = (t) => t.replace(/\bme\s+(?=(destination|home|work|office|place|goal|way|money|time)\b)/gi, 'their ').replace(/\b(me|myself)\b/gi, 'them').replace(/\bmy\b/gi, 'their').replace(/\bi\b/g, 'they');
    const name = personal(shortWords).replace(/^./, (x) => x.toUpperCase());
    const hmw = c.changed
      ? 'How might we help people ' + personal(clip(c.core, 150)).replace(/^./, (x) => x.toLowerCase()) + '?'
      : 'How might we address this: ' + clip(c.first, 150).replace(/^./, (x) => x.toLowerCase()) + '?';
    return { name: clip(name, 60), domain: '', challenge: problem, hmw, queries: [q] };
  }

  async function plan(problem, settings, f) {
    const j = await ask(settings, 'Problem statement: "' + clip(problem, 1200) + '"\n\nReturn JSON with keys:\n' +
      '"name": short project name (max 8 words),\n"domain": the field (e.g. "Digital wellbeing"),\n' +
      '"challenge": the problem restated in 2 sentences (who is affected, what goes wrong),\n"hmw": one "How might we ...?" question,\n' +
      '"queries": 3 or 4 short search queries (3-6 words each) to find academic papers about these users, their behaviour and existing solutions.', f);
    const fb = fallbackPlan(problem);
    const queries = (Array.isArray(j.queries) ? j.queries : []).map((x) => clip(x, 80)).filter(Boolean).slice(0, 4);
    return { name: clip(j.name || fb.name, 80), domain: clip(j.domain || '', 60), challenge: clip(j.challenge || problem, 800), hmw: clip(j.hmw || fb.hmw, 300), queries: queries.length ? queries : fb.queries };
  }

  /* ---------------- step 2: research ---------------- */

  /**
   * Leave out papers that share words with the problem but are about something
   * else (for example HIV testing when the problem is exam stress). With a
   * model connected it reads the titles and openings; otherwise a word-match
   * check is used. Never leaves fewer than three papers.
   */
  async function screenPapers(works, problemText, settings, f, log) {
    if (works.length < 4) return works.slice();
    let keep = null;
    if (hasModel(settings)) {
      try {
        const listing = works.map((w, i) => (i + 1) + '. ' + w.title + ' \u2014 ' + clip(w.abstract || '', 220)).join('\n');
        const j = await ask(settings, 'Problem: ' + problemText + '\n\nPapers:\n' + listing + '\n\n' +
          'Which papers are directly about this problem, the people who have it or ways to address it? Leave out papers about a different topic, even if they share words. ' +
          'Return JSON {"relevant": [paper numbers]}.', f);
        const nums = j && Array.isArray(j.relevant) ? j.relevant.map(Number).filter((x) => x >= 1 && x <= works.length) : [];
        if (nums.length >= 3) keep = Array.from(new Set(nums)).map((x) => x - 1);
      } catch (e) { log('Paper screening skipped: ' + e.message); }
    }
    if (!keep) keep = R.screenWorks(works, problemText);
    if (keep.length < 3) return works.slice();
    const dropped = works.filter((w, i) => keep.indexOf(i) < 0);
    if (dropped.length) log('Left out ' + n(dropped.length, 'paper', 'papers') + ' about a different topic: ' + dropped.slice(0, 3).map((w) => '\u201c' + clip(w.title, 70) + '\u201d').join('; ') + (dropped.length > 3 ? ' and more' : '') + '.');
    return works.filter((w, i) => keep.indexOf(i) >= 0);
  }

  async function research(problem, planOut, settings, opts, f, log) {
    const refs = []; const findings = [];
    const works = []; const seen = new Set();
    for (const q of planOut.queries) {
      try {
        const list = await R.searchOpenAlex(q, { perPage: opts.papersPerQuery || 8, apiKey: opts.openAlexKey, fetch: f });
        list.forEach((w) => { const k = (w.doi || w.title).toLowerCase(); if (!seen.has(k)) { seen.add(k); works.push(w); } });
        log('Papers for “' + q + '”: ' + list.length);
      } catch (e) { log('Paper search failed for “' + q + '”: ' + e.message); if (/limit/.test(e.message)) break; }
    }
    const kept = await screenPapers(works, problem + ' ' + planOut.challenge, settings, f, log);
    const extracted = R.extractFindings(kept, problem + ' ' + planOut.challenge, { max: opts.maxPaperFindings || 24, perWork: 2 });
    works.length = 0; kept.forEach((w) => works.push(w));
    const used = Array.from(new Set(extracted.map((x) => x.refIndex)));
    const refIdOf = new Map();
    used.forEach((wi) => {
      const w = works[wi]; const id = 'R' + (refs.length + 1);
      refIdOf.set(wi, id);
      const ref = Object.assign({ id }, w); delete ref.abstract; delete ref.citedBy; delete ref.openalex;
      Object.keys(ref).forEach((k) => ref[k] === undefined && delete ref[k]);
      refs.push(ref);
    });
    extracted.forEach((x) => findings.push({ id: 'E' + (findings.length + 1), ref: refIdOf.get(x.refIndex), kind: x.kind, text: x.text, tags: [], locator: 'Abstract (verbatim)' }));

    if (opts.web && settings && settings.provider === 'gemini' && settings.apiKey) {
      try {
        const web = await R.webResearch(problem, settings, { fetch: f });
        const srcId = new Map();
        web.findings.slice(0, opts.maxWebFindings || 16).forEach((wf) => {
          const si = wf.sourceIndexes[0];
          if (!srcId.has(si)) {
            const s = web.sources[si]; const id = 'R' + (refs.length + 1);
            refs.push({ id, type: 'web', strength: 1, org: s.org, title: 'Web source found by Google Search grounding (' + s.org + ')', venue: s.org, url: s.url, accessed: new Date().toISOString().slice(0, 10) });
            srcId.set(si, id);
          }
          findings.push({ id: 'E' + (findings.length + 1), ref: srcId.get(si), kind: /\d/.test(wf.text) ? 'statistic' : 'insight', text: wf.text, tags: [], locator: 'Web (grounded)' });
        });
        log('Web facts linked to sources: ' + web.findings.length + (web.queries.length ? ' (searches: ' + web.queries.slice(0, 3).join('; ') + ')' : ''));
      } catch (e) { log('Web research skipped: ' + e.message); }
    }
    return { refs, findings };
  }

  /* ---------------- step 3: users, needs, vocabulary, competitors ---------------- */

  async function users(project, settings, f) {
    const j = await ask(settings, 'Problem: ' + project.challenge + '\n\nEvidence (cite by ID):\n' + evidenceList(project) + '\n\nReturn JSON with keys:\n' +
      '"needs": 4-7 objects {"statement": "<who> needs <what> (because ...)", "severity": 1-5, "evidence": ["E#"]} grounded in the evidence;\n' +
      '"personas": 3 objects {"name": a descriptive label such as "The busy commuter" (not a real person), "role": one line, "goals": [2 short goals], "pains": [2-3 objects {"text", "evidence": ["E#"]}]};\n' +
      '"glossary": 5-8 arrays of words that mean the same thing in this domain (e.g. ["save","bookmark","collect"]);\n' +
      '"competitors": up to 5 existing products or product categories {"name","category","x": 0-10 solution breadth,"y": 0-10 how well it meets the needs,"strengths","gaps","evidence": ["E#"]}. ' +
      'Use an empty evidence array if the evidence does not mention them.', f);
    const needs = (Array.isArray(j.needs) ? j.needs : []).slice(0, 8).map((n, i) => ({ id: 'N' + (i + 1), statement: clip(n.statement || n.need || '', 300), severity: Math.round(num(n.severity, 1, 5, 3)), evidence: ids(n.evidence, EID) })).filter((n) => n.statement);
    const personas = (Array.isArray(j.personas) ? j.personas : []).slice(0, 4).map((p, i) => ({
      id: 'P' + (i + 1), name: clip(p.name || 'Persona ' + (i + 1), 60), role: clip(p.role || '', 160), note: 'proto-persona drafted from the evidence – validate with interviews',
      goals: (Array.isArray(p.goals) ? p.goals : []).map((g) => clip(g, 100)).slice(0, 4),
      pains: (Array.isArray(p.pains) ? p.pains : []).slice(0, 4).map((x) => (typeof x === 'string' ? { text: clip(x, 240), evidence: [] } : { text: clip(x.text || '', 240), evidence: ids(x.evidence, EID) })).filter((x) => x.text)
    }));
    const glossary = (Array.isArray(j.glossary) ? j.glossary : []).filter(Array.isArray).map((g) => g.map((w) => clip(w, 30)).filter(Boolean).slice(0, 10)).filter((g) => g.length > 1).slice(0, 10);
    const competitors = (Array.isArray(j.competitors) ? j.competitors : []).slice(0, 6).map((c, i) => ({ id: 'K' + (i + 1), name: clip(c.name || '', 60), category: clip(c.category || '', 80), x: num(c.x, 0, 10, 5), y: num(c.y, 0, 10, 5), strengths: clip(c.strengths || '', 200), gaps: clip(c.gaps || '', 200), evidence: ids(c.evidence, EID) })).filter((c) => c.name);
    return { needs, personas, glossary, competitors };
  }

  function needsFromThemes(project) {
    const idx = E.buildIndex(project);
    return CL.themes(project, idx, { threshold: 0.12 }).filter((t) => t.members.length > 1).slice(0, 6).map((t, i) => ({
      id: 'N' + (i + 1), statement: 'Evidence theme to turn into a need statement: ' + t.terms.join(', ') + '.', severity: 3, evidence: t.members.slice(0, 5)
    }));
  }

  /* ---------------- step 4: ideas ---------------- */

  async function morph(project, settings, f) {
    const j = await ask(settings, 'Problem: ' + project.challenge + '\nNeeds:\n' + needList(project) + '\n\nDesign a morphological analysis (Zwicky box) for solutions. Return JSON with keys:\n' +
      '"params": 4 or 5 objects {"name": a solution dimension, "options": exactly 3 objects {"label": short option, "hint": 4-8 keywords linking the option to the needs}};\n' +
      '"rules": 1-3 objects {"a": [paramIndex, optionIndex], "b": [paramIndex, optionIndex], "reason": why these two options cannot be combined} (indexes start at 0).', f);
    const params = (Array.isArray(j.params) ? j.params : []).slice(0, 6).map((p, i) => ({
      id: 'M' + (i + 1), name: clip(p.name || 'Parameter ' + (i + 1), 40),
      options: (Array.isArray(p.options) ? p.options : []).slice(0, 4).map((o) => (typeof o === 'string' ? { label: clip(o, 50), hint: '' } : { label: clip(o.label || '', 50), hint: clip(o.hint || '', 120) })).filter((o) => o.label)
    })).filter((p) => p.options.length >= 2);
    const rules = [];
    (Array.isArray(j.rules) ? j.rules : []).forEach((r) => {
      const pa = params[Number((r.a || [])[0])]; const pb = params[Number((r.b || [])[0])];
      const oa = pa && pa.options[Number(r.a[1])]; const ob = pb && pb.options[Number(r.b[1])];
      if (pa && pb && oa && ob && pa !== pb) rules.push({ a: [pa.id, oa.label], b: [pb.id, ob.label], reason: clip(r.reason || 'Incompatible', 160) });
    });
    return { params, rules };
  }

  /* ---------------- step 5: evaluate ---------------- */

  async function evaluate(project, settings, f) {
    const list = project.concepts.map((c) => c.id + ': ' + c.name + ' – ' + clip(c.description || c.tagline, 300)).join('\n');
    const j = await ask(settings, 'Problem: ' + project.challenge + '\nNeeds:\n' + needList(project) + '\nEvidence (cite by ID):\n' + evidenceList(project, 40) + '\n\nConcepts:\n' + list + '\n\n' +
      'Criteria: ' + CRITERIA.map((c) => c.id + ' (' + c.description + ')').join('; ') + '.\n' +
      'Score each concept 1-5 (one decimal) on every criterion. Be critical and differentiate between concepts; the team will review your scores. Return JSON with keys:\n' +
      '"ratings": {"C1": {"desirability": {"value": 4.2, "note": "one sentence why", "evidence": ["E#"]}, ...}, ...};\n' +
      '"risks": 4-6 failure modes for the strongest concepts (inverse thinking) {"failure","cause","likelihood": 1-5,"impact": 1-5,"mitigation","evidence": ["E#"]}.', f);
    const ratings = {};
    project.concepts.forEach((c) => {
      const src = (j.ratings || {})[c.id] || {};
      ratings[c.id] = {};
      CRITERIA.forEach((k) => {
        const r = src[k.id];
        const value = typeof r === 'object' && r ? r.value : r;
        ratings[c.id][k.id] = { value: Math.round(num(value, 1, 5, 3) * 10) / 10, note: r && typeof r === 'object' ? clip(r.note || '', 240) : '', evidence: r && typeof r === 'object' ? ids(r.evidence, EID) : [] };
      });
    });
    const risks = (Array.isArray(j.risks) ? j.risks : []).slice(0, 8).map((r, i) => ({ id: 'X' + (i + 1), failure: clip(r.failure || '', 200), cause: clip(r.cause || '', 240), likelihood: Math.round(num(r.likelihood, 1, 5, 3)), impact: Math.round(num(r.impact, 1, 5, 3)), mitigation: clip(r.mitigation || '', 240), evidence: ids(r.evidence, EID) })).filter((r) => r.failure);
    return { ratings, risks };
  }

  /* ---------------- step 6: build plan (re-runnable for any concept) ---------------- */

  const BMC_KEYS = ['customerSegments', 'valuePropositions', 'channels', 'customerRelationships', 'revenueStreams', 'keyResources', 'keyActivities', 'keyPartners', 'costStructure'];

  async function buildPlan(project, conceptId, settings, f) {
    const c = project.concepts.find((x) => x.id === conceptId) || project.concepts[0];
    if (!c) throw new Error('No concept to plan');
    const j = await ask(settings, 'Problem: ' + project.challenge + '\nNeeds:\n' + needList(project) + '\nEvidence (cite by ID):\n' + evidenceList(project, 40) + '\n\n' +
      'Selected concept: ' + c.name + ' – ' + clip(c.description, 500) + '\nClaims:\n' + (c.claims || []).map((x) => '- ' + x.text).join('\n') + '\n\n' +
      'Plan a minimum viable product for a student team of 3. Return JSON with keys:\n' +
      '"features": 6-10 objects {"name","description","rationale": why the evidence justifies it,"evidence": ["E#"],"needs": ["N#"],"reach": 0-100 (% of target users),"impact": one of 0.25, 0.5, 1, 2, 3,"confidence": 0-100,"effort": person-weeks,"moscow": "Must"|"Should"|"Could"|"Won\'t","dependsOn": [names of other features]};\n' +
      '"constraints": {"platform": "mobile"|"web"|"both","offline": true|false,"sensitiveData": true|false,"ai": "none"|"rules"|"ml"|"llm","wearables": true|false,"realtime": true|false,"budget": "low"|"medium"|"high","expectedUsers": number in the first year,"region": country or region};\n' +
      '"bmc": Business Model Canvas with keys ' + BMC_KEYS.join(', ') + ' (one or two sentences each).', f);
    const raw = (Array.isArray(j.features) ? j.features : []).slice(0, 12);
    const features = raw.map((x, i) => ({
      id: 'F' + (i + 1), name: clip(x.name || 'Feature ' + (i + 1), 80), description: clip(x.description || '', 240), rationale: clip(x.rationale || '', 300),
      evidence: ids(x.evidence, EID), needs: ids(x.needs, NID), reach: Math.round(num(x.reach, 0, 100, 50)),
      impact: [0.25, 0.5, 1, 2, 3].reduce((b, v) => (Math.abs(v - Number(x.impact)) < Math.abs(b - Number(x.impact)) ? v : b), 1),
      confidence: Math.round(num(x.confidence, 0, 100, 50)), effort: Math.round(num(x.effort, 0.5, 26, 2) * 2) / 2,
      moscow: ['Must', 'Should', 'Could', "Won't"].includes(x.moscow) ? x.moscow : 'Should', _deps: Array.isArray(x.dependsOn) ? x.dependsOn : []
    }));
    const byName = new Map(features.map((x) => [x.name.toLowerCase(), x.id]));
    features.forEach((x) => {
      x.dependsOn = x._deps.map((d) => byName.get(String(d).toLowerCase()) || (/^F\d+$/i.test(d) ? String(d).toUpperCase() : null)).filter((d) => d && d !== x.id);
      delete x._deps;
    });
    const k = j.constraints || {};
    const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
    const constraints = {
      platform: pick(k.platform, ['mobile', 'web', 'both'], 'mobile'), offline: !!k.offline, sensitiveData: !!k.sensitiveData,
      ai: pick(k.ai, ['none', 'rules', 'ml', 'llm'], 'rules'), wearables: !!k.wearables, realtime: !!k.realtime, budget: pick(k.budget, ['low', 'medium', 'high'], 'low'),
      skills: (project.constraints && project.constraints.skills) || ['javascript', 'typescript'], expectedUsers: Math.round(num(k.expectedUsers, 10, 1e8, 1000)), region: clip(k.region || 'India', 40)
    };
    const bmc = {};
    BMC_KEYS.forEach((key) => { if (j.bmc && j.bmc[key]) bmc[key] = clip(j.bmc[key], 400); });
    return { conceptId: c.id, features, constraints, bmc };
  }

  /* ---------------- orchestration ---------------- */

  function hasModel(settings) {
    return !!(settings && settings.model && (settings.apiKey || /localhost|127\.0\.0\.1/.test(settings.baseUrl || '')));
  }

  /**
   * Run the whole pipeline. opts: {web, papersPerQuery, openAlexKey, fetch, onStep(id, status, detail), onLog(msg)}
   * Returns a project object (plain data). Steps that need a language model are
   * skipped when none is configured; research still runs.
   */
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);

  async function run(problem, rawSettings, options) {
    const o = Object.assign({ web: true, papersPerQuery: 8, openAlexKey: '', fetch: null, onStep() {}, onLog() {} }, options || {});
    const log = (m) => o.onLog(m);
    // free AI keys allow only a few requests a minute: say so when the provider asks us to wait
    let switched = false;
    const usedModels = [];
    const settings = Object.assign({}, rawSettings, {
      onModel: (m) => { if (usedModels.indexOf(m) < 0) usedModels.push(m); },
      onWait: (sec) => log('The AI provider asked for a short pause; waiting ' + Math.round(sec) + ' seconds.'),
      onFallback: (from, to) => { if (!switched) { switched = true; log(from + ' is busy or out of free quota, so the AI steps use ' + to + ' for now.'); } }
    });
    const f = o.fetch; const ai = hasModel(settings);
    const step = (id, status, detail) => o.onStep(id, status, detail || '');
    const started = new Date();
    const project = {
      name: '', domain: '', team: [], challenge: problem, hmw: '', glossary: [], references: [], findings: [], needs: [], personas: [],
      morph: { params: [], rules: [] }, concepts: [], criteria: JSON.parse(JSON.stringify(CRITERIA)), ratings: {}, competitors: [], position: { x: 8, y: 8 },
      selectedConcept: null, features: [], plan: { teamSize: 3, sprintWeeks: 2, focus: 0.6, buffer: 0.2 },
      constraints: { platform: 'mobile', offline: false, sensitiveData: false, ai: 'rules', wearables: false, realtime: false, budget: 'low', skills: ['javascript', 'typescript'], expectedUsers: 1000, region: 'India' },
      bmc: {}, risks: [], ideas: [], experiment: { entries: [], ratings: [], key: [], seed: 2026 },
      autopilot: { problem, model: ai ? settings.model : null, ranAt: started.toISOString(), steps: {} }
    };
    const mark = (id, status, detail) => { project.autopilot.steps[id] = { status, detail }; step(id, status, detail); };

    // 1. plan
    mark('plan', 'running');
    let p;
    try { p = ai ? await plan(problem, settings, f) : fallbackPlan(problem); mark('plan', 'done', 'Search queries: ' + p.queries.join('; ')); } catch (e) { p = fallbackPlan(problem); mark('plan', 'warn', 'Used the problem text directly (' + e.message + ')'); }
    Object.assign(project, { name: p.name, domain: p.domain, challenge: p.challenge, hmw: p.hmw });

    // 2. research
    mark('research', 'running');
    const r = await research(problem, p, settings, o, f, log);
    project.references = r.refs; project.findings = r.findings;
    if (project.findings.length < 3) {
      mark('research', 'failed', 'Found only ' + project.findings.length + ' findings. Rephrase the problem with more specific words, or add evidence manually.');
      project.caveats = 'Autopilot could not find enough evidence. Add sources and findings on the Evidence page.';
      return project;
    }
    mark('research', 'done', n(project.findings.length, 'finding', 'findings') + ' from ' + n(project.references.length, 'source', 'sources'));

    // 3. users
    mark('users', 'running');
    if (ai) {
      try { Object.assign(project, await users(project, settings, f)); mark('users', 'done', n(project.needs.length, 'need', 'needs') + ', ' + n(project.personas.length, 'persona', 'personas') + ', ' + n(project.competitors.length, 'competitor', 'competitors')); } catch (e) { project.needs = needsFromThemes(project); mark('users', 'warn', 'Model step failed (' + e.message + '); needs drafted from evidence themes'); }
    } else { project.needs = needsFromThemes(project); mark('users', 'warn', 'No AI model connected: needs drafted from evidence themes only'); }

    if (!ai) {
      ['ideas', 'evaluate', 'build'].forEach((id) => mark(id, 'skipped', 'Connect an AI model in Settings to generate this automatically'));
      project.caveats = 'Research-only run (no AI model connected). Evidence comes from real sources; write needs, concepts and ratings yourself or connect a model and run autopilot again.';
      return project;
    }

    // 4. ideas
    mark('ideas', 'running');
    try {
      const m = await morph(project, settings, f).catch((e) => { log('Morphological parameters skipped: ' + e.message); return { params: [], rules: [] }; });
      project.morph = m;
      const g = await L.generateConcepts(project, settings, { mode: 'grounded', count: 4 }, f);
      project.concepts = g.concepts.map((c, i) => Object.assign(c, { id: 'C' + (i + 1), needs: ids(c.needs, NID) }));
      mark('ideas', project.concepts.length ? 'done' : 'failed', n(project.concepts.length, 'concept', 'concepts') + (m.params.length ? ' and a morphological box with ' + n(m.params.length, 'parameter', 'parameters') : ''));
    } catch (e) { mark('ideas', 'failed', e.message); }
    if (!project.concepts.length) { ['evaluate', 'build'].forEach((id) => mark(id, 'skipped', 'No concepts')); return project; }

    // 5. evaluate
    mark('evaluate', 'running');
    try {
      const ev = await evaluate(project, settings, f);
      project.ratings = ev.ratings; project.risks = ev.risks;
      const ranked = D.wdm(project.concepts, project.criteria, project.ratings);
      project.selectedConcept = ranked[0].id;
      mark('evaluate', 'done', ranked.map((x) => x.name + ' ' + x.total.toFixed(2)).join(', '));
    } catch (e) { project.selectedConcept = project.concepts[0].id; mark('evaluate', 'failed', e.message); }

    // 6. build
    mark('build', 'running');
    try {
      const b = await buildPlan(project, project.selectedConcept, settings, f);
      Object.assign(project, { features: b.features, constraints: b.constraints, bmc: b.bmc });
      mark('build', 'done', n(b.features.length, 'feature', 'features') + ' for ' + (project.concepts.find((c) => c.id === b.conceptId) || {}).name);
    } catch (e) { mark('build', 'failed', e.message); }

    const modelsUsed = usedModels.length ? usedModels : [settings.model];
    project.autopilot.model = modelsUsed.join(', ');
    project.caveats = 'Generated by ProductLab autopilot on ' + started.toISOString().slice(0, 10) + ' with ' + modelsUsed.join(' and ') + '. Findings are taken from the cited sources; needs, personas, concepts, ratings and estimates are AI drafts. Review them, then choose the concept your team wants to build.';
    return project;
  }

  return { problemCore, STEPS, CRITERIA, run, plan, research, users, morph, evaluate, buildPlan, fallbackPlan, needsFromThemes, hasModel };
});
