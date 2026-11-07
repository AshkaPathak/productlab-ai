/* ProductLab AI - shared UI components and SVG charts */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  const { esc, fix, pct } = PL.ui;

  const STATUS_CLASS = { supported: 'ok', partial: 'warn', unsupported: 'bad', invalid: 'bad', uncited: 'none' };
  const STATUS_SHORT = { supported: 'Supported', partial: 'Partial', unsupported: 'Not supported', invalid: 'Missing evidence', uncited: 'Uncited' };

  function badge(status, extra) {
    return '<span class="badge ' + STATUS_CLASS[status] + '" title="' + esc(PL.evidence.STATUS[status].label + (extra || '')) + '">' + esc(STATUS_SHORT[status]) + '</span>';
  }

  function strengthDots(n) {
    const s = Math.max(0, Math.min(3, Number(n) || 0));
    return '<span class="dots" title="Source strength ' + s + '/3">' + '●'.repeat(s) + '<span class="off">' + '●'.repeat(3 - s) + '</span></span>';
  }

  function findingTitle(ctx, id) {
    const f = ctx.index.byId.get(id);
    if (!f) return id + ' does not exist';
    const r = ctx.index.refById.get(f.ref);
    return id + ': ' + f.text + (r ? '\n— ' + (r.org || (r.authors || [])[0] || '') + (r.year ? ' (' + r.year + ')' : '') : '');
  }

  /**
   * Citation editor for a list of evidence ids at `path` (e.g. "needs.N1.evidence"),
   * verified against `text`.
   */
  function citeEditor(ctx, path, ids, text, options) {
    const o = Object.assign({ compact: false }, options || {});
    const res = PL.evidence.verify(ctx.index, { text, evidence: ids || [] });
    const chips = (ids || []).map((id) => {
      const c = res.cited.find((x) => x.id === id) || { exists: false, score: 0 };
      const cls = !c.exists ? 'bad' : c.score >= ctx.index.opts.strong ? 'ok' : c.score >= ctx.index.opts.weak ? 'warn' : 'bad';
      return '<span class="chip ' + cls + '" title="' + esc(findingTitle(ctx, id) + (c.exists ? '\nSupport score ' + fix(c.score) : '')) + '">' + esc(id) +
        '<button class="x" data-act="cite-remove" data-path="' + esc(path) + '" data-id="' + esc(id) + '" aria-label="Remove ' + esc(id) + '">×</button></span>';
    }).join('');
    const sugg = res.suggestions.map((s) => '<button class="chip add" data-act="cite-add" data-path="' + esc(path) + '" data-id="' + esc(s.id) + '" title="' + esc(findingTitle(ctx, s.id) + '\nMatch ' + fix(s.score)) + '">+ ' + esc(s.id) + '</button>').join('');
    return '<div class="cite">' + badge(res.status) + chips +
      '<input class="cite-input" data-act="cite-input" data-path="' + esc(path) + '" placeholder="E#" aria-label="Add evidence id" size="4">' +
      (sugg ? '<span class="sugg" title="Suggested evidence">' + sugg + '</span>' : '') + '</div>';
  }

  function tabs(view, current, list) {
    return '<nav class="tabs" role="tablist">' + list.map((t) => '<button role="tab" aria-selected="' + (t.id === current) + '" class="tab' + (t.id === current ? ' active' : '') + '" data-act="tab" data-view="' + view + '" data-tab="' + t.id + '">' + esc(t.label) + (t.count != null ? ' <span class="count">' + t.count + '</span>' : '') + '</button>').join('') + '</nav>';
  }

  function empty(msg, action) {
    return '<div class="empty"><p>' + esc(msg) + '</p>' + (action || '') + '</div>';
  }

  function stat(label, value, hint) {
    return '<div class="stat"><div class="stat-value">' + value + '</div><div class="stat-label">' + esc(label) + '</div>' + (hint ? '<div class="stat-hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  /* ---------------- charts (plain SVG) ---------------- */

  const PALETTE = ['#7c5cff', '#22b8cf', '#f59f00', '#e64980', '#40c057', '#5c7cfa', '#fd7e14', '#868e96'];

  /** Horizontal stacked bars. rows: [{label, segments:[{value,label}], total}] */
  function stackedBars(rows, legend, options) {
    const o = Object.assign({ width: 640, max: null, unit: '' }, options || {});
    const labelW = 190; const barH = 26; const gap = 10; const top = legend ? 30 : 6;
    const max = o.max || Math.max(1e-9, ...rows.map((r) => r.total));
    const w = o.width - labelW - 60;
    const h = top + rows.length * (barH + gap);
    let svg = '<svg class="chart" viewBox="0 0 ' + o.width + ' ' + h + '" role="img" aria-label="Bar chart">';
    if (legend) legend.forEach((l, i) => { svg += '<rect x="' + (labelW + i * 110) + '" y="4" width="10" height="10" rx="2" fill="' + PALETTE[i % PALETTE.length] + '"/><text x="' + (labelW + i * 110 + 14) + '" y="13" class="lg">' + esc(l) + '</text>'; });
    rows.forEach((r, ri) => {
      const y = top + ri * (barH + gap);
      svg += '<text x="' + (labelW - 8) + '" y="' + (y + barH * 0.68) + '" text-anchor="end" class="lb">' + esc(r.label) + '</text>';
      let x = labelW;
      (r.segments || [{ value: r.total }]).forEach((s, si) => {
        const sw = (s.value / max) * w;
        svg += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(0, sw) + '" height="' + barH + '" fill="' + (s.color || PALETTE[si % PALETTE.length]) + '"' + (r.highlight ? '' : ' opacity="0.82"') + '><title>' + esc((s.label ? s.label + ': ' : '') + fix(s.value)) + '</title></rect>';
        x += sw;
      });
      svg += '<text x="' + (x + 6) + '" y="' + (y + barH * 0.68) + '" class="val">' + esc(r.display != null ? r.display : fix(r.total)) + '</text>';
    });
    return svg + '</svg>';
  }

  /** Positioning map. points: [{x, y, label, kind}] on 0-10 axes. */
  function scatter(points, axes) {
    const W = 560; const H = 380; const m = 46;
    const sx = (v) => m + (v / 10) * (W - 2 * m);
    const sy = (v) => H - m - (v / 10) * (H - 2 * m);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Positioning map">';
    svg += '<rect x="' + m + '" y="' + m + '" width="' + (W - 2 * m) + '" height="' + (H - 2 * m) + '" class="plot"/>';
    svg += '<line x1="' + sx(5) + '" y1="' + m + '" x2="' + sx(5) + '" y2="' + (H - m) + '" class="mid"/><line x1="' + m + '" y1="' + sy(5) + '" x2="' + (W - m) + '" y2="' + sy(5) + '" class="mid"/>';
    svg += '<text x="' + (W / 2) + '" y="' + (H - 12) + '" text-anchor="middle" class="ax">' + esc(axes.x) + ' →</text>';
    svg += '<text transform="translate(14 ' + (H / 2) + ') rotate(-90)" text-anchor="middle" class="ax">' + esc(axes.y) + ' →</text>';
    points.forEach((p) => {
      const us = p.kind === 'us';
      svg += '<g><circle cx="' + sx(p.x) + '" cy="' + sy(p.y) + '" r="' + (us ? 10 : 7) + '" class="pt' + (us ? ' us' : '') + '"><title>' + esc(p.label + ' (' + p.x + ', ' + p.y + ')') + '</title></circle>' +
        '<text x="' + (sx(p.x) + (us ? 14 : 11)) + '" y="' + (sy(p.y) + 4) + '" class="pl' + (us ? ' us' : '') + '">' + esc(p.label) + '</text></g>';
    });
    return svg + '</svg>';
  }

  /** Gantt chart from planning.schedule() tasks. */
  function gantt(sched) {
    const tasks = sched.tasks;
    if (!tasks.length) return '';
    const weeks = Math.max(1, Math.ceil(sched.totalWeeks));
    const labelW = 220; const W = 760; const rowH = 24; const top = 30;
    const pw = (W - labelW - 10) / weeks;
    const H = top + tasks.length * rowH + 10;
    const col = { Must: '#7c5cff', Should: '#22b8cf', Could: '#f59f00' };
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Roadmap">';
    const sprint = sched.settings.sprintWeeks;
    for (let wk = 0; wk <= weeks; wk += sprint) {
      const x = labelW + wk * pw;
      svg += '<line x1="' + x + '" y1="' + (top - 6) + '" x2="' + x + '" y2="' + (H - 6) + '" class="grid"/>';
      if (wk < weeks) svg += '<text x="' + (x + 3) + '" y="' + (top - 10) + '" class="ax small">S' + (wk / sprint + 1) + '</text>';
    }
    tasks.forEach((t, i) => {
      const y = top + i * rowH;
      svg += '<text x="' + (labelW - 8) + '" y="' + (y + 15) + '" text-anchor="end" class="lb">' + esc(t.name) + '</text>';
      svg += '<rect x="' + (labelW + t.start * pw) + '" y="' + (y + 4) + '" width="' + Math.max(3, (t.end - t.start) * pw) + '" height="' + (rowH - 8) + '" rx="4" fill="' + (col[t.moscow] || '#868e96') + '"><title>' + esc(t.name + ': weeks ' + fix(t.start, 1) + '–' + fix(t.end, 1) + ' (' + fix(t.effort, 1) + ' person-weeks incl. buffer)') + '</title></rect>';
    });
    return svg + '</svg>';
  }

  /**
   * Layered evidence graph: Sources -> Evidence -> Needs -> Concepts -> Features.
   * focus: optional node id; its neighbourhood is highlighted.
   */
  function evidenceGraph(project, focus) {
    const cols = [
      { key: 'ref', title: 'Sources', items: project.references.map((r) => ({ id: 'ref:' + r.id, label: r.id, title: r.title })) },
      { key: 'ev', title: 'Evidence', items: project.findings.map((f) => ({ id: 'ev:' + f.id, label: f.id, title: f.text })) },
      { key: 'need', title: 'Needs', items: project.needs.map((n) => ({ id: 'need:' + n.id, label: n.id, title: n.statement })) },
      { key: 'con', title: 'Concepts', items: project.concepts.map((c) => ({ id: 'con:' + c.id, label: c.name, title: c.tagline || c.description })) },
      { key: 'feat', title: 'Features', items: project.features.map((f) => ({ id: 'feat:' + f.id, label: f.name, title: f.description })) }
    ];
    const edges = [];
    project.findings.forEach((f) => edges.push(['ref:' + f.ref, 'ev:' + f.id]));
    project.needs.forEach((n) => (n.evidence || []).forEach((e) => edges.push(['ev:' + e, 'need:' + n.id])));
    project.concepts.forEach((c) => {
      (c.needs || []).forEach((n) => edges.push(['need:' + n, 'con:' + c.id]));
      (c.claims || []).forEach((cl) => (cl.evidence || []).forEach((e) => edges.push(['ev:' + e, 'con:' + c.id])));
    });
    project.features.forEach((f) => {
      (f.needs || []).forEach((n) => edges.push(['need:' + n, 'feat:' + f.id]));
      (f.evidence || []).forEach((e) => edges.push(['ev:' + e, 'feat:' + f.id]));
    });
    const W = 980; const colW = W / cols.length;
    const maxN = Math.max(...cols.map((c) => c.items.length), 1);
    const rowH = 22; const top = 34; const H = top + maxN * rowH + 10;
    const pos = new Map();
    cols.forEach((c, ci) => {
      const offset = (maxN - c.items.length) * rowH / 2;
      c.items.forEach((it, i) => pos.set(it.id, { x: ci * colW + 18, y: top + offset + i * rowH + 8, ci }));
    });
    const valid = edges.filter(([a, b]) => pos.has(a) && pos.has(b));
    const near = new Set();
    if (focus && pos.has(focus)) {
      // walk both directions through the layers
      const up = [focus]; const down = [focus]; near.add(focus);
      while (up.length) { const n = up.pop(); valid.forEach(([a, b]) => { if (b === n && !near.has(a + '^')) { near.add(a); near.add(a + '^'); up.push(a); } }); }
      while (down.length) { const n = down.pop(); valid.forEach(([a, b]) => { if (a === n && !near.has(b + 'v')) { near.add(b); near.add(b + 'v'); down.push(b); } }); }
    }
    const lit = (id) => !focus || near.has(id);
    let svg = '<svg class="chart graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evidence graph">';
    cols.forEach((c, ci) => { svg += '<text x="' + (ci * colW + 18) + '" y="16" class="ax">' + esc(c.title) + ' (' + c.items.length + ')</text>'; });
    valid.forEach(([a, b]) => {
      const p = pos.get(a); const q = pos.get(b);
      const on = focus ? (near.has(a) && near.has(b)) : true;
      const x1 = p.x + colW - 70; const x2 = q.x - 4;
      const mx = (x1 + x2) / 2;
      svg += '<path d="M' + Math.min(x1, p.x + 60) + ' ' + p.y + ' C' + mx + ' ' + p.y + ' ' + mx + ' ' + q.y + ' ' + x2 + ' ' + q.y + '" class="edge' + (on && focus ? ' on' : '') + (on ? '' : ' off') + '"/>';
    });
    cols.forEach((c) => c.items.forEach((it) => {
      const p = pos.get(it.id);
      svg += '<g class="node' + (lit(it.id) ? '' : ' dim') + (focus === it.id ? ' focus' : '') + '" data-act="graph-focus" data-node="' + esc(it.id) + '" tabindex="0"><circle cx="' + p.x + '" cy="' + p.y + '" r="5"/><text x="' + (p.x + 9) + '" y="' + (p.y + 4) + '">' + esc(it.label.length > 24 ? it.label.slice(0, 23) + '…' : it.label) + '</text><title>' + esc(it.title || it.label) + '</title></g>';
    }));
    return svg + '</svg>';
  }

  function riskMatrix(risks) {
    const cell = 46; const m = 40; const W = m + cell * 5 + 10; const H = m + cell * 5 + 30;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Risk matrix" style="max-width:340px">';
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        const sev = l * i;
        const fill = sev >= 15 ? '#e64980' : sev >= 8 ? '#f59f00' : '#40c057';
        svg += '<rect x="' + (m + (i - 1) * cell) + '" y="' + (10 + (5 - l) * cell) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" fill="' + fill + '" opacity="0.18" rx="4"/>';
      }
    }
    const byCell = {};
    risks.forEach((r) => { const k = r.likelihood + ':' + r.impact; (byCell[k] = byCell[k] || []).push(r.id); });
    Object.keys(byCell).forEach((k) => {
      const [l, i] = k.split(':').map(Number);
      svg += '<text x="' + (m + (i - 1) * cell + cell / 2 - 1) + '" y="' + (10 + (5 - l) * cell + cell / 2 + 4) + '" text-anchor="middle" class="lb">' + esc(byCell[k].join(' ')) + '</text>';
    });
    svg += '<text x="' + (m + cell * 2.5) + '" y="' + (H - 4) + '" text-anchor="middle" class="ax">Impact →</text>';
    svg += '<text transform="translate(14 ' + (10 + cell * 2.5) + ') rotate(-90)" text-anchor="middle" class="ax">Likelihood →</text>';
    return svg + '</svg>';
  }

  PL.comp = { badge, strengthDots, citeEditor, tabs, empty, stat, stackedBars, scatter, gantt, evidenceGraph, riskMatrix, PALETTE, findingTitle, pct };
})(typeof globalThis !== 'undefined' ? globalThis : this);
