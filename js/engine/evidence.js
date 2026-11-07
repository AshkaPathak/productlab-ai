/*
 * ProductLab AI - evidence engine
 * Builds a retrieval index over evidence findings, verifies that claims are
 * backed by the evidence they cite (the "citation guard"), and audits a whole
 * project for traceability.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./text.js'));
  else (root.PL = root.PL || {}).evidence = factory(root.PL.text);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  const DEFAULTS = { strong: 0.2, weak: 0.08, suggest: 3 };

  const STATUS = {
    supported: { label: 'Supported', weight: 1 },
    partial: { label: 'Partially supported', weight: 0.5 },
    unsupported: { label: 'Citation does not support claim', weight: 0 },
    invalid: { label: 'Cites missing evidence', weight: 0 },
    uncited: { label: 'No evidence cited', weight: 0 }
  };

  function findingText(f) {
    return [f.text, (f.tags || []).join(' ')].join(' ');
  }

  /** Build the retrieval index for a project. Cheap enough to rebuild on edit. */
  function buildIndex(project, options) {
    const synonyms = T.buildSynonymMap(project.glossary || []);
    const findings = project.findings || [];
    const corpus = new T.Corpus(findings.map((f) => ({ id: f.id, text: findingText(f) })), { synonyms });
    const byId = new Map(findings.map((f) => [f.id, f]));
    const refById = new Map((project.references || []).map((r) => [r.id, r]));
    return { corpus, byId, refById, opts: Object.assign({}, DEFAULTS, options || {}) };
  }

  function strengthOf(index, findingId) {
    const f = index.byId.get(findingId);
    if (!f) return 0;
    const r = index.refById.get(f.ref);
    const s = r && r.strength ? r.strength : 1;
    return Math.max(1, Math.min(3, s));
  }

  /** Semantic search over findings. */
  function search(index, text, k) {
    return index.corpus.search(text, k).map((h) => Object.assign(h, { finding: index.byId.get(h.id) }));
  }

  /**
   * Verify a single claim {text, evidence:[ids]}.
   * Returns status, per-citation support scores and better-matching evidence.
   */
  function verify(index, claim) {
    const o = index.opts;
    const qv = index.corpus.vectorize(claim.text || '');
    const ids = Array.from(new Set((claim.evidence || []).filter(Boolean)));
    const cited = ids.map((id) => {
      const exists = index.byId.has(id);
      const score = exists ? T.cosine(qv, index.corpus.vector(id)) : 0;
      return { id, exists, score, strength: exists ? strengthOf(index, id) : 0 };
    });
    const valid = cited.filter((c) => c.exists);
    const missing = cited.filter((c) => !c.exists).map((c) => c.id);
    const best = valid.reduce((m, c) => (c.score > (m ? m.score : -1) ? c : m), null);

    let status;
    if (!ids.length) status = 'uncited';
    else if (!valid.length) status = 'invalid';
    else if (best.score >= o.strong) status = 'supported';
    else if (best.score >= o.weak) status = 'partial';
    else status = 'unsupported';

    const citedSet = new Set(ids);
    const suggestions = index.corpus.search(qv, o.suggest + ids.length)
      .filter((h) => !citedSet.has(h.id) && h.score >= o.weak)
      .slice(0, o.suggest);

    return { status, best, cited, missing, suggestions };
  }

  /** Every evidence-bearing statement in a project, with where it lives. */
  function claimsOf(project) {
    const out = [];
    const push = (loc, group, label, text, evidence) => {
      if (text && String(text).trim()) out.push({ loc, group, label, text: String(text), evidence: evidence || [] });
    };
    (project.needs || []).forEach((n) => push('need:' + n.id, 'Needs', n.id, n.statement, n.evidence));
    (project.personas || []).forEach((p) => (p.pains || []).forEach((pain, i) =>
      push('persona:' + p.id + ':' + i, 'Personas', p.name, pain.text, pain.evidence)));
    (project.concepts || []).forEach((c) => (c.claims || []).forEach((cl, i) =>
      push('concept:' + c.id + ':' + i, 'Concepts', c.name, cl.text, cl.evidence)));
    const ratings = project.ratings || {};
    Object.keys(ratings).forEach((cid) => {
      const concept = (project.concepts || []).find((c) => c.id === cid);
      Object.keys(ratings[cid] || {}).forEach((crit) => {
        const r = ratings[cid][crit];
        if (r && r.note) push('rating:' + cid + ':' + crit, 'Ratings', (concept ? concept.name : cid) + ' / ' + crit, r.note, r.evidence);
      });
    });
    (project.competitors || []).forEach((c) => push('competitor:' + c.id, 'Competitors', c.name, c.gaps, c.evidence));
    (project.features || []).forEach((f) => push('feature:' + f.id, 'Features', f.name, f.rationale || f.description, f.evidence));
    (project.risks || []).forEach((r) => push('risk:' + r.id, 'Risks', r.id, r.failure + '. ' + (r.cause || ''), r.evidence));
    return out;
  }

  /** Traceability audit for an entire project. */
  function audit(project, index) {
    const idx = index || buildIndex(project);
    const items = claimsOf(project).map((c) => Object.assign(c, { result: verify(idx, c) }));
    const counts = { supported: 0, partial: 0, unsupported: 0, invalid: 0, uncited: 0 };
    const used = new Set();
    items.forEach((it) => {
      counts[it.result.status] += 1;
      it.result.cited.forEach((c) => { if (c.exists) used.add(c.id); });
    });
    const total = items.length;
    const traceability = total ? (counts.supported + counts.partial) / total : 0;
    const weighted = total ? items.reduce((s, it) => s + STATUS[it.result.status].weight, 0) / total : 0;
    const byGroup = {};
    items.forEach((it) => {
      const g = byGroup[it.group] || (byGroup[it.group] = { total: 0, traced: 0 });
      g.total += 1;
      if (it.result.status === 'supported' || it.result.status === 'partial') g.traced += 1;
    });
    return {
      items,
      summary: Object.assign({ total, traceability, weighted, evidenceUsed: used.size, evidenceTotal: idx.byId.size, byGroup }, counts)
    };
  }

  /**
   * Evidence score (0..1) for a set of claims: status weight scaled by the
   * strength (1-3) of the best supporting source.
   */
  function evidenceScore(index, claims) {
    if (!claims || !claims.length) return 0;
    let sum = 0;
    claims.forEach((cl) => {
      const r = verify(index, cl);
      if (!r.best) return;
      sum += STATUS[r.status].weight * (r.best.strength / 3);
    });
    return sum / claims.length;
  }

  function conceptEvidenceScore(index, concept) {
    return evidenceScore(index, concept.claims || []);
  }

  /** Evidence strength for a feature (0..1); used to adjust RICE confidence. */
  function featureEvidenceScore(index, feature) {
    return evidenceScore(index, [{ text: [feature.name, feature.rationale || feature.description].join('. '), evidence: feature.evidence }]);
  }

  /* ---------- IEEE reference formatting ---------- */

  function initials(name) {
    // "Gibson-Helm, M." / "Melanie Gibson-Helm" / "M. Gibson-Helm" -> "M. Gibson-Helm"
    const s = String(name).trim();
    if (!s) return '';
    if (/\b(Group|Network|Consortium|Organi[sz]ation|Government|Ministry|Council)\b/.test(s)) return s;
    if (s.includes(',')) {
      const [last, first] = s.split(',').map((x) => x.trim());
      return (first ? first.split(/[\s.]+/).filter(Boolean).map((p) => p.split('-').map((q) => q[0].toUpperCase() + '.').join('-')).join(' ') + ' ' : '') + last;
    }
    const parts = s.split(/\s+/);
    if (parts.length === 1) return s;
    const isInitial = (p) => /^[A-Z]\.(-[A-Z]\.)?$/.test(p);
    if (isInitial(parts[0])) {
      let i = 0;
      while (i < parts.length - 1 && isInitial(parts[i])) i++;
      return parts.slice(0, i).join(' ') + ' ' + parts.slice(i).join(' ');
    }
    const last = parts.pop();
    return parts.map((p) => (/\.$/.test(p) && p.length <= 3 ? p : p[0].toUpperCase() + '.')).join(' ') + ' ' + last;
  }

  function formatAuthors(authors) {
    const a = (authors || []).map(initials).filter(Boolean);
    if (!a.length) return '';
    if (a.length > 6) return a[0] + ' et al.';
    if (a.length === 1) return a[0];
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
  }

  const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1] : String(iso);
  }

  /** IEEE-style reference string (without the [n] prefix). */
  function formatIEEE(ref) {
    const parts = [];
    const authors = ref.org || formatAuthors(ref.authors);
    if (authors) parts.push(authors + ',');
    const t = ref.title ? '“' + ref.title + ',”' : '';
    if (ref.type === 'journal' || ref.type === 'guideline' || ref.type === 'review') {
      parts.push(t);
      const v = [ref.venue ? ref.venue : '', ref.volume ? 'vol. ' + ref.volume : '', ref.issue ? 'no. ' + ref.issue : '',
        ref.pages ? (/\d\s*-\s*\d/.test(ref.pages) ? 'pp. ' + ref.pages.replace(/\s*-\s*/, '–') : 'Art. no. ' + ref.pages) : '', ref.year].filter(Boolean).join(', ');
      parts.push(v + (ref.doi ? ', doi: ' + ref.doi + '.' : '.'));
    } else {
      parts.push(t);
      const v = [ref.venue, ref.year].filter(Boolean).join(', ');
      parts.push((v ? v + '.' : '') + (ref.accessed ? ' Accessed: ' + formatDate(ref.accessed) + '.' : '') +
        (ref.url ? ' [Online]. Available: ' + ref.url : '') + (ref.doi ? ' doi: ' + ref.doi + '.' : ''));
    }
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  return { DEFAULTS, STATUS, buildIndex, search, verify, claimsOf, audit, evidenceScore, conceptEvidenceScore, featureEvidenceScore, formatIEEE, formatAuthors, strengthOf };
});
