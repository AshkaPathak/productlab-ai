/*
 * ProductLab AI - opportunity mining
 * Groups evidence findings into themes (average-linkage agglomerative
 * clustering on TF-IDF cosine similarity) and links each theme to the
 * project's need statements.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./text.js'));
  else (root.PL = root.PL || {}).cluster = factory(root.PL.text);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  /**
   * Average-linkage agglomerative clustering.
   * items: [{id, vec}] ; threshold: minimum average similarity to merge.
   * Deterministic: ties are broken by item order.
   */
  function agglomerate(items, threshold) {
    const n = items.length;
    const sim = [];
    for (let i = 0; i < n; i++) {
      sim[i] = [];
      for (let j = 0; j < n; j++) sim[i][j] = i === j ? 1 : T.cosine(items[i].vec, items[j].vec);
    }
    let clusters = items.map((_, i) => [i]);
    const avg = (a, b) => {
      let s = 0;
      a.forEach((i) => b.forEach((j) => { s += sim[i][j]; }));
      return s / (a.length * b.length);
    };
    for (;;) {
      let best = -1; let bi = -1; let bj = -1;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const s = avg(clusters[i], clusters[j]);
          if (s > best) { best = s; bi = i; bj = j; }
        }
      }
      if (bi < 0 || best < threshold) break;
      clusters[bi] = clusters[bi].concat(clusters[bj]);
      clusters.splice(bj, 1);
    }
    clusters = clusters.map((c) => c.sort((a, b) => a - b));
    clusters.sort((a, b) => b.length - a.length || a[0] - b[0]);
    return clusters.map((c) => ({ members: c.map((i) => items[i].id), cohesion: c.length > 1 ? avg(c, c) : 1 }));
  }

  /**
   * Cluster the findings of an evidence index into themes.
   * Returns [{id, label, terms, members, cohesion, need:{id, score}|null}]
   */
  function themes(project, index, options) {
    const o = Object.assign({ threshold: 0.12, minSize: 1, kinds: null }, options || {});
    const corpus = index.corpus;
    const items = (project.findings || [])
      .filter((f) => !o.kinds || o.kinds.includes(f.kind))
      .map((f) => ({ id: f.id, vec: corpus.vector(f.id) }))
      .filter((x) => x.vec);
    const raw = agglomerate(items, o.threshold).filter((c) => c.members.length >= o.minSize);
    const needVecs = (project.needs || []).map((n) => ({ id: n.id, vec: corpus.vectorize(n.statement) }));
    return raw.map((c, i) => {
      const cvec = T.centroid(c.members.map((id) => corpus.vector(id)));
      const terms = T.topTerms(cvec, 4);
      let need = null;
      needVecs.forEach((nv) => {
        const s = T.cosine(cvec, nv.vec);
        if (s > 0.05 && (!need || s > need.score)) need = { id: nv.id, score: s };
      });
      return { id: 'T' + (i + 1), label: terms.join(' · '), terms, members: c.members, cohesion: c.cohesion, need };
    });
  }

  /** Which findings are not cited by any need yet (unexplored evidence). */
  function orphanFindings(project) {
    const cited = new Set();
    (project.needs || []).forEach((n) => (n.evidence || []).forEach((e) => cited.add(e)));
    return (project.findings || []).filter((f) => !cited.has(f.id)).map((f) => f.id);
  }

  return { agglomerate, themes, orphanFindings };
});
