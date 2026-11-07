/*
 * ProductLab AI - decision engine
 * Weighted Decision Matrix (Total = sum of weight x rating), one-at-a-time
 * weight sensitivity (how far each weight can move before the winner
 * changes) and Monte Carlo robustness of the ranking.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ideation.js'));
  else (root.PL = root.PL || {}).decision = factory(root.PL.ideation);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (I) {
  'use strict';

  function normalizeWeights(criteria) {
    const sum = criteria.reduce((s, c) => s + Math.max(0, Number(c.weight) || 0), 0);
    return criteria.map((c) => (sum ? Math.max(0, Number(c.weight) || 0) / sum : 1 / criteria.length));
  }

  function ratingOf(ratings, cid, critId) {
    const r = ratings && ratings[cid] && ratings[cid][critId];
    const v = r && typeof r === 'object' ? r.value : r;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }

  /** Scores with explicit weights (array aligned with criteria). */
  function scoreWith(alternatives, criteria, ratings, weights) {
    return alternatives.map((a) => {
      const breakdown = criteria.map((c, i) => ({ id: c.id, weight: weights[i], rating: ratingOf(ratings, a.id, c.id), contribution: weights[i] * ratingOf(ratings, a.id, c.id) }));
      return { id: a.id, name: a.name, total: breakdown.reduce((s, b) => s + b.contribution, 0), breakdown };
    });
  }

  function rank(results) {
    const sorted = results.slice().sort((a, b) => b.total - a.total || String(a.id).localeCompare(String(b.id)));
    let prev = null; let r = 0;
    sorted.forEach((x, i) => {
      if (prev === null || Math.abs(x.total - prev) > 1e-9) r = i + 1;
      x.rank = r; prev = x.total;
    });
    return sorted;
  }

  /** Weighted decision matrix. Weights may be given in % or any scale. */
  function wdm(alternatives, criteria, ratings) {
    const w = normalizeWeights(criteria);
    return rank(scoreWith(alternatives, criteria, ratings, w));
  }

  /** Re-weight: set criterion k to value v (0..1); others keep their relative proportions. */
  function reweight(base, k, v) {
    const rest = base.reduce((s, w, i) => (i === k ? s : s + w), 0);
    return base.map((w, i) => (i === k ? v : rest > 0 ? (w / rest) * (1 - v) : (1 - v) / (base.length - 1)));
  }

  /**
   * One-at-a-time sensitivity: for each criterion, scan its weight from 0 to 1
   * and find the closest weight (in percentage points) at which the winner changes.
   */
  function sensitivity(alternatives, criteria, ratings, options) {
    const step = (options && options.step) || 0.005;
    const base = normalizeWeights(criteria);
    const winner = rank(scoreWith(alternatives, criteria, ratings, base))[0];
    return criteria.map((c, k) => {
      let flip = null;
      for (let v = 0; v <= 1 + 1e-9; v += step) {
        const top = rank(scoreWith(alternatives, criteria, ratings, reweight(base, k, v)))[0];
        if (top.id !== winner.id) {
          const delta = v - base[k];
          if (!flip || Math.abs(delta) < Math.abs(flip.delta)) flip = { at: v, delta, newWinner: top.id, newWinnerName: top.name };
        }
      }
      return { id: c.id, name: c.name, base: base[k], flip };
    });
  }

  /**
   * Monte Carlo robustness: perturb every weight by a multiplicative factor in
   * [1-spread, 1+spread] (and optionally ratings by +/- ratingNoise), renormalise,
   * and count how often each alternative wins.
   */
  function monteCarlo(alternatives, criteria, ratings, options) {
    const o = Object.assign({ runs: 2000, spread: 0.3, ratingNoise: 0, seed: 42 }, options || {});
    const r = I.rng(o.seed);
    const base = normalizeWeights(criteria);
    const wins = {}; const rankSum = {};
    alternatives.forEach((a) => { wins[a.id] = 0; rankSum[a.id] = 0; });
    for (let i = 0; i < o.runs; i++) {
      let w = base.map((x) => x * (1 - o.spread + 2 * o.spread * r()));
      const s = w.reduce((a, b) => a + b, 0) || 1;
      w = w.map((x) => x / s);
      let rt = ratings;
      if (o.ratingNoise) {
        rt = {};
        alternatives.forEach((a) => {
          rt[a.id] = {};
          criteria.forEach((c) => { rt[a.id][c.id] = ratingOf(ratings, a.id, c.id) + (2 * r() - 1) * o.ratingNoise; });
        });
      }
      const ranked = rank(scoreWith(alternatives, criteria, rt, w));
      wins[ranked[0].id] += 1;
      ranked.forEach((x, pos) => { rankSum[x.id] += pos + 1; });
    }
    return alternatives.map((a) => ({ id: a.id, name: a.name, winRate: wins[a.id] / o.runs, meanRank: rankSum[a.id] / o.runs }))
      .sort((a, b) => b.winRate - a.winRate || a.meanRank - b.meanRank);
  }

  return { normalizeWeights, wdm, scoreWith, reweight, sensitivity, monteCarlo, rank };
});
