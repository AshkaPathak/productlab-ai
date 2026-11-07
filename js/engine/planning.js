/*
 * ProductLab AI - build planning
 * Evidence-adjusted RICE prioritisation, MoSCoW suggestion, effort roll-up,
 * dependency-aware sprint scheduling (MVP roadmap) and a transparent
 * rule-based technology stack recommender.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./evidence.js'));
  else (root.PL = root.PL || {}).planning = factory(root.PL.evidence);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';

  /* ---------------- Prioritisation ---------------- */

  /**
   * RICE = Reach x Impact x Confidence / Effort  (Intercom's framework).
   * reach: % of target users affected per quarter (0-100)
   * impact: 0.25 minimal, 0.5 low, 1 medium, 2 high, 3 massive
   * confidence: 0-100 (%)
   * effort: person-weeks
   * Evidence adjustment: confidence is scaled by (0.5 + 0.5 x evidenceScore),
   * so a feature nobody can back with evidence loses up to half its confidence.
   */
  function rice(feature, evidenceScore) {
    const reach = Math.max(0, Number(feature.reach) || 0);
    const impact = Math.max(0, Number(feature.impact) || 0);
    const conf = Math.max(0, Math.min(100, Number(feature.confidence) || 0)) / 100;
    const effort = Math.max(0.1, Number(feature.effort) || 0.1);
    const raw = (reach * impact * conf) / effort;
    const ev = typeof evidenceScore === 'number' ? evidenceScore : null;
    const adjusted = ev == null ? raw : (reach * impact * conf * (0.5 + 0.5 * ev)) / effort;
    return { raw, adjusted, evidence: ev };
  }

  function prioritize(project, index) {
    const idx = index || E.buildIndex(project);
    const rows = (project.features || []).map((f) => {
      const ev = E.featureEvidenceScore(idx, f);
      return Object.assign({ feature: f }, rice(f, ev));
    });
    rows.sort((a, b) => b.adjusted - a.adjusted || String(a.feature.id).localeCompare(String(b.feature.id)));
    const n = rows.length;
    rows.forEach((r, i) => {
      r.rank = i + 1;
      const q = n ? i / n : 0;
      r.suggestedMoscow = q < 0.4 ? 'Must' : q < 0.7 ? 'Should' : q < 0.9 ? 'Could' : "Won't";
    });
    return rows;
  }

  /* ---------------- Effort and schedule ---------------- */

  /** PERT expected effort when optimistic/pessimistic estimates exist. */
  function expectedEffort(f) {
    const m = Number(f.effort) || 0;
    if (Number.isFinite(Number(f.effortMin)) && Number.isFinite(Number(f.effortMax)) && f.effortMin !== '' && f.effortMax !== '') {
      return (Number(f.effortMin) + 4 * m + Number(f.effortMax)) / 6;
    }
    return m;
  }

  const MOSCOW_ORDER = { Must: 0, Should: 1, Could: 2, "Won't": 3 };

  /** Topological order respecting dependsOn, tie-broken by MoSCoW then priority order. */
  function topoOrder(features, priority) {
    const byId = new Map(features.map((f) => [f.id, f]));
    const pos = new Map(priority.map((id, i) => [id, i]));
    const indeg = new Map(features.map((f) => [f.id, 0]));
    features.forEach((f) => (f.dependsOn || []).forEach((d) => { if (byId.has(d)) indeg.set(f.id, indeg.get(f.id) + 1); }));
    const key = (f) => [MOSCOW_ORDER[f.moscow] != null ? MOSCOW_ORDER[f.moscow] : 2, pos.has(f.id) ? pos.get(f.id) : 999];
    const cmp = (a, b) => { const ka = key(a); const kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1]; };
    const ready = features.filter((f) => indeg.get(f.id) === 0).sort(cmp);
    const out = [];
    while (ready.length) {
      const f = ready.shift();
      out.push(f);
      features.forEach((g) => {
        if ((g.dependsOn || []).includes(f.id)) {
          indeg.set(g.id, indeg.get(g.id) - 1);
          if (indeg.get(g.id) === 0) { ready.push(g); ready.sort(cmp); }
        }
      });
    }
    const cyclic = features.filter((f) => !out.includes(f)).map((f) => f.id);
    return { order: out, cyclic };
  }

  /**
   * Sprint plan. Capacity per sprint = teamSize x sprintWeeks x focus (person-weeks).
   * Features are list-scheduled in dependency order; a feature never starts
   * before all of its dependencies have finished. "Won't" features are skipped.
   */
  function schedule(project, options) {
    const o = Object.assign({ teamSize: 3, sprintWeeks: 2, focus: 0.7, buffer: 0.2, priority: null }, project.plan || {}, options || {});
    const features = (project.features || []).filter((f) => f.moscow !== "Won't");
    const priority = o.priority || features.map((f) => f.id);
    const { order, cyclic } = topoOrder(features, priority);
    const weekly = o.teamSize * o.focus;
    const finish = new Map();
    let cursor = 0; // week at which the team is next free (team treated as one pooled resource)
    const tasks = order.map((f) => {
      const effort = expectedEffort(f) * (1 + o.buffer);
      const depsDone = Math.max(0, ...(f.dependsOn || []).map((d) => finish.get(d) || 0));
      const start = Math.max(cursor, depsDone);
      const duration = effort / weekly;
      const end = start + duration;
      finish.set(f.id, end);
      cursor = end;
      return { id: f.id, name: f.name, moscow: f.moscow || 'Could', effort, start, end, sprintStart: Math.floor(start / o.sprintWeeks) + 1, sprintEnd: Math.max(1, Math.ceil(end / o.sprintWeeks)) };
    });
    const phase = (m) => tasks.filter((t) => t.moscow === m);
    const end = (ts) => (ts.length ? Math.max(...ts.map((t) => t.end)) : 0);
    const phases = [
      { name: 'MVP (Must)', tasks: phase('Must') },
      { name: 'Release 2 (Should)', tasks: phase('Should') },
      { name: 'Later (Could)', tasks: phase('Could') }
    ].map((p) => Object.assign(p, { weeks: end(p.tasks), effort: p.tasks.reduce((s, t) => s + t.effort, 0) }));
    return {
      settings: o,
      tasks,
      phases,
      cyclic,
      totalWeeks: end(tasks),
      totalEffort: tasks.reduce((s, t) => s + t.effort, 0),
      mvpWeeks: end(phase('Must'))
    };
  }

  /* ---------------- Technology stack recommender ---------------- */

  /**
   * Rule-based, explainable recommendations. Every pick lists the constraint
   * that triggered it, so the output can be defended in a design review.
   * constraints: {platform: 'mobile'|'web'|'both', offline, sensitiveData,
   *   ai: 'none'|'rules'|'ml'|'llm', wearables, realtime, budget: 'low'|'medium'|'high',
   *   skills: ['javascript','python','java','dart'], expectedUsers, region}
   */
  function recommendStack(c) {
    const k = Object.assign({ platform: 'mobile', offline: false, sensitiveData: false, ai: 'rules', wearables: false, realtime: false, budget: 'low', skills: ['javascript'], expectedUsers: 1000, region: 'India' }, c || {});
    const js = k.skills.includes('javascript') || k.skills.includes('typescript');
    const py = k.skills.includes('python');
    const rec = [];
    const add = (layer, choice, why, alternatives) => rec.push({ layer, choice, why, alternatives: alternatives || [] });

    if (k.platform === 'mobile' || k.platform === 'both') {
      if (k.skills.includes('dart')) add('Client', 'Flutter', ['Team already knows Dart', 'One codebase for Android and iOS'], ['React Native']);
      else add('Client', 'React Native (Expo)', [js ? 'Team skills are JavaScript/TypeScript' : 'Large ecosystem and hiring pool', 'One codebase for Android and iOS'].concat(k.wearables ? ['Mature libraries for Health Connect (Android) and HealthKit (iOS)'] : []), ['Flutter', 'Native Kotlin/Swift']);
    }
    if (k.platform === 'web' || k.platform === 'both') add('Web', k.platform === 'both' ? 'React web (shared logic with mobile)' : 'React + Vite (PWA)', ['Fast iteration, works on any device'].concat(k.offline ? ['PWA service worker supports offline use'] : []), ['Angular', 'SvelteKit']);
    if (k.offline) add('On-device storage', 'SQLite (offline-first) with background sync', ['Offline use was required', 'Data stays usable without connectivity'], ['WatermelonDB', 'Realm']);

    if (k.budget === 'low' && k.expectedUsers <= 50000) {
      add('Backend', 'Managed backend: Supabase (PostgreSQL + Auth + Storage)', ['Low budget and small team: no servers to run', 'SQL database keeps data relational and exportable'].concat(k.sensitiveData ? ['Row-level security policies restrict each user to their own records'] : []), ['Firebase', 'Appwrite (self-hosted)']);
    } else {
      add('Backend', py ? 'FastAPI service on containers' : 'Node.js (NestJS) service on containers', [py ? 'Team knows Python; shares code with ML layer' : 'Same language as client', 'Scales horizontally beyond ~50k users'], ['Django', 'Spring Boot']);
      add('Database', 'PostgreSQL (managed)', ['Relational data with strong consistency', 'Mature tooling for audit and backups'], ['MySQL']);
    }

    if (k.ai === 'rules') add('Intelligence', 'Transparent rules + statistics layer', ['Explainability is a requirement', 'No training data needed for the MVP'], ['Small ML models later']);
    if (k.ai === 'ml') add('Intelligence', py ? 'scikit-learn / XGBoost models served via FastAPI' : 'TensorFlow.js / ONNX Runtime on-device', [py ? 'Python skills available' : 'Keeps data on the device', 'Interpretable models first (feature importances)'], ['Cloud AutoML']);
    if (k.ai === 'llm') add('Intelligence', 'LLM via API with retrieval over a curated evidence base (RAG) and citation checks', ['Generative features were requested', 'Retrieval keeps answers tied to vetted sources', 'Every generated claim is verified before display'], ['Self-hosted open model (Llama/Mistral) for privacy']);

    if (k.sensitiveData) {
      add('Privacy & security', 'Consent manager, encryption in transit (TLS) and at rest, data minimisation, export/delete endpoints', ['Sensitive personal data is processed'].concat(k.region === 'India' ? ['India: DPDP Act 2023 and DPDP Rules 2025 require itemised notice and consent'] : []), ['Pseudonymised analytics']);
      add('Hosting region', k.region === 'India' ? 'Cloud region in India (e.g. Mumbai)' : 'Cloud region in the users’ jurisdiction', ['Keeps sensitive data close to users and simplifies compliance review'], []);
    }
    if (k.wearables) add('Integrations', 'Android Health Connect + Apple HealthKit', ['Wearable data was required', 'User-controlled permissions per data type'], ['Vendor APIs (Fitbit, Garmin)']);
    if (k.realtime) add('Realtime', k.budget === 'low' ? 'Supabase Realtime channels' : 'WebSockets (Socket.IO) or managed pub/sub', ['Realtime updates were required'], ['Server-sent events']);
    add('Analytics', k.sensitiveData ? 'Privacy-friendly product analytics (self-hosted PostHog) with no health fields in events' : 'PostHog / Google Analytics', ['Measure activation and retention for MVP learning'], []);
    add('CI/CD & quality', 'GitHub Actions: lint, unit tests, build; Expo EAS / Vercel for releases', ['Automated checks on every change for a multi-developer team'], []);
    return rec;
  }

  return { rice, prioritize, expectedEffort, topoOrder, schedule, recommendStack, MOSCOW_ORDER };
});
