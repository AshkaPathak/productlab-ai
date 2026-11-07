/*
 * ProductLab AI - ideation engine
 * Random Association prompts and Morphological Analysis (zwicky box):
 * enumerate option combinations, reject incompatible ones, rank the rest by
 * how well they cover evidence-backed needs, and synthesise concept drafts
 * whose claims cite retrieved evidence.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./text.js'), require('./evidence.js'));
  else (root.PL = root.PL || {}).ideation = factory(root.PL.text, root.PL.evidence);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T, E) {
  'use strict';

  /** Small deterministic PRNG so sessions can be reproduced (mulberry32). */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Domain-neutral stimulus words for Random Association. */
  const STIMULI = [
    { word: 'Mirror', attributes: ['shows you as you are', 'instant feedback', 'self-awareness'] },
    { word: 'Journal', attributes: ['daily reflection', 'private notes', 'patterns emerge over time'] },
    { word: 'Smartwatch', attributes: ['continuous sensing', 'gentle nudges', 'glanceable summary'] },
    { word: 'Community', attributes: ['peer support', 'shared stories', 'sense of belonging'] },
    { word: 'Nature', attributes: ['natural rhythms', 'seasons and cycles', 'slow steady growth'] },
    { word: 'Traffic light', attributes: ['simple red/amber/green status', 'clear next action', 'shared rules'] },
    { word: 'Recipe', attributes: ['step-by-step guidance', 'swap ingredients to taste', 'repeatable results'] },
    { word: 'GPS navigator', attributes: ['knows where you are', 're-routes when you go off track', 'estimated arrival'] },
    { word: 'Library', attributes: ['curated trusted sources', 'a librarian to ask', 'borrow what you need'] },
    { word: 'Coach', attributes: ['goal setting', 'encouragement', 'accountability check-ins'] },
    { word: 'Garden', attributes: ['small daily care', 'visible growth', 'pull weeds early'] },
    { word: 'Weather forecast', attributes: ['probabilistic prediction', 'plan ahead', 'early warnings'] },
    { word: 'Passport', attributes: ['portable personal record', 'stamps of progress', 'accepted everywhere'] },
    { word: 'Video game', attributes: ['levels and progression', 'quests', 'unlock rewards'] },
    { word: 'Detective', attributes: ['collect clues', 'connect evidence', 'explain the conclusion'] },
    { word: 'Orchestra', attributes: ['many specialists', 'one conductor', 'shared score'] },
    { word: 'Thermostat', attributes: ['sense and auto-adjust', 'target range', 'quiet in the background'] },
    { word: 'Compass', attributes: ['direction rather than a fixed route', 'works offline', 'simple to read'] },
    { word: 'Bus timetable', attributes: ['predictable schedule', 'reminders before departure', 'known stops'] },
    { word: 'Tea ceremony', attributes: ['calming ritual', 'mindful pace', 'shared moment'] }
  ];

  /** Random Association: pair a random stimulus attribute with a need. */
  function randomAssociation(needs, options) {
    const o = Object.assign({ seed: Date.now() % 100000, count: 4, stimuli: STIMULI }, options || {});
    const r = rng(o.seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const out = [];
    const list = (needs && needs.length) ? needs : [{ id: null, statement: 'the core problem' }];
    for (let i = 0; i < o.count; i++) {
      const s = pick(o.stimuli);
      const attribute = pick(s.attributes);
      const need = pick(list);
      out.push({
        stimulus: s.word,
        attribute,
        need: need.id,
        prompt: 'What if a solution for “' + need.statement.replace(/\.$/, '') + '” worked like a ' + s.word.toLowerCase() + ' — ' + attribute + '?'
      });
    }
    return out;
  }

  /* ---------------- Morphological analysis ---------------- */

  const optLabel = (o) => (typeof o === 'string' ? o : o.label);
  const optHint = (o) => (typeof o === 'string' ? o : [o.label, o.hint || ''].join(' '));

  function comboCount(params) {
    return (params || []).reduce((n, p) => n * Math.max(1, (p.options || []).length), (params || []).length ? 1 : 0);
  }

  /** Rules are {a:[paramId, optionLabel], b:[paramId, optionLabel], reason}. */
  function violations(selection, rules) {
    return (rules || []).filter((r) => selection[r.a[0]] === r.a[1] && selection[r.b[0]] === r.b[1]);
  }

  function* enumerate(params) {
    const ps = params || [];
    const idx = ps.map(() => 0);
    if (!ps.length || ps.some((p) => !(p.options || []).length)) return;
    for (;;) {
      const sel = {};
      ps.forEach((p, i) => { sel[p.id] = optLabel(p.options[idx[i]]); });
      yield sel;
      let k = ps.length - 1;
      while (k >= 0) {
        idx[k] += 1;
        if (idx[k] < ps[k].options.length) break;
        idx[k] = 0; k -= 1;
      }
      if (k < 0) return;
    }
  }

  function selectionText(selection, params) {
    return (params || []).map((p) => {
      const o = (p.options || []).find((x) => optLabel(x) === selection[p.id]);
      return o ? optHint(o) : '';
    }).join(' ');
  }

  function needText(project, need) {
    const ev = (need.evidence || []).map((id) => {
      const f = (project.findings || []).find((x) => x.id === id);
      return f ? f.text : '';
    }).join(' ');
    return need.statement + ' ' + ev;
  }

  /**
   * Score how well a combination addresses the project's needs.
   * score = severity-weighted mean cosine similarity between the combination's
   * option descriptions and each need (statement + its evidence).
   */
  function scoreCombo(selection, project, index, cache) {
    const corpus = index.corpus;
    const c = cache || {};
    if (!c.needs) {
      c.needs = (project.needs || []).map((n) => ({ id: n.id, sev: n.severity || 3, vec: corpus.vectorize(needText(project, n)), statement: n.statement }));
    }
    const vec = corpus.vectorize(selectionText(selection, project.morph.params));
    let num = 0; let den = 0;
    const matched = [];
    c.needs.forEach((n) => {
      const s = T.cosine(vec, n.vec);
      num += n.sev * s; den += n.sev;
      if (s >= 0.06) matched.push({ id: n.id, score: s });
    });
    matched.sort((a, b) => b.score - a.score);
    return { score: den ? num / den : 0, matched };
  }

  /** Rank all compatible combinations; return a diverse top-k. */
  function topCombos(project, index, k, options) {
    const o = Object.assign({ maxShared: null }, options || {});
    const params = project.morph.params;
    const maxShared = o.maxShared == null ? Math.max(1, params.length - 2) : o.maxShared;
    const cache = {};
    const scored = [];
    let rejected = 0;
    for (const sel of enumerate(params)) {
      const v = violations(sel, project.morph.rules);
      if (v.length) { rejected += 1; continue; }
      scored.push(Object.assign({ selection: sel }, scoreCombo(sel, project, index, cache)));
    }
    scored.sort((a, b) => b.score - a.score);
    const picked = [];
    for (const s of scored) {
      const tooClose = picked.some((p) => params.filter((pp) => p.selection[pp.id] === s.selection[pp.id]).length > maxShared);
      if (!tooClose) picked.push(s);
      if (picked.length >= (k || 5)) break;
    }
    return { total: comboCount(params), feasible: scored.length, rejected, top: picked };
  }

  /**
   * Draft a concept from a selection. Claims are generated only from
   * retrieved evidence, so every claim carries citations the guard can check.
   */
  function synthesizeConcept(selection, project, index, options) {
    const o = Object.assign({ id: null, name: null }, options || {});
    const params = project.morph.params;
    const s = scoreCombo(selection, project, index);
    const values = params.map((p) => selection[p.id]);
    const name = o.name || values.slice(0, 3).join(' · ');
    const description = params.map((p) => p.name + ': ' + selection[p.id]).join('; ') + '.';
    const claims = [];
    s.matched.slice(0, 3).forEach((m) => {
      const need = project.needs.find((n) => n.id === m.id);
      if (need) claims.push({ text: 'Addresses the need: ' + need.statement, evidence: (need.evidence || []).slice(0, 3) });
    });
    params.forEach((p) => {
      const opt = (p.options || []).find((x) => optLabel(x) === selection[p.id]);
      if (!opt) return;
      const hits = E.search(index, optHint(opt), 1);
      if (hits.length && hits[0].score >= index.opts.weak) {
        claims.push({ text: p.name + ' "' + optLabel(opt) + '" responds to evidence: ' + hits[0].finding.text, evidence: [hits[0].id] });
      }
    });
    return {
      id: o.id,
      name,
      tagline: 'Generated by morphological analysis',
      description,
      origin: 'morph',
      morph: Object.assign({}, selection),
      needs: s.matched.slice(0, 3).map((m) => m.id),
      claims,
      fit: s.score
    };
  }

  return { rng, STIMULI, randomAssociation, comboCount, violations, enumerate, scoreCombo, topCombos, synthesizeConcept, optLabel };
});
