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
        '<button class="x" data-act="cite-remove" data-path="' + esc(path) + '" data-id="' + esc(id) + '" aria-label="Remove ' + esc(id) + '">' + icon('x') + '</button></span>';
    }).join('');
    const sugg = res.suggestions.map((s) => '<button class="chip add" data-act="cite-add" data-path="' + esc(path) + '" data-id="' + esc(s.id) + '" title="' + esc(findingTitle(ctx, s.id) + '\nMatch ' + fix(s.score)) + '">+ ' + esc(s.id) + '</button>').join('');
    return '<div class="cite">' + badge(res.status) + chips +
      '<input class="cite-input" data-act="cite-input" data-path="' + esc(path) + '" placeholder="E#" aria-label="Add evidence id" size="4">' +
      (sugg ? '<span class="sugg" title="Suggested evidence">' + sugg + '</span>' : '') + '</div>';
  }

  /* One line-icon set: 1.6px strokes, round caps, 16px grid. */
  const ICON = {
    x: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    pencil: '<path d="M10.6 3.2l2.2 2.2-7.3 7.3-2.8.6.6-2.8z"/><path d="M9.3 4.5l2.2 2.2"/>',
    note: '<path d="M4 2.8h5.5L12 5.3v7.9H4z"/><path d="M9.3 2.8v2.6H12M6 8.2h4M6 10.6h3"/>',
    redo: '<path d="M12.6 7.5A4.8 4.8 0 1 1 11 4"/><path d="M11.4 1.8V4.4H8.8"/>'
  };
  function icon(name, label) {
    return '<svg class="ic" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + (ICON[name] || '') + '</svg>';
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

  // Validated categorical order (see figures.js); colour follows position in the legend.
  const PALETTE = ['#5866ec', '#d8961c', '#1f9e8f', '#e0604e', '#9a5fc0', '#7f8a2e'];

  /** Horizontal stacked bars. rows: [{label, segments:[{value,label}], total}] */
  function stackedBars(rows, legend, options) {
    const o = Object.assign({ width: 640, max: null, unit: '' }, options || {});
    // size the label column to the longest name (about 6.9 units per character at 12.5px), within limits
    const CH = 6.9; const MAXW = Math.min(300, Math.round(o.width * 0.42));
    const longest = Math.max(0, ...rows.map((r) => String(r.label || '').length));
    const labelW = Math.max(120, Math.min(MAXW, Math.round(longest * CH + 16)));
    const fit = (t) => { const n = Math.floor((labelW - 16) / CH); const str = String(t || ''); return str.length > n ? str.slice(0, Math.max(1, n - 1)).trimEnd() + '\u2026' : str; };
    const barH = 26; const gap = 10; const top = legend ? 30 : 6;
    const max = o.max || Math.max(1e-9, ...rows.map((r) => r.total));
    const w = o.width - labelW - 60;
    const h = top + rows.length * (barH + gap);
    let svg = '<svg class="chart" viewBox="0 0 ' + o.width + ' ' + h + '" role="img" aria-label="Bar chart">';
    const step = legend ? Math.min(110, (o.width - labelW) / legend.length) : 0;
    if (legend) legend.forEach((l, i) => { svg += '<rect x="' + (labelW + i * step) + '" y="4" width="10" height="10" rx="5" fill="' + PALETTE[i % PALETTE.length] + '"/><text x="' + (labelW + i * step + 14) + '" y="13" class="lg">' + esc(l) + '</text>'; });
    rows.forEach((r, ri) => {
      const y = top + ri * (barH + gap);
      svg += '<text x="' + (labelW - 8) + '" y="' + (y + barH * 0.68) + '" text-anchor="end" class="lb"><title>' + esc(r.label) + '</title>' + esc(fit(r.label)) + '</text>';
      let x = labelW;
      (r.segments || [{ value: r.total }]).forEach((s, si) => {
        const sw = (s.value / max) * w;
        svg += '<rect x="' + x + '" y="' + y + '" width="' + Math.max(0, sw) + '" height="' + barH + '" rx="4" fill="' + (s.color || 'url(#cg-' + (si % PALETTE.length) + ')') + '" stroke="#fff" stroke-width="2"' + (r.highlight ? '' : ' opacity="0.62"') + '><title>' + esc((s.label ? s.label + ': ' : '') + fix(s.value)) + '</title></rect>';
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
    const col = { Must: 'url(#cg-0)', Should: 'url(#cg-1)', Could: 'url(#cg-2)' };
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Roadmap">';
    const sprint = sched.settings.sprintWeeks;
    for (let wk = 0; wk <= weeks; wk += sprint) {
      const x = labelW + wk * pw;
      svg += '<line x1="' + x + '" y1="' + (top - 6) + '" x2="' + x + '" y2="' + (H - 6) + '" class="grid"/>';
      if (wk < weeks) svg += '<text x="' + (x + 3) + '" y="' + (top - 10) + '" class="ax small">S' + (wk / sprint + 1) + '</text>';
    }
    tasks.forEach((t, i) => {
      const y = top + i * rowH;
      svg += '<text x="' + (labelW - 8) + '" y="' + (y + 15) + '" text-anchor="end" class="lb">' + esc(t.name.length > 30 ? t.name.slice(0, 29) + '\u2026' : t.name) + '</text>';
      svg += '<rect x="' + (labelW + t.start * pw) + '" y="' + (y + 4) + '" width="' + Math.max(3, (t.end - t.start) * pw) + '" height="' + (rowH - 8) + '" rx="8" fill="' + (col[t.moscow] || '#cfc6dc') + '"><title>' + esc(t.name + ': weeks ' + fix(t.start, 1) + '–' + fix(t.end, 1) + ' (' + fix(t.effort, 1) + ' person-weeks incl. buffer)') + '</title></rect>';
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
        const fill = sev >= 15 ? '#cf4b63' : sev >= 8 ? '#e0a144' : '#3a9a6c';
        svg += '<rect x="' + (m + (i - 1) * cell) + '" y="' + (10 + (5 - l) * cell) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" fill="' + fill + '" opacity="0.2" rx="10"/>';
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

  /* ---------------- glass graphics ----------------
   * Everything is drawn from one set of shared gradients (injected once into
   * the page): glossy orbs for marks and portraits, and clear glass spheres
   * that fill with liquid to show progress. One accent (cyan) means
   * "current / act here"; the rest of the palette stays soft.
   */

  /* Brand colours. Thinking (research, people, ideas, decisions) is blueprint
     blue; building is amber; a coral spark marks creative moments. Story pages
     re-tint the same slots to match each project (see theme.js). */
  const INK = { ink: '#161a3a', ink2: '#3e4366', think: '#4f5ff0', thinkInk: '#2f3fd6', thinkSoft: '#e9ebff', build: '#ffb21e', buildSoft: '#fff2d2', spark: '#ff6a55', paper: '#f5f3ec', white: '#ffffff', line: '#e2dfd5' };

  /* [highlight, body, shade] per tone slot. Gradients read these through CSS
     variables (--tn-<slot>-0..2), so a theme can override any slot. */
  const TONES = {
    ink: ['#5d6396', '#161a3a', '#0b0d24'], deep: ['#8c92c9', '#3a418a', '#1c2160'], soft: ['#ffffff', '#d9dcf5', '#a4aad8'],
    mist: ['#ffffff', '#efede6', '#cfcbbf'], think: ['#e2e5ff', '#5b6cff', '#2a35b8'], build: ['#fff1c9', '#ffb21e', '#d07a00'],
    spark: ['#ffe0da', '#ff6a55', '#c23a2a'], sea: ['#d2f1f4', '#2fa7b8', '#17707d'], gold: ['#f6e8bd', '#c9a95a', '#8c7130'],
    teal: ['#c6f0e8', '#1f9e8f', '#0f6359'], ok: ['#c8eed9', '#3a9a6c', '#1f6b47'], warn: ['#fde6c1', '#e0a144', '#a2681a'],
    bad: ['#f8ccd4', '#cf4b63', '#8e2340'], bad2: ['#e9a9b6', '#8e2340', '#5a1027'],
    // brand-only slots: never re-tinted by a project theme (the logo stays ProductLab)
    brandBuild: ['#fff1c9', '#ffb21e', '#d07a00'], brandThink: ['#e2e5ff', '#5b6cff', '#2a35b8']
  };
  const LIQUID = { think: ['#9aa6ff', '#3341d6'], build: ['#ffd77a', '#f09400'], spark: ['#ffb2a6', '#e5483a'], deep: ['#8c92c9', '#2a2f72'], mist: ['#f4f2ec', '#d9d5c9'] };

  function toneVars() {
    let css = '';
    Object.keys(TONES).forEach((k) => TONES[k].forEach((c, i) => { css += '--tn-' + k + '-' + i + ':' + c + ';'; }));
    Object.keys(LIQUID).forEach((k) => LIQUID[k].forEach((c, i) => { css += '--lq-' + k + '-' + i + ':' + c + ';'; }));
    return ':root{' + css + '}';
  }

  function defs() {
    const stop = (o, v, extra) => '<stop offset="' + o + '" style="stop-color:var(' + v + ')' + (extra || '') + '"/>';
    let g = '';
    Object.keys(TONES).forEach((k) => {
      g += '<radialGradient id="g-' + k + '" cx="34%" cy="28%" r="78%">' + stop(0, '--tn-' + k + '-0') + stop('.55', '--tn-' + k + '-1') + stop(1, '--tn-' + k + '-2') + '</radialGradient>';
    });
    Object.keys(LIQUID).forEach((k) => {
      g += '<linearGradient id="liq-' + k + '" x1="0" y1="0" x2="0" y2="1">' + stop(0, '--lq-' + k + '-0') + stop(1, '--lq-' + k + '-1') + '</linearGradient>';
    });
    const mix = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('');
    PALETTE.forEach((c, i) => { g += '<linearGradient id="cg-' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + mix(c, 0.38) + '"/><stop offset=".55" stop-color="' + mix(c, 0.12) + '"/><stop offset="1" stop-color="' + c + '"/></linearGradient>'; });
    g += '<radialGradient id="g-shine" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="g-clear" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".6" stop-color="#f3f2f8" stop-opacity=".55"/><stop offset="1" stop-color="#cfd2ea" stop-opacity=".8"/></radialGradient>' +
      '<radialGradient id="g-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#161a3a" stop-opacity=".22"/><stop offset="1" stop-color="#161a3a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="g-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>';
    return '<svg id="pl-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>' + g + '</defs></svg>';
  }
  if (root.document && root.document.head && !root.document.getElementById('pl-tones')) root.document.head.insertAdjacentHTML('beforeend', '<style id="pl-tones">' + toneVars() + '</style>');
  if (root.document && root.document.body && !root.document.getElementById('pl-defs')) root.document.body.insertAdjacentHTML('afterbegin', defs());

  let uid = 0;

  /** A glossy orb: tinted body, soft specular highlight, bright rim. */
  function orb(cx, cy, r, tone, o) {
    const opt = Object.assign({ shadow: false, rim: true }, o || {});
    const t = TONES[tone] ? tone : 'mist';
    return '<g class="orb">' +
      (opt.shadow ? '<ellipse cx="' + cx + '" cy="' + (cy + r * 0.92).toFixed(1) + '" rx="' + (r * 0.8).toFixed(1) + '" ry="' + (r * 0.16).toFixed(1) + '" fill="url(#g-glow)"/>' : '') +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#g-' + t + ')"/>' +
      '<ellipse cx="' + (cx - r * 0.26).toFixed(1) + '" cy="' + (cy - r * 0.42).toFixed(1) + '" rx="' + (r * 0.52).toFixed(1) + '" ry="' + (r * 0.3).toFixed(1) + '" fill="url(#g-shine)" opacity=".85"/>' +
      (opt.rim ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 0.6).toFixed(1) + '" fill="none" stroke="url(#g-rim)" stroke-width="1.2"/>' : '') + '</g>';
  }

  /** A clear glass sphere holding liquid up to `level` (0..1); `wave` animates the surface. */
  function sphere(cx, cy, r, level, liquid, o) {
    const opt = Object.assign({ wave: false, dashed: false, shadow: true }, o || {});
    const id = 'sp' + (++uid);
    const lv = Math.max(0, Math.min(1, level || 0));
    const top = cy + r - 2 * r * lv;
    const amp = lv > 0 && lv < 1 ? Math.max(2, r * 0.06) : 0;
    // a wave train eight wavelengths long (wavelength = r), so sliding it left by
    // one wavelength (12.5% of its width) loops seamlessly
    const L = r; let d = 'M' + (cx - 2 * r).toFixed(1) + ' ' + top.toFixed(1);
    for (let i = 0; i < 8; i++) d += ' q' + (L / 4).toFixed(2) + ' ' + (-amp).toFixed(2) + ' ' + (L / 2).toFixed(2) + ' 0 t' + (L / 2).toFixed(2) + ' 0';
    d += ' V' + (cy + r + 2).toFixed(1) + ' H' + (cx - 2 * r).toFixed(1) + ' Z';
    return '<g class="sphere">' +
      (opt.shadow ? '<ellipse cx="' + cx + '" cy="' + (cy + r + 6) + '" rx="' + (r * 0.72).toFixed(1) + '" ry="' + (r * 0.12).toFixed(1) + '" fill="url(#g-glow)"/>' : '') +
      '<clipPath id="' + id + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 1.5) + '"/></clipPath>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#g-clear)"/>' +
      (lv > 0 ? '<g clip-path="url(#' + id + ')"><path class="liquid' + (opt.wave ? ' wave' : '') + '" d="' + d + '" fill="url(#liq-' + (LIQUID[liquid] ? liquid : 'build') + ')"/></g>' : '') +
      '<ellipse cx="' + (cx - r * 0.3).toFixed(1) + '" cy="' + (cy - r * 0.45).toFixed(1) + '" rx="' + (r * 0.46).toFixed(1) + '" ry="' + (r * 0.24).toFixed(1) + '" fill="url(#g-shine)" opacity=".9"/>' +
      '<circle class="rim' + (opt.dashed ? ' pending' : '') + '" cx="' + cx + '" cy="' + cy + '" r="' + (r - 0.7) + '" fill="none"/></g>';
  }

  function logo() {
    return '<svg class="logo" viewBox="0 0 34 34" aria-hidden="true">' + orb(17, 18, 14, 'brandBuild') + orb(11.5, 11, 5.5, 'brandThink', { rim: false }) + '</svg>';
  }

  /** Small mark beside page titles. */
  function motif() {
    return '<svg viewBox="0 0 40 40" aria-hidden="true">' + orb(22, 22, 14, 'soft') + orb(13, 13, 7, 'think') + '</svg>';
  }

  /** Cluster of glass orbs for dark heroes. */
  function heroArt() {
    return '<svg class="hero-art" viewBox="0 0 380 300" aria-hidden="true">' + orb(238, 168, 112, 'build') + orb(118, 206, 58, 'soft') + orb(140, 88, 34, 'think') + '</svg>';
  }

  /**
   * The signature graphic: a row of glass spheres, one per stage, each filled
   * with liquid to show how far that stage has got.
   * stages: [{label, state: pending|running|done|warn|failed|skipped, fill (0..1), big, sub, href, current}]
   */
  function press(stages, options) {
    const o = Object.assign({ r: 66, gap: 168, label: 'Pipeline', enter: false }, options || {});
    const r = o.r; const n = stages.length;
    const W = 2 * r + (n - 1) * o.gap + 24; const cy = r + 12; const H = cy + r + 60;
    let svg = '<svg class="press' + (o.enter ? ' enter' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label) + '">';
    svg += '<line class="thread" x1="' + (12 + r) + '" y1="' + cy + '" x2="' + (12 + r + (n - 1) * o.gap) + '" y2="' + cy + '"/>';
    stages.forEach((s, i) => {
      const cx = 12 + r + i * o.gap;
      const st = s.state || 'pending';
      const pending = st === 'pending' || st === 'skipped';
      const accent = st === 'running' || s.current;
      const level = pending ? 0 : st === 'running' ? 0.5 : st === 'failed' ? 0.12 : Math.max(0.28, Math.min(0.9, (s.fill == null ? 1 : s.fill) * 0.9));
      const body = sphere(cx, cy, r, level, st === 'failed' ? 'mist' : s.kind === 'build' ? 'build' : 'think', { wave: st === 'running', dashed: pending, shadow: r > 30 }) +
        (st === 'failed' ? '<path class="failmark" d="M' + (cx - 14) + ' ' + (cy - 14) + 'l28 28M' + (cx + 14) + ' ' + (cy - 14) + 'l-28 28"/>' : '') +
        (s.big != null && st !== 'failed' && !pending ? '<text class="big" x="' + cx + '" y="' + (cy + r * 0.2) + '">' + esc(s.big) + '</text>' : '') +
        '<text class="lbl" x="' + cx + '" y="' + (cy + r + 28) + '">' + esc(s.label) + '</text>' +
        (s.sub ? '<text class="sub" x="' + cx + '" y="' + (cy + r + 47) + '">' + esc(s.sub) + '</text>' : '');
      const cls = 'stage' + (st === 'running' ? ' running' : '') + (s.justDone ? ' just-done' : '') + (accent ? ' current' : '');
      svg += s.href ? '<a class="' + cls + '" style="--i:' + i + '" href="' + esc(s.href) + '" aria-label="' + esc(s.label + (s.sub ? ': ' + s.sub : '')) + '">' + body + '</a>'
        : '<g class="' + cls + '" style="--i:' + i + '">' + body + '</g>';
    });
    return svg + '</svg>';
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const AVATAR_TONES = ['deep', 'sea', 'build', 'spark', 'teal', 'gold'];
  function initials(name) {
    const words = String(name || '?').replace(/^(the|a|an)\s+/i, '').split(/[\s\-/]+/).filter((w) => /[A-Za-z0-9]/.test(w));
    return ((words[0] || '?')[0] + (words[1] ? words[1][0] : '')).toUpperCase();
  }

  /** Monogram portrait: a glossy orb in a tone chosen from the name, with serif initials. */
  function avatar(name) {
    const tone = AVATAR_TONES[hash(String(name || '?')) % AVATAR_TONES.length];
    return '<svg class="avatar" viewBox="0 0 64 64" role="img" aria-label="' + esc(name || '') + '">' + orb(32, 32, 30, tone) +
      '<text x="32" y="41" text-anchor="middle" class="mono-initials">' + esc(initials(name)) + '</text></svg>';
  }

  /** Stack of plates: [{label, value}] */
  function plates(rows) {
    return '<ol class="plates stagger">' + rows.map((r, i) => '<li class="plate" style="--i:' + i + '"><b>' + esc(r.label) + '</b><span>' + esc(r.value) + '</span></li>').join('') + '</ol>';
  }

  /** Progress of each workflow step for a project. */
  function stepProgress(p, audit) {
    const rated = p.concepts.length && p.concepts.every((c) => p.criteria.every((k) => p.ratings[c.id] && p.ratings[c.id][k.id] && p.ratings[c.id][k.id].value !== '' && p.ratings[c.id][k.id].value != null));
    const a = audit || PL.evidence.audit(p);
    return [
      { id: 'evidence', label: 'Evidence', done: Math.min(1, p.findings.length / 10), big: p.findings.length, sub: p.references.length + ' sources', detail: p.findings.length + ' findings from ' + p.references.length + ' sources' },
      { id: 'discover', label: 'People & needs', done: Math.min(1, p.needs.length / 4), big: p.needs.length, sub: p.personas.length + (p.personas.length === 1 ? ' persona' : ' personas'), detail: p.needs.length + ' needs and ' + p.personas.length + ' personas' },
      { id: 'ideate', label: 'Ideas', done: Math.min(1, p.concepts.length / 3), big: p.concepts.length, sub: 'concepts', detail: p.concepts.length + ' concepts' },
      { id: 'evaluate', label: 'Decision', done: rated ? 1 : p.concepts.length ? 0.4 : 0, big: rated ? '✓' : '–', sub: rated ? 'all rated' : 'rate concepts', detail: rated ? 'Every concept is rated' : 'Rate every concept' },
      { id: 'build', kind: 'build', label: 'Build plan', done: Math.min(1, p.features.length / 5), big: p.features.length, sub: 'features', detail: p.features.length + ' features planned' },
      { id: 'report', label: 'Traced', done: a.summary.total ? Math.min(1, a.summary.traceability / 0.8) : 0, big: a.summary.total ? Math.round(a.summary.traceability * 100) + '%' : '–', sub: 'claims backed', detail: 'Traceability ' + pct(a.summary.traceability) }
    ];
  }

  /** Sidebar rail node: a tiny glass bead filled to how complete the step is. */
  function railNode(done, kind) {
    return '<svg class="node" viewBox="0 0 28 28" aria-hidden="true">' + sphere(14, 14, 11, done ? Math.max(0.25, Math.min(0.92, done * 0.92)) : 0, kind === 'build' ? 'build' : 'think', { shadow: false, dashed: !done }) + '</svg>';
  }

  PL.comp = { icon, INK, TONES, orb, sphere, defs, initials, logo, motif, heroArt, press, avatar, plates, stepProgress, railNode, badge, strengthDots, citeEditor, tabs, empty, stat, stackedBars, scatter, gantt, evidenceGraph, riskMatrix, PALETTE, findingTitle, pct };
})(typeof globalThis !== 'undefined' ? globalThis : this);
