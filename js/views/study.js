/* ProductLab AI - Evaluation study view (baseline AI brainstorming vs evidence-linked workflow) */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct, formModal, nextId, toast, download, readFile, slug, parseIds, confirmModal } = PL.ui;
  const C = PL.comp;
  const X = PL.experiment;
  let lastResults = null;

  function traceOf(ctx, entry) {
    const claims = entry.claims || [];
    if (!claims.length) return 0;
    const ok = claims.filter((cl) => { const s = PL.evidence.verify(ctx.index, cl).status; return s === 'supported' || s === 'partial'; }).length;
    return ok / claims.length;
  }

  function parseClaims(text) {
    return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = /\[([^\]]+)\]\s*$/.exec(l);
      return m ? { text: l.slice(0, m.index).trim(), evidence: parseIds(m[1]) } : { text: l, evidence: [] };
    });
  }

  function results(ctx) {
    const ex = ctx.project.experiment;
    if (!ex.entries.length || !ex.ratings.length) return '';
    const r = X.analyze(ex.entries, ex.ratings, { traceOf: (e) => traceOf(ctx, e) });
    const metrics = X.METRICS.concat([{ id: 'traceability', name: 'Traceability (automatic)' }]);
    const d = r.descriptive;
    const ms = (o, isT) => (o && o.n ? (isT ? pct(o.mean) : fix(o.mean)) + (Number.isFinite(o.sd) ? ' ± ' + (isT ? pct(o.sd) : fix(o.sd)) : '') + ' <span class="muted">(n=' + o.n + ')</span>' : '–');
    const rows = metrics.map((m) => {
      const pr = r.paired[m.id] || {};
      const isT = m.id === 'traceability';
      return '<tr><td>' + esc(m.name) + '</td><td class="num">' + ms(d.A[m.id], isT) + '</td><td class="num">' + ms(d.B[m.id], isT) + '</td><td class="num">' + (pr.n != null ? pr.diffs.length : '–') + '</td>' +
        '<td class="num">' + (Number.isFinite(pr.meanDiff) ? (isT ? pct(pr.meanDiff) : fix(pr.meanDiff)) : '–') + '</td><td class="num">' + (pr.n ? fix(pr.W, 1) : '–') + '</td><td class="num">' + (pr.n ? fix(pr.p, 3) + ' <span class="muted">' + esc(pr.method) + '</span>' : '–') + '</td><td class="num">' + (pr.n ? fix(pr.r) : '–') + '</td></tr>';
    }).join('');
    lastResults = { r, metrics };
    return '<div class="card"><div class="row between"><h2>Results</h2><button class="btn small" data-act="export-results">Download results CSV</button></div>' +
      '<p class="muted small">Ratings are averaged across raters per concept, then per participant within each condition. Paired differences (B − A) are tested with the Wilcoxon signed-rank test (exact for up to 15 pairs); r = |z|/√n is the effect size. ' +
      'Rater agreement: ' + (r.agreement.pairs ? pct(r.agreement.withinOne) + ' of ' + r.agreement.pairs + ' rating pairs within ±1 point, ' + pct(r.agreement.exact) + ' identical' : 'needs at least two raters') + '.</p>' +
      PL.fig.dumbbell(X.METRICS, d) +
      '<div class="table-wrap"><table><thead><tr><th>Metric</th><th class="num">A: baseline (mean ± sd)</th><th class="num">B: ProductLab</th><th class="num">Pairs</th><th class="num">Mean diff</th><th class="num">W</th><th class="num">p</th><th class="num">r</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (r.participants.length < 6 ? '<div class="warnbox">Only ' + r.participants.length + ' participant(s) have entries in both conditions. Report this as a pilot study; p-values with very few pairs cannot reach significance.</div>' : '') + '</div>';
  }

  PL.views.study = {
    render(ctx) {
      const p = ctx.project;
      const ex = p.experiment;
      const u = ctx.ui('study');
      const parts = Array.from(new Set(ex.entries.map((e) => e.participant)));
      return '<div class="card"><h2>Evaluation study</h2><p class="lead">Research question: <i>Can an evidence-linked AI product strategy workflow help teams generate higher-quality, more defensible product concepts than ordinary AI brainstorming?</i></p>' +
        '<ol class="small"><li>Each participant (or team) works on the same challenge twice: <b>A</b> with an ordinary AI chatbot or the Baseline mode of the AI assistant, <b>B</b> with ProductLab AI. Alternate the order between participants.</li>' +
        '<li>Record the resulting concepts here (or send them from the AI assistant).</li><li>Download the <b>blind rating sheet</b>: concepts are shuffled and coded, conditions hidden. Two or more raters score each concept 1–5 on ' + esc(X.METRICS.map((m) => m.name.toLowerCase()).join(', ')) + '.</li>' +
        '<li>Import the filled sheet. Traceability is measured automatically by the citation guard.</li></ol>' +
        '<p class="muted small">Full protocol: <span class="mono">docs/evaluation-protocol.md</span> in the repository.</p></div>' +
        '<div class="stats">' + C.stat('Participants', parts.length) + C.stat('Concepts (A / B)', ex.entries.filter((e) => e.condition === 'A').length + ' / ' + ex.entries.filter((e) => e.condition === 'B').length) + C.stat('Ratings imported', ex.ratings.length) + '</div>' +
        '<div class="card"><div class="row between"><h2>Concepts in the study</h2><div class="row"><button class="btn" data-act="from-concepts">Add project concepts (B)</button><button class="btn primary" data-act="add-entry">+ Add concept</button></div></div>' +
        (ex.entries.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Participant</th><th>Condition</th><th>Concept</th><th class="num">Claims</th><th class="num">Traceability</th><th></th></tr></thead><tbody>' +
          ex.entries.map((e) => '<tr><td class="mono">' + esc(e.id) + '</td><td>' + esc(e.participant) + '</td><td><span class="pill' + (e.condition === 'A' ? ' grey' : '') + '">' + esc(e.condition) + '</span></td><td><b>' + esc(e.name) + '</b><div class="muted small">' + esc((e.description || '').slice(0, 140)) + '</div></td><td class="num">' + (e.claims || []).length + '</td><td class="num">' + pct(traceOf(ctx, e)) + '</td>' +
            '<td><button class="icon-btn" data-act="del" data-path="experiment.entries.' + esc(e.id) + '" data-confirm="Remove this concept from the study?" aria-label="Remove">✕</button></td></tr>').join('') + '</tbody></table></div>' : C.empty('No study concepts yet.')) + '</div>' +
        '<div class="grid two"><div class="card"><h2>1. Blind rating sheet</h2><div class="field"><label>Raters (comma separated)</label><input class="wide" data-focus="raters" id="raters" value="' + esc(u.raters || 'R1, R2') + '"></div>' +
        '<button class="btn primary" data-act="sheet"' + (ex.entries.length ? '' : ' disabled') + '>Generate & download sheet (CSV)</button>' +
        (ex.key && ex.key.length ? '<p class="muted small" style="margin-top:8px">Current key covers ' + ex.key.length + ' coded concepts (seed ' + esc(ex.seed) + '). <a href="#" data-act="key">Download key</a> — keep it away from raters.</p>' : '') + '</div>' +
        '<div class="card"><h2>2. Import ratings</h2><p class="muted small">Upload the completed sheet(s). Rows are matched by code; scores must be 1–5.</p><label class="btn primary" for="ratings-csv">Choose CSV…</label><input id="ratings-csv" type="file" accept=".csv,text/csv" hidden data-act="import-ratings">' +
        (ex.ratings.length ? ' <button class="btn ghost danger" data-act="clear-ratings">Clear ratings</button>' : '') +
        (u.importErrors && u.importErrors.length ? '<div class="warnbox">' + u.importErrors.slice(0, 8).map(esc).join('<br>') + (u.importErrors.length > 8 ? '<br>…' : '') + '</div>' : '') + '</div></div>' +
        results(ctx);
    },
    actions: {
      async 'add-entry'(el, e, ctx) {
        const v = await formModal('Add study concept', [
          { name: 'participant', label: 'Participant / team ID', required: true, value: 'P1' },
          { name: 'condition', label: 'Condition', type: 'select', value: 'A', options: [{ value: 'A', label: 'A – baseline (ordinary AI brainstorming)' }, { value: 'B', label: 'B – ProductLab evidence-linked workflow' }] },
          { name: 'name', label: 'Concept name', required: true },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'claims', label: 'Claims (one per line; add citations at the end like [E3, E7])', type: 'textarea', rows: 5 }
        ]);
        if (!v || !v.name) return;
        ctx.commit((p) => p.experiment.entries.push({ id: nextId(p.experiment.entries, 'X'), participant: v.participant, condition: v.condition, name: v.name, description: v.description, claims: parseClaims(v.claims), source: 'manual' }));
      },
      async 'from-concepts'(el, e, ctx) {
        const p = ctx.project;
        if (!p.concepts.length) { toast('No project concepts yet', 'bad'); return; }
        const v = await formModal('Add project concepts to the study', [{ name: 'participant', label: 'Participant / team ID', required: true, value: 'P1' }].concat(p.concepts.map((c) => ({ name: 'c_' + c.id, label: c.name, type: 'checkbox', value: c.origin !== 'ai-baseline' }))), { intro: 'Selected concepts are added as condition B for this participant.' });
        if (!v) return;
        let n = 0;
        ctx.commit((pr) => pr.concepts.forEach((c) => {
          if (!v['c_' + c.id]) return;
          pr.experiment.entries.push({ id: nextId(pr.experiment.entries, 'X'), participant: v.participant, condition: 'B', name: c.name, description: c.description, claims: JSON.parse(JSON.stringify(c.claims || [])), source: 'concept:' + c.id });
          n++;
        }));
        toast(n + ' concept(s) added as condition B', 'ok');
      },
      sheet(el, e, ctx) {
        const raters = (document.getElementById('raters').value || 'R1').split(',').map((x) => x.trim()).filter(Boolean);
        ctx.ui('study').raters = raters.join(', ');
        const seed = Math.floor(Math.random() * 90000) + 10000;
        const s = X.blindSheet(ctx.project.experiment.entries, { seed, raters });
        ctx.commit((p) => { p.experiment.key = s.key; p.experiment.seed = seed; });
        download(slug(ctx.project.name) + '-rating-sheet.csv', s.csv, 'text/csv');
      },
      key(el, e, ctx) {
        const ex = ctx.project.experiment;
        const rows = ex.key.map((k) => { const en = ex.entries.find((x) => x.id === k.entryId) || {}; return { code: k.code, entry: k.entryId, participant: en.participant, condition: en.condition, concept: en.name }; });
        download(slug(ctx.project.name) + '-rating-key.csv', X.toCSV(rows, ['code', 'entry', 'participant', 'condition', 'concept']), 'text/csv');
      },
      async 'import-ratings'(el, e, ctx) {
        const file = el.files && el.files[0];
        if (!file) return;
        const ex = ctx.project.experiment;
        if (!ex.key || !ex.key.length) { toast('Generate a rating sheet first so codes can be matched', 'bad'); el.value = ''; return; }
        const res = X.importRatings(await readFile(file), ex.key);
        ctx.ui('study').importErrors = res.errors;
        ctx.commit((p) => {
          // replace earlier ratings from the same rater+code
          const keyOf = (r) => r.rater + '|' + r.code;
          const incoming = new Set(res.ratings.map(keyOf));
          p.experiment.ratings = p.experiment.ratings.filter((r) => !incoming.has(keyOf(r))).concat(res.ratings);
        });
        toast(res.ratings.length + ' ratings imported' + (res.errors.length ? ', ' + res.errors.length + ' problems' : ''), res.errors.length ? 'bad' : 'ok');
        el.value = '';
      },
      async 'clear-ratings'(el, e, ctx) { if (await confirmModal('Remove all imported ratings?', 'Remove')) ctx.commit((p) => { p.experiment.ratings = []; }); },
      'export-results'(el, e, ctx) {
        const last = lastResults;
        if (!last) return;
        const rows = last.metrics.map((m) => {
          const a = last.r.descriptive.A[m.id] || {}; const b = last.r.descriptive.B[m.id] || {}; const pr = last.r.paired[m.id] || {};
          return { metric: m.name, A_mean: a.mean, A_sd: a.sd, A_n: a.n, B_mean: b.mean, B_sd: b.sd, B_n: b.n, pairs: (pr.diffs || []).length, mean_diff: pr.meanDiff, W: pr.W, p: pr.p, method: pr.method, r: pr.r, cohen_dz: pr.dz };
        });
        download(slug(ctx.project.name) + '-study-results.csv', X.toCSV(rows), 'text/csv');
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
