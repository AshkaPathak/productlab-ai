/* ProductLab AI - Report view: traceability audit and strategy report */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct, download, slug, markdown } = PL.ui;
  const C = PL.comp;

  const WHERE = {
    Needs: ['discover', 'needs'], Personas: ['discover', 'personas'], Concepts: ['ideate', 'concepts'], Ratings: ['evaluate', 'matrix'],
    Competitors: ['evaluate', 'competitors'], Features: ['build', 'features'], Risks: ['evaluate', 'risks']
  };

  function auditTab(ctx, u) {
    const a = PL.evidence.audit(ctx.project, ctx.index);
    const s = a.summary;
    const filter = u.status || '';
    const items = a.items.filter((it) => !filter || (filter === 'problems' ? !['supported', 'partial'].includes(it.result.status) : it.result.status === filter));
    return '<div class="stats">' + C.stat('Traceability index', pct(s.traceability), 'claims with supporting evidence') + C.stat('Supported', s.supported) + C.stat('Partially supported', s.partial) +
      C.stat('Problems', s.unsupported + s.invalid + s.uncited, s.unsupported + ' not supported, ' + s.invalid + ' missing, ' + s.uncited + ' uncited') + C.stat('Evidence coverage', s.evidenceUsed + '/' + s.evidenceTotal, 'findings cited at least once') + '</div>' +
      '<div class="grid two"><div class="card"><h2>By section</h2><div class="table-wrap"><table><thead><tr><th>Section</th><th class="num">Claims</th><th class="num">Traced</th><th class="num">%</th></tr></thead><tbody>' +
      Object.keys(s.byGroup).map((g) => '<tr><td>' + esc(g) + '</td><td class="num">' + s.byGroup[g].total + '</td><td class="num">' + s.byGroup[g].traced + '</td><td class="num">' + pct(s.byGroup[g].traced / s.byGroup[g].total) + '</td></tr>').join('') +
      '</tbody></table></div></div><div class="card"><h2>How the guard works</h2><p class="small">Each claim is vectorised with TF-IDF (domain synonyms folded) and compared with every evidence finding it cites by cosine similarity.</p><ul class="small">' +
      '<li><b>Supported</b>: best cited finding scores ≥ ' + fix(ctx.index.opts.strong) + '</li><li><b>Partial</b>: between ' + fix(ctx.index.opts.weak) + ' and ' + fix(ctx.index.opts.strong) + '</li><li><b>Not supported</b>: cited findings do not match the claim</li><li><b>Missing evidence</b>: cites IDs that do not exist (typical of AI hallucination)</li><li><b>Uncited</b>: no evidence given</li></ul>' +
      '<p class="muted small">Thresholds can be tuned in Settings. Lexical matching cannot judge meaning perfectly — treat flags as prompts for a human check.</p></div></div>' +
      '<div class="card"><div class="row between"><h2>All claims</h2><select data-act="uiset" data-view="report" data-key="status" aria-label="Filter"><option value="">All (' + a.items.length + ')</option><option value="problems"' + (filter === 'problems' ? ' selected' : '') + '>Problems only</option>' +
      ['supported', 'partial', 'unsupported', 'invalid', 'uncited'].map((st) => '<option value="' + st + '"' + (filter === st ? ' selected' : '') + '>' + esc(PL.evidence.STATUS[st].label) + ' (' + s[st] + ')</option>').join('') + '</select></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Where</th><th>Claim</th><th>Status</th><th class="num">Best match</th><th>Suggested evidence</th></tr></thead><tbody>' +
      items.map((it) => {
        const w = WHERE[it.group];
        return '<tr><td class="small"><a href="#/' + w[0] + '" data-act="jump" data-view="' + w[0] + '" data-tab="' + w[1] + '">' + esc(it.group) + '</a><div class="muted">' + esc(it.label) + '</div></td><td class="small">' + esc(it.text) +
          '<div class="mono muted">' + esc((it.evidence || []).join(', ')) + '</div></td><td>' + C.badge(it.result.status) + '</td><td class="num">' + (it.result.best ? fix(it.result.best.score) : '–') + '</td>' +
          '<td class="mono small">' + esc(it.result.suggestions.map((x) => x.id + ' (' + fix(x.score) + ')').join(', ')) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function reportTab(ctx) {
    const md = PL.report.build(ctx.project);
    return '<div class="card no-print"><div class="row"><button class="btn primary" data-act="print">Print / save as PDF</button><button class="btn" data-act="md">Download Markdown</button><button class="btn" data-act="json">Download project (.json)</button></div>' +
      '<p class="muted small" style="margin:8px 0 0">The report is regenerated from your project every time, with numbered IEEE references in order of first citation.</p></div>' +
      '<div class="card report-body">' + markdown(md) + '</div>';
  }

  PL.views.report = {
    render(ctx) {
      const u = ctx.ui('report');
      const tab = u.tab || 'audit';
      return C.tabs('report', tab, [{ id: 'audit', label: 'Traceability audit' }, { id: 'report', label: 'Strategy report' }]) + (tab === 'report' ? reportTab(ctx) : auditTab(ctx, u));
    },
    actions: {
      jump(el, e, ctx) { ctx.ui(el.dataset.view).tab = el.dataset.tab; PL.store.save(); ctx.go(el.dataset.view); },
      print() { window.print(); },
      md(el, e, ctx) { download(slug(ctx.project.name) + '-strategy.md', PL.report.build(ctx.project), 'text/markdown'); },
      json(el, e, ctx) { download(slug(ctx.project.name) + '.productlab.json', JSON.stringify(ctx.project, null, 2), 'application/json'); }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
