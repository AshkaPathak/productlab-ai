/* ProductLab AI - Evidence view: findings, sources, evidence graph, import */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, formModal, nextId, download, readFile, toast, slug } = PL.ui;
  const C = PL.comp;

  const KINDS = ['statistic', 'insight', 'guideline', 'market', 'regulation', 'interview', 'observation'];
  const REF_TYPES = [
    { value: 'journal', label: 'Journal article' }, { value: 'review', label: 'Systematic review' }, { value: 'guideline', label: 'Clinical/technical guideline' },
    { value: 'report', label: 'Report (organisation)' }, { value: 'law', label: 'Law / regulation' }, { value: 'web', label: 'Web page' },
    { value: 'news', label: 'News / media' }, { value: 'primary', label: 'Primary research (our interviews, surveys)' }
  ];

  function usage(project) {
    const map = new Map();
    PL.evidence.claimsOf(project).forEach((c) => (c.evidence || []).forEach((id) => {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(c.group + ': ' + c.label);
    }));
    return map;
  }

  function refShort(r) {
    if (!r) return 'Unknown source';
    const who = r.org || ((r.authors || [])[0] || '').split(/\s+/).slice(-1)[0] + ((r.authors || []).length > 1 ? ' et al.' : '');
    return who + (r.year ? ' ' + r.year : '');
  }

  async function editFinding(ctx, f) {
    const p = ctx.project;
    const v = await formModal(f ? 'Edit evidence ' + f.id : 'Add evidence', [
      { name: 'text', label: 'Finding', type: 'textarea', rows: 3, value: f ? f.text : '', required: true, help: 'One atomic fact or insight, as reported by the source. Keep numbers exactly as published.' },
      { name: 'kind', label: 'Kind', type: 'select', options: KINDS, value: f ? f.kind : 'statistic' },
      { name: 'ref', label: 'Source', type: 'select', options: p.references.map((r) => ({ value: r.id, label: r.id + ' – ' + refShort(r) + ' – ' + (r.title || '').slice(0, 60) })), value: f ? f.ref : (p.references[0] || {}).id },
      { name: 'locator', label: 'Where in the source', value: f ? f.locator : '', help: 'e.g. Abstract, Table 2, p. 14' },
      { name: 'tags', label: 'Tags (comma separated)', value: f ? (f.tags || []).join(', ') : '' }
    ], { intro: p.references.length ? '' : 'Add a source first (Sources tab) so this finding can be cited.' });
    if (!v || !v.text) return;
    ctx.commit((pr) => {
      const data = { text: v.text, kind: v.kind, ref: v.ref, locator: v.locator, tags: v.tags.split(',').map((x) => x.trim()).filter(Boolean) };
      if (f) Object.assign(pr.findings.find((x) => x.id === f.id), data);
      else pr.findings.push(Object.assign({ id: nextId(pr.findings, 'E') }, data));
    });
  }

  async function editRef(ctx, r) {
    const v = await formModal(r ? 'Edit source ' + r.id : 'Add source', [
      { name: 'type', label: 'Type', type: 'select', options: REF_TYPES, value: r ? r.type : 'journal' },
      { name: 'authors', label: 'Authors (one per line, e.g. "M. Gibson-Helm")', type: 'textarea', value: r ? (r.authors || []).join('\n') : '' },
      { name: 'org', label: 'or Organisation as author', value: r ? r.org || '' : '' },
      { name: 'title', label: 'Title', value: r ? r.title : '', required: true },
      { name: 'venue', label: 'Journal / publisher / website', value: r ? r.venue || '' : '' },
      { name: 'year', label: 'Year', type: 'number', value: r ? r.year || '' : '' },
      { name: 'volume', label: 'Volume', value: r ? r.volume || '' : '' },
      { name: 'issue', label: 'Issue', value: r ? r.issue || '' : '' },
      { name: 'pages', label: 'Pages or article number', value: r ? r.pages || '' : '' },
      { name: 'doi', label: 'DOI', value: r ? r.doi || '' : '' },
      { name: 'url', label: 'URL', value: r ? r.url || '' : '' },
      { name: 'accessed', label: 'Accessed (YYYY-MM-DD, for web pages)', value: r ? r.accessed || '' : '' },
      { name: 'strength', label: 'Source strength', type: 'select', value: r ? r.strength : 2, options: [{ value: 3, label: '3 – systematic review, guideline, national survey' }, { value: 2, label: '2 – peer-reviewed primary study, own structured research' }, { value: 1, label: '1 – news, industry, grey literature, anecdote' }] }
    ]);
    if (!v || !v.title) return;
    ctx.commit((p) => {
      const data = Object.assign({}, v, { authors: v.authors.split('\n').map((x) => x.trim()).filter(Boolean), strength: Number(v.strength) || 1, year: v.year === '' ? undefined : v.year });
      Object.keys(data).forEach((k) => { if (data[k] === '' || data[k] === undefined) delete data[k]; });
      if (!data.authors.length) delete data.authors;
      if (r) { const t = p.references.find((x) => x.id === r.id); Object.keys(t).forEach((k) => { if (k !== 'id') delete t[k]; }); Object.assign(t, data); }
      else p.references.push(Object.assign({ id: nextId(p.references, 'R') }, data));
    });
  }

  function findingsTab(ctx, u) {
    const p = ctx.project;
    const use = usage(p);
    const refs = new Map(p.references.map((r) => [r.id, r]));
    let rows = p.findings.slice();
    let scores = null;
    if (u.q) {
      const hits = PL.evidence.search(ctx.index, u.q);
      scores = new Map(hits.map((h) => [h.id, h.score]));
      rows = hits.map((h) => p.findings.find((f) => f.id === h.id)).filter(Boolean);
    }
    if (u.kind) rows = rows.filter((f) => f.kind === u.kind);
    const table = rows.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Finding</th><th>Kind</th><th>Source</th><th>Used by</th>' + (scores ? '<th class="num">Match</th>' : '') + '<th></th></tr></thead><tbody>' +
      rows.map((f) => {
        const r = refs.get(f.ref);
        const used = use.get(f.id) || [];
        return '<tr><td class="mono">' + esc(f.id) + '</td><td>' + esc(f.text) + ((f.tags || []).length ? '<div class="muted">' + esc(f.tags.join(', ')) + '</div>' : '') + '</td>' +
          '<td><span class="pill grey">' + esc(f.kind || '') + '</span></td>' +
          '<td class="small"><span title="' + esc(r ? r.title : '') + '">' + esc(f.ref || '') + ' ' + esc(refShort(r)) + '</span><br>' + C.strengthDots(r ? r.strength : 0) + (f.locator ? ' <span class="muted">' + esc(f.locator) + '</span>' : '') + '</td>' +
          '<td class="small"><span title="' + esc(used.join('\n')) + '">' + (used.length ? used.length + ' claim' + (used.length > 1 ? 's' : '') : '<span class="muted">unused</span>') + '</span></td>' +
          (scores ? '<td class="num">' + fix(scores.get(f.id)) + '</td>' : '') +
          '<td><button class="icon-btn" data-act="edit-finding" data-id="' + esc(f.id) + '" aria-label="Edit ' + esc(f.id) + '">' + C.icon('pencil') + '</button><button class="icon-btn" data-act="del" data-path="findings.' + esc(f.id) + '" data-confirm="Delete evidence ' + esc(f.id) + '? Claims citing it will show as citing missing evidence." aria-label="Delete ' + esc(f.id) + '">' + C.icon('x') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' : C.empty(u.q ? 'No evidence matches “' + u.q + '”.' : 'No evidence yet. Add findings from papers, reports, interviews or surveys.');
    return (u.q || u.kind ? '' : '<div class="card"><h2>Evidence in use</h2>' + PL.fig.evidenceUse(p) + '</div>') + '<div class="card"><div class="row" style="margin-bottom:12px"><input type="search" placeholder="Semantic search: e.g. “how long does diagnosis take”" style="flex:1;min-width:220px" data-live="search" data-focus="ev-search" value="' + esc(u.q || '') + '" aria-label="Search evidence">' +
      '<select data-act="uiset" data-view="evidence" data-key="kind" aria-label="Filter by kind"><option value="">All kinds</option>' + KINDS.map((k) => '<option' + (u.kind === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select>' +
      '<button class="btn primary" data-act="add-finding">+ Add evidence</button></div>' + table + '</div>';
  }

  function sourcesTab(ctx) {
    const p = ctx.project;
    const count = (id) => p.findings.filter((f) => f.ref === id).length;
    return '<div class="card"><h2>Where the evidence comes from</h2>' + PL.fig.sourceMap(p) + '</div><div class="card"><div class="row between" style="margin-bottom:10px"><p class="muted small" style="margin:0">References are formatted in IEEE style, ready for your paper. Source strength weights how much a citation counts.</p>' +
      '<div class="row"><button class="btn" data-act="ieee">Download IEEE list</button><button class="btn primary" data-act="add-ref">+ Add source</button></div></div>' +
      (p.references.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Reference (IEEE)</th><th>Strength</th><th class="num">Findings</th><th></th></tr></thead><tbody>' +
        p.references.map((r) => '<tr><td class="mono">' + esc(r.id) + '</td><td class="small">' + esc(PL.evidence.formatIEEE(r)) + (r.url ? ' <a href="' + esc(r.url) + '" target="_blank" rel="noopener">open</a>' : r.doi ? ' <a href="https://doi.org/' + esc(r.doi) + '" target="_blank" rel="noopener">doi</a>' : '') + '</td>' +
          '<td><select data-act="set" data-type="number" data-path="references.' + esc(r.id) + '.strength" aria-label="Strength">' + [3, 2, 1].map((s) => '<option' + (Number(r.strength) === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td>' +
          '<td class="num">' + count(r.id) + '</td><td><button class="icon-btn" data-act="edit-ref" data-id="' + esc(r.id) + '" aria-label="Edit">' + C.icon('pencil') + '</button><button class="icon-btn" data-act="del" data-path="references.' + esc(r.id) + '" data-confirm="Delete source ' + esc(r.id) + '?" aria-label="Delete">' + C.icon('x') + '</button></td></tr>').join('') +
        '</tbody></table></div>' : C.empty('No sources yet.')) + '</div>';
  }

  function graphTab(ctx, u) {
    const p = ctx.project;
    let detail = '<p class="muted small">Click any node to trace it back to its sources and forward to the needs, concepts and features that depend on it.</p>';
    if (u.focus) {
      const [kind, id] = u.focus.split(':');
      const obj = kind === 'ref' ? p.references.find((x) => x.id === id) : kind === 'ev' ? p.findings.find((x) => x.id === id) : kind === 'need' ? p.needs.find((x) => x.id === id) : kind === 'con' ? p.concepts.find((x) => x.id === id) : p.features.find((x) => x.id === id);
      const text = !obj ? '' : kind === 'ref' ? PL.evidence.formatIEEE(obj) : kind === 'ev' ? obj.text : kind === 'need' ? obj.statement : kind === 'con' ? obj.name + ' – ' + (obj.description || '') : obj.name + ' – ' + (obj.description || '');
      detail = '<div class="infobox"><b>' + esc(id) + '</b> ' + esc(text) + ' <button class="btn small" data-act="uiset" data-view="evidence" data-key="focus" data-value="">Clear</button></div>';
    }
    return '<div class="card">' + detail + '<div class="table-wrap">' + C.evidenceGraph(p, u.focus) + '</div></div>';
  }

  function importTab() {
    return '<div class="grid two"><div class="card"><h2>Paste interview or survey notes</h2>' +
      '<p class="muted small">One insight per line. Each line becomes an evidence finding linked to a primary-research source, so your own interviews count as evidence alongside published studies.</p>' +
      '<div class="field"><label>Source label</label><input id="imp-label" class="wide" placeholder="e.g. Student interviews, Nov 2026 (n=6)"></div>' +
      '<div class="field"><label>Notes</label><textarea id="imp-notes" rows="8" placeholder="P1: I was told it was just stress for two years\nP2: I only trust what my gynaecologist says\n…"></textarea></div>' +
      '<button class="btn primary" data-act="import-notes">Add as evidence</button></div>' +
      '<div class="card"><h2>Import CSV</h2><p class="muted small">Columns: <span class="mono">text, kind, source, tags, locator</span>. Rows with the same <span class="mono">source</span> are grouped under one reference (matched by title or ID).</p>' +
      '<div class="row"><button class="btn" data-act="csv-template">Download template</button><label class="btn primary" for="imp-csv">Choose CSV…</label><input id="imp-csv" type="file" accept=".csv,text/csv" hidden data-act="import-csv"></div></div></div>';
  }

  PL.views.evidence = {
    render(ctx) {
      const u = ctx.ui('evidence');
      const tab = u.tab || 'findings';
      const p = ctx.project;
      const body = tab === 'sources' ? sourcesTab(ctx) : tab === 'graph' ? graphTab(ctx, u) : tab === 'import' ? importTab(ctx) : findingsTab(ctx, u);
      return C.tabs('evidence', tab, [
        { id: 'findings', label: 'Evidence findings', count: p.findings.length },
        { id: 'sources', label: 'Sources', count: p.references.length },
        { id: 'graph', label: 'Evidence graph' },
        { id: 'import', label: 'Import' }
      ]) + body;
    },
    after(ctx, app) {
      const s = app.querySelector('[data-focus="ev-search"]');
      if (s && document.activeElement === s) { const n = s.value.length; s.setSelectionRange(n, n); }
    },
    actions: {
      search(el, e, ctx) { ctx.ui('evidence').q = el.value; ctx.render(); },
      'add-finding'(el, e, ctx) { return editFinding(ctx, null); },
      'edit-finding'(el, e, ctx) { return editFinding(ctx, ctx.project.findings.find((f) => f.id === el.dataset.id)); },
      'add-ref'(el, e, ctx) { return editRef(ctx, null); },
      'edit-ref'(el, e, ctx) { return editRef(ctx, ctx.project.references.find((r) => r.id === el.dataset.id)); },
      'graph-focus'(el, e, ctx) { const u = ctx.ui('evidence'); u.focus = u.focus === el.dataset.node ? '' : el.dataset.node; ctx.render(); },
      ieee(el, e, ctx) {
        const txt = ctx.project.references.map((r, i) => '[' + (i + 1) + '] ' + PL.evidence.formatIEEE(r)).join('\n');
        download(slug(ctx.project.name) + '-references.txt', txt);
      },
      'import-notes'(el, e, ctx) {
        const label = document.getElementById('imp-label').value.trim() || 'Team primary research';
        const lines = document.getElementById('imp-notes').value.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) { toast('Paste at least one line of notes', 'bad'); return; }
        ctx.commit((p) => {
          const rid = nextId(p.references, 'R');
          p.references.push({ id: rid, type: 'primary', strength: 2, org: (p.team && p.team.length ? p.team.join(', ') : 'Project team'), title: label, venue: 'Primary research (unpublished)', year: new Date().getFullYear() });
          lines.forEach((t) => p.findings.push({ id: nextId(p.findings, 'E'), ref: rid, kind: 'interview', text: t, tags: [], locator: 'Notes' }));
        });
        toast(lines.length + ' findings added', 'ok');
        ctx.ui('evidence').tab = 'findings'; ctx.render();
      },
      'csv-template'() {
        download('evidence-template.csv', PL.experiment.toCSV([{ text: 'Only 15.6% were satisfied with the information they received', kind: 'statistic', source: 'Gibson-Helm et al. 2017', tags: 'information; satisfaction', locator: 'Results' }], ['text', 'kind', 'source', 'tags', 'locator']), 'text/csv');
      },
      async 'import-csv'(el, e, ctx) {
        const file = el.files && el.files[0];
        if (!file) return;
        const rows = PL.experiment.parseCSV(await readFile(file)).filter((r) => r.text);
        if (!rows.length) { toast('No rows with a "text" column found', 'bad'); el.value = ''; return; }
        ctx.commit((p) => rows.forEach((r) => {
          const key = (r.source || 'Imported evidence').trim();
          let ref = p.references.find((x) => x.id === key || x.title === key);
          if (!ref) { ref = { id: nextId(p.references, 'R'), type: 'report', strength: 1, title: key }; p.references.push(ref); }
          p.findings.push({ id: nextId(p.findings, 'E'), ref: ref.id, kind: KINDS.includes(r.kind) ? r.kind : 'insight', text: r.text, tags: (r.tags || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean), locator: r.locator || '' });
        }));
        toast(rows.length + ' findings imported. Check the new sources and set their strength.', 'ok');
        el.value = '';
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
