/*
 * ProductLab AI - text processing
 * Tokenisation, light stemming, synonym folding and TF-IDF vectors.
 * Runs unchanged in the browser (window.PL.text) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.PL = root.PL || {}).text = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STOPWORDS = new Set((
    'a about above after again against all also am an and any are as at be because been before being below ' +
    'between both but by can could did do does doing down during each few for from further had has have having he ' +
    'her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not ' +
    'now of off on once only or other our ours ourselves out over own same she should so some such than that the ' +
    'their theirs them themselves then there these they this those through to too under until up very was we were ' +
    'what when where which while who whom why will with would you your yours yourself yourselves per via within ' +
    'without may might must shall us one two three many much every e g eg ie etc vs using use used based among ' +
    'across around toward towards upon whether either neither yet still even'
  ).split(/\s+/));

  /** Lower-case, strip punctuation, keep letters/digits (unicode aware). */
  function normalize(str) {
    return String(str == null ? '' : str)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^\p{L}\p{N}%.]+/gu, ' ')
      .replace(/(\D)\.|\.(\D)|\.$/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * A deliberately small suffix stripper. It is not a full Porter stemmer,
   * but it folds the plural/verb forms that matter for short evidence notes
   * (e.g. "diagnosed", "diagnosis", "diagnoses" -> "diagnos").
   */
  function stem(word) {
    let w = word;
    if (w.length <= 3 || /^\d/.test(w)) return w;
    const rules = [
      [/ational$/, 'ate'], [/tional$/, 'tion'], [/ization$/, 'ize'], [/isation$/, 'ize'],
      [/fulness$/, 'ful'], [/ousness$/, 'ous'], [/iveness$/, 'ive'],
      [/ements?$/, ''], [/ments?$/, ''], [/ness$/, ''],
      [/ies$/, 'y'], [/ied$/, 'y'], [/sses$/, 'ss'],
      [/ing$/, ''], [/edly$/, ''], [/ed$/, ''], [/ly$/, ''],
      [/is$/, ''], [/ss$/, 'ss'], [/es$/, ''], [/s$/, ''],
      [/ic$/, ''], [/al$/, ''], [/e$/, '']
    ];
    for (const [re, rep] of rules) {
      if (re.test(w)) {
        const next = w.replace(re, rep);
        if (next.length >= 3) { w = next; break; }
      }
    }
    return w;
  }

  /**
   * Build a synonym map from groups such as [["period","menstrual","cycle"]].
   * Every stemmed member maps to the stemmed first member (the canonical term).
   */
  function buildSynonymMap(groups) {
    const map = new Map();
    (groups || []).forEach((group) => {
      if (!Array.isArray(group) || !group.length) return;
      const canon = stem(normalize(group[0]).split(' ')[0] || '');
      group.forEach((g) => {
        normalize(g).split(' ').filter(Boolean).forEach((t) => {
          if (!STOPWORDS.has(t)) map.set(stem(t), canon);
        });
      });
    });
    return map;
  }

  /** Tokenise text into stemmed, synonym-folded terms. */
  function tokenize(str, synonyms) {
    const out = [];
    normalize(str).split(' ').forEach((t) => {
      if (!t || STOPWORDS.has(t)) return;
      if (t.length < 2 && !/\d/.test(t)) return;
      let s = stem(t);
      if (synonyms && synonyms.has(s)) s = synonyms.get(s);
      out.push(s);
    });
    return out;
  }

  function termFreq(tokens) {
    const tf = new Map();
    tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    return tf;
  }

  function l2normalize(vec) {
    let sum = 0;
    vec.forEach((v) => { sum += v * v; });
    const n = Math.sqrt(sum) || 1;
    const out = new Map();
    vec.forEach((v, k) => out.set(k, v / n));
    return out;
  }

  /** Cosine similarity of two L2-normalised sparse vectors. */
  function cosine(a, b) {
    if (!a || !b) return 0;
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    let dot = 0;
    small.forEach((v, k) => { const w = big.get(k); if (w) dot += v * w; });
    return dot;
  }

  /**
   * A TF-IDF corpus. Documents are {id, text}. Vectors use sub-linear tf
   * (1 + ln tf) and smoothed idf, then L2 normalisation.
   */
  class Corpus {
    constructor(docs, options) {
      this.synonyms = (options && options.synonyms) || new Map();
      this.docs = [];
      this.df = new Map();
      this.vectors = new Map();
      (docs || []).forEach((d) => this._add(d));
      this._finalise();
    }

    _add(doc) {
      const tokens = tokenize(doc.text, this.synonyms);
      this.docs.push({ id: doc.id, tokens });
      new Set(tokens).forEach((t) => this.df.set(t, (this.df.get(t) || 0) + 1));
    }

    _finalise() {
      const N = this.docs.length;
      this.idf = new Map();
      this.df.forEach((df, t) => this.idf.set(t, Math.log((N + 1) / (df + 1)) + 1));
      this.defaultIdf = Math.log(N + 1) + 1;
      this.docs.forEach((d) => this.vectors.set(d.id, this._weigh(termFreq(d.tokens))));
    }

    _weigh(tf) {
      const vec = new Map();
      tf.forEach((count, t) => {
        const idf = this.idf.has(t) ? this.idf.get(t) : this.defaultIdf;
        vec.set(t, (1 + Math.log(count)) * idf);
      });
      return l2normalize(vec);
    }

    /** Vectorise arbitrary text against this corpus' vocabulary statistics. */
    vectorize(text) {
      return this._weigh(termFreq(tokenize(text, this.synonyms)));
    }

    vector(id) { return this.vectors.get(id); }

    /** Rank documents by cosine similarity to a query string or vector. */
    search(query, k) {
      const q = typeof query === 'string' ? this.vectorize(query) : query;
      const scored = [];
      this.vectors.forEach((v, id) => {
        const s = cosine(q, v);
        if (s > 0) scored.push({ id, score: s });
      });
      scored.sort((x, y) => y.score - x.score || String(x.id).localeCompare(String(y.id)));
      return typeof k === 'number' ? scored.slice(0, k) : scored;
    }

    similarity(textA, textB) {
      return cosine(this.vectorize(textA), this.vectorize(textB));
    }
  }

  /** Average a list of sparse vectors and re-normalise (a cluster centroid). */
  function centroid(vectors) {
    const acc = new Map();
    vectors.forEach((v) => v.forEach((w, k) => acc.set(k, (acc.get(k) || 0) + w)));
    return l2normalize(acc);
  }

  /** Highest-weighted terms of a vector, for human-readable labels. */
  function topTerms(vec, k) {
    return Array.from(vec.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, k || 5)
      .map(([t]) => t);
  }

  return { STOPWORDS, normalize, stem, tokenize, buildSynonymMap, cosine, centroid, topTerms, Corpus };
});
