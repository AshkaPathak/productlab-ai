/* ProductLab AI - project store with browser persistence (localStorage). */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  const KEY = 'productlab-ai:v1';
  const KEY_SECRET = 'productlab-ai:apikey';

  const DEFAULT_CRITERIA = [
    { id: 'desirability', name: 'Desirability', weight: 30, description: 'Do target users want it?' },
    { id: 'feasibility', name: 'Feasibility', weight: 20, description: 'Can the team build it?' },
    { id: 'viability', name: 'Viability', weight: 20, description: 'Can it sustain itself?' },
    { id: 'impact', name: 'Impact', weight: 20, description: 'Size of the benefit' },
    { id: 'novelty', name: 'Novelty', weight: 10, description: 'Differentiation' }
  ];

  function blankProject(meta) {
    const m = meta || {};
    return {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: m.name || 'Untitled project',
      domain: m.domain || '',
      team: m.team || [],
      challenge: m.challenge || '',
      hmw: m.hmw || '',
      caveats: '',
      glossary: [],
      references: [],
      findings: [],
      needs: [],
      personas: [],
      morph: { params: [], rules: [] },
      concepts: [],
      criteria: JSON.parse(JSON.stringify(DEFAULT_CRITERIA)),
      ratings: {},
      competitors: [],
      position: { x: 8, y: 8 },
      selectedConcept: null,
      features: [],
      plan: { teamSize: 3, sprintWeeks: 2, focus: 0.6, buffer: 0.2 },
      constraints: { platform: 'mobile', offline: false, sensitiveData: false, ai: 'rules', wearables: false, realtime: false, budget: 'low', skills: ['javascript'], expectedUsers: 1000, region: 'India' },
      bmc: {},
      risks: [],
      ideas: [],
      experiment: { entries: [], ratings: [], key: [], seed: 2026 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /** Fill in any missing fields so older or hand-written files keep working. */
  function normalize(p) {
    const base = blankProject();
    const out = Object.assign({}, base, p || {});
    ['glossary', 'references', 'findings', 'needs', 'personas', 'concepts', 'criteria', 'competitors', 'features', 'risks', 'ideas', 'team'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = base[k]; });
    out.morph = Object.assign({ params: [], rules: [] }, out.morph || {});
    out.plan = Object.assign({}, base.plan, out.plan || {});
    out.constraints = Object.assign({}, base.constraints, out.constraints || {});
    out.experiment = Object.assign({}, base.experiment, out.experiment || {});
    out.position = Object.assign({}, base.position, out.position || {});
    out.ratings = out.ratings || {};
    out.bmc = out.bmc || {};
    if (!out.id) out.id = base.id;
    return out;
  }

  function samples() {
    const list = [];
    if (PL.cases && PL.cases.pcos) list.push(normalize(PL.cases.pcos()));
    if (PL.cases && PL.cases.foodwaste) list.push(normalize(PL.cases.foodwaste()));
    return list;
  }

  function safeGet(storage, key) { try { return storage.getItem(key); } catch (e) { return null; } }
  function safeSet(storage, key, val) { try { storage.setItem(key, val); return true; } catch (e) { return false; } }
  function safeDel(storage, key) { try { storage.removeItem(key); } catch (e) { /* ignore */ } }

  const state = {
    projects: [],
    currentId: null,
    ui: {},
    settings: { ai: { preset: 'gemini', provider: 'gemini', baseUrl: PL.llm ? PL.llm.PRESETS.gemini.baseUrl : '', model: PL.llm ? PL.llm.PRESETS.gemini.model : '', remember: false }, guard: { strong: 0.2, weak: 0.08 } },
    apiKey: '',
    persisted: true
  };

  function load() {
    const rawData = safeGet(root.localStorage, KEY);
    let data = null;
    if (rawData) { try { data = JSON.parse(rawData); } catch (e) { data = null; } }
    if (data && Array.isArray(data.projects) && data.projects.length) {
      state.projects = data.projects.map(normalize);
      state.currentId = data.currentId;
      state.ui = data.ui || {};
      state.settings = Object.assign(state.settings, data.settings || {});
      state.settings.ai = Object.assign({}, state.settings.ai, (data.settings || {}).ai || {});
      state.settings.guard = Object.assign({ strong: 0.2, weak: 0.08 }, (data.settings || {}).guard || {});
    } else {
      state.projects = samples();
      state.currentId = state.projects.length ? state.projects[0].id : null;
    }
    state.apiKey = safeGet(root.sessionStorage, KEY_SECRET) || safeGet(root.localStorage, KEY_SECRET) || '';
    if (!state.projects.find((p) => p.id === state.currentId)) state.currentId = state.projects[0] ? state.projects[0].id : null;
  }

  function save() {
    const ok = safeSet(root.localStorage, KEY, JSON.stringify({ projects: state.projects, currentId: state.currentId, ui: state.ui, settings: state.settings }));
    state.persisted = ok;
    return ok;
  }

  function setApiKey(key, remember) {
    state.apiKey = key || '';
    safeDel(root.localStorage, KEY_SECRET);
    safeDel(root.sessionStorage, KEY_SECRET);
    if (key) safeSet(remember ? root.localStorage : root.sessionStorage, KEY_SECRET, key);
  }

  function current() { return state.projects.find((p) => p.id === state.currentId) || null; }

  function addProject(p) {
    const n = normalize(p);
    if (state.projects.find((x) => x.id === n.id)) n.id = blankProject().id;
    state.projects.push(n);
    state.currentId = n.id;
    save();
    return n;
  }

  function removeProject(id) {
    state.projects = state.projects.filter((p) => p.id !== id);
    if (state.currentId === id) state.currentId = state.projects[0] ? state.projects[0].id : null;
    save();
  }

  function resetSamples() {
    const fresh = samples();
    fresh.forEach((s) => {
      const i = state.projects.findIndex((p) => p.id === s.id);
      if (i >= 0) state.projects[i] = s; else state.projects.push(s);
    });
    save();
  }

  PL.store = { state, load, save, current, addProject, removeProject, resetSamples, blankProject, normalize, setApiKey, DEFAULT_CRITERIA };
})(typeof globalThis !== 'undefined' ? globalThis : this);
