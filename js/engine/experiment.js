/*
 * ProductLab AI - evaluation study toolkit
 * Supports the research question: does an evidence-linked workflow produce
 * more defensible concepts than ordinary AI brainstorming?
 * - blind rating sheets (condition hidden, order shuffled) as CSV
 * - rating import, descriptive statistics, rater agreement
 * - paired Wilcoxon signed-rank test (exact for n <= 15) and effect sizes
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ideation.js'));
  else (root.PL = root.PL || {}).experiment = factory(root.PL.ideation);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (I) {
  'use strict';

  const METRICS = [
    { id: 'novelty', name: 'Novelty', help: 'How original is the concept compared with existing solutions? (1-5)' },
    { id: 'feasibility', name: 'Feasibility', help: 'Could a small team build an MVP with available technology and data? (1-5)' },
    { id: 'explainability', name: 'Explainability', help: 'Are the reasons for the concept clear and traceable to sources? (1-5)' },
    { id: 'confidence', name: 'User confidence', help: 'How much would you trust this recommendation? (1-5)' },
    { id: 'quality', name: 'Decision quality', help: 'How defensible is this concept in front of a review panel? (1-5)' }
  ];

  /* ---------------- CSV ---------------- */

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(rows, headers) {
    const h = headers || (rows.length ? Object.keys(rows[0]) : []);
    return [h.map(csvCell).join(',')].concat(rows.map((r) => h.map((k) => csvCell(r[k])).join(','))).join('\n');
  }

  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    const s = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
    if (!nonEmpty.length) return [];
    const head = nonEmpty[0].map((h) => h.trim());
    return nonEmpty.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }

  /* ---------------- Blind sheets ---------------- */

  function shuffle(arr, seed) {
    const r = I.rng(seed);
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /** Assign anonymous codes to entries and build a rating sheet with conditions hidden. */
  function blindSheet(entries, options) {
    const o = Object.assign({ seed: 2026, metrics: METRICS, raters: ['R1'] }, options || {});
    const order = shuffle(entries, o.seed);
    const key = order.map((e, i) => ({ code: 'S' + String(i + 1).padStart(2, '0'), entryId: e.id }));
    const rows = [];
    o.raters.forEach((rater) => order.forEach((e, i) => {
      const row = { rater, code: key[i].code, concept: e.name, description: e.description || '', claims: (e.claims || []).map((c) => c.text).join(' | ') };
      o.metrics.forEach((m) => { row[m.id] = ''; });
      rows.push(row);
    }));
    const headers = ['rater', 'code', 'concept', 'description', 'claims'].concat(o.metrics.map((m) => m.id));
    return { key, rows, csv: toCSV(rows, headers) };
  }

  function importRatings(csvText, key, metrics) {
    const ms = metrics || METRICS;
    const byCode = new Map(key.map((k) => [k.code, k.entryId]));
    const out = []; const errors = [];
    parseCSV(csvText).forEach((r, i) => {
      const entryId = byCode.get(r.code);
      if (!entryId) { errors.push('Row ' + (i + 2) + ': unknown code ' + r.code); return; }
      const scores = {};
      ms.forEach((m) => {
        const v = Number(r[m.id]);
        if (r[m.id] !== '' && Number.isFinite(v) && v >= 1 && v <= 5) scores[m.id] = v;
        else if (r[m.id] !== '' && r[m.id] != null) errors.push('Row ' + (i + 2) + ': ' + m.id + ' must be 1-5');
      });
      out.push({ rater: r.rater || 'R?', code: r.code, entryId, scores });
    });
    return { ratings: out, errors };
  }

  /* ---------------- Statistics ---------------- */

  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  function sd(a) {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
  }

  function normCdf(z) {
    // Abramowitz-Stegun 7.1.26 approximation of erf
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }

  /** Average ranks (ties share the mean rank). */
  function ranks(values) {
    const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(values.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j + 2) / 2;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }

  /**
   * Wilcoxon signed-rank test on paired differences (b - a).
   * Exact two-sided p for n <= 15 (enumerates sign patterns over the actual
   * ranks, so ties are handled), normal approximation with tie and
   * continuity correction otherwise.
   */
  function wilcoxon(diffs) {
    const d = diffs.filter((x) => Number.isFinite(x) && x !== 0);
    const n = d.length;
    if (!n) return { n: 0, W: 0, p: 1, z: 0, r: 0, method: 'none' };
    const rk = ranks(d.map(Math.abs));
    let wPlus = 0;
    d.forEach((x, i) => { if (x > 0) wPlus += rk[i]; });
    const total = (n * (n + 1)) / 2;
    const wMinus = total - wPlus;
    const W = Math.min(wPlus, wMinus);
    const mu = total / 2;
    // tie correction
    const counts = new Map();
    rk.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
    let tie = 0;
    counts.forEach((t) => { if (t > 1) tie += (t * t * t - t); });
    const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tie / 48);
    const z = sigma ? (wPlus - mu - Math.sign(wPlus - mu) * 0.5) / sigma : 0;
    let p; let method;
    if (n <= 15) {
      let extreme = 0;
      const lim = 1 << n;
      const obs = Math.abs(wPlus - mu) - 1e-9;
      for (let mask = 0; mask < lim; mask++) {
        let s = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) s += rk[i];
        if (Math.abs(s - mu) >= obs) extreme++;
      }
      p = extreme / lim; method = 'exact';
    } else {
      p = 2 * (1 - normCdf(Math.abs(z))); method = 'normal';
    }
    return { n, W, wPlus, wMinus, z, p: Math.min(1, p), r: Math.abs(z) / Math.sqrt(n), method };
  }

  /** Paired Cohen's dz = mean(diff) / sd(diff). */
  function cohenDz(diffs) {
    const s = sd(diffs);
    return s ? mean(diffs) / s : NaN;
  }

  /** Share of rating pairs (same entry, same metric, different raters) within +/- 1 point. */
  function agreement(ratings, metrics) {
    const ms = metrics || METRICS;
    const by = new Map();
    ratings.forEach((r) => ms.forEach((m) => {
      if (r.scores[m.id] == null) return;
      const k = r.entryId + '|' + m.id;
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r.scores[m.id]);
    }));
    let pairs = 0; let close = 0; let exact = 0;
    by.forEach((vals) => {
      for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          pairs++;
          if (Math.abs(vals[i] - vals[j]) <= 1) close++;
          if (vals[i] === vals[j]) exact++;
        }
      }
    });
    return { pairs, withinOne: pairs ? close / pairs : NaN, exact: pairs ? exact / pairs : NaN };
  }

  /**
   * Analyse a study. entries: [{id, participant, condition:'A'|'B', ...}]
   * ratings: from importRatings. traceOf(entry) -> 0..1 (optional, from audit).
   * Condition A = baseline (ordinary AI brainstorming), B = ProductLab workflow.
   */
  function analyze(entries, ratings, options) {
    const o = Object.assign({ metrics: METRICS, traceOf: null }, options || {});
    const entryById = new Map(entries.map((e) => [e.id, e]));
    const metricIds = o.metrics.map((m) => m.id).concat(o.traceOf ? ['traceability'] : []);
    // mean score per entry per metric (averaging raters)
    const perEntry = new Map();
    entries.forEach((e) => perEntry.set(e.id, {}));
    o.metrics.forEach((m) => {
      entries.forEach((e) => {
        const vals = ratings.filter((r) => r.entryId === e.id && r.scores[m.id] != null).map((r) => r.scores[m.id]);
        if (vals.length) perEntry.get(e.id)[m.id] = mean(vals);
      });
    });
    if (o.traceOf) entries.forEach((e) => { perEntry.get(e.id).traceability = o.traceOf(e); });

    const conditions = ['A', 'B'];
    const descriptive = {};
    conditions.forEach((c) => {
      descriptive[c] = {};
      metricIds.forEach((m) => {
        const vals = entries.filter((e) => e.condition === c).map((e) => perEntry.get(e.id)[m]).filter((v) => v != null);
        descriptive[c][m] = { n: vals.length, mean: mean(vals), sd: sd(vals) };
      });
    });

    // paired by participant: participant mean in A vs in B
    const participants = Array.from(new Set(entries.map((e) => e.participant))).filter(Boolean);
    const paired = {};
    metricIds.forEach((m) => {
      const diffs = [];
      participants.forEach((p) => {
        const a = entries.filter((e) => e.participant === p && e.condition === 'A').map((e) => perEntry.get(e.id)[m]).filter((v) => v != null);
        const b = entries.filter((e) => e.participant === p && e.condition === 'B').map((e) => perEntry.get(e.id)[m]).filter((v) => v != null);
        if (a.length && b.length) diffs.push(mean(b) - mean(a));
      });
      paired[m] = Object.assign({ diffs, meanDiff: mean(diffs), dz: cohenDz(diffs) }, wilcoxon(diffs));
    });
    return { descriptive, paired, participants, agreement: agreement(ratings, o.metrics), perEntry: Object.fromEntries(perEntry), entryById };
  }

  return { METRICS, toCSV, parseCSV, shuffle, blindSheet, importRatings, mean, sd, normCdf, ranks, wilcoxon, cohenDz, agreement, analyze };
});
