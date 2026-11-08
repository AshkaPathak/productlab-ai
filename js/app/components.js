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

  // Validated categorical order (see figures.js); colour follows position in the legend.
  const PALETTE = ['#6a3d9a', '#1a9ec4', '#e07b39', '#c0497a', '#a8901a', '#16907a', '#8e6fc4'];

  /** Horizontal stacked bars. rows: [{label, segments:[{value,label}], total}] */
  function stackedBars(rows, legend, options) {
    const o = Object.assign({ width: 640, max: null, unit: '' }, options || {});
    const labelW = 190; const barH = 26; const gap = 10; const top = legend ? 30 : 6;
    const max = o.max || Math.max(1e-9, ...rows.map((r) => r.total));
    const w = o.width - labelW - 60;
    const h = top + rows.length * (barH + gap);
    let svg = '<svg class="chart" viewBox="0 0 ' + o.width + ' ' + h + '" role="img" aria-label="Bar chart">';
    const step = legend ? Math.min(110, (o.width - labelW) / legend.length) : 0;
    if (legend) legend.forEach((l, i) => { svg += '<rect x="' + (labelW + i * step) + '" y="4" width="10" height="10" rx="2" fill="' + PALETTE[i % PALETTE.length] + '"/><text x="' + (labelW + i * step + 14) + '" y="13" class="lg">' + esc(l) + '</text>'; });
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
    const col = { Must: '#22112f', Should: '#1a9ec4', Could: '#e07b39' };
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
        const fill = sev >= 15 ? '#b3263e' : sev >= 8 ? '#e8935a' : '#24804f';
        svg += '<rect x="' + (m + (i - 1) * cell) + '" y="' + (10 + (5 - l) * cell) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" fill="' + fill + '" opacity="0.22" rx="4"/>';
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

  /* ---------------- halftone graphics ---------------- */

  const INK = { ink: '#22112f', ink2: '#4e3e5e', cyan: '#19c8f2', cyanSoft: '#dcf6fd', apricot: '#f6c49b', apricotSoft: '#fcebdc', paper: '#f2f0f5' };
  let uid = 0;

  /**
   * A halftone sphere: a dot screen whose dots grow toward the shadow side.
   * density 0..1 scales the dots; tone is the dot colour; base fills the disc.
   */
  function halftone(cx, cy, r, o) {
    const opt = Object.assign({ density: 1, tone: INK.ink, base: 'none', cell: 7, light: [0.32, 0.28] }, o || {});
    const id = 'ht' + (++uid);
    const maxR = opt.cell * 0.52 * Math.max(0.15, Math.min(1, opt.density));
    let dots = '';
    const lx = cx - r + 2 * r * opt.light[0]; const ly = cy - r + 2 * r * opt.light[1];
    for (let y = cy - r; y <= cy + r; y += opt.cell) {
      const row = Math.round((y - (cy - r)) / opt.cell);
      for (let x = cx - r + (row % 2 ? opt.cell / 2 : 0); x <= cx + r; x += opt.cell) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r - 1.5) continue;
        const shade = Math.min(1, Math.hypot(x - lx, y - ly) / (1.55 * r));
        const rr = maxR * (0.18 + 0.82 * shade);
        if (rr < 0.35) continue;
        dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + rr.toFixed(2) + '"/>';
      }
    }
    return '<g class="ht" data-id="' + id + '"><circle class="disc" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + opt.base + '"/><g class="dots" fill="' + opt.tone + '">' + dots + '</g></g>';
  }

  function logo() {
    return '<svg class="logo" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="' + INK.apricot + '"/>' + halftone(17, 17, 15, { cell: 3.6, density: 1, tone: INK.ink }) + '<circle cx="12" cy="12" r="5" fill="' + INK.cyan + '"/></svg>';
  }

  /** Small mark beside page titles: a halftone disc with the accent "you are here" dot. */
  function motif() {
    return '<svg viewBox="0 0 40 40" aria-hidden="true">' + halftone(20, 20, 18, { cell: 4.2, base: INK.apricot }) + '<circle cx="13" cy="13" r="5.5" fill="' + INK.cyan + '"/></svg>';
  }

  /** Large halftone artwork for dark heroes (dots in paper colour). */
  function heroArt() {
    return '<svg class="hero-art" viewBox="0 0 380 300" aria-hidden="true">' +
      '<circle cx="230" cy="160" r="128" fill="' + INK.apricot + '" opacity=".95"/>' + halftone(230, 160, 128, { cell: 9, tone: INK.ink, light: [0.25, 0.2] }) +
      '<circle cx="128" cy="92" r="38" fill="' + INK.cyan + '"/></svg>';
  }

  /**
   * The signature graphic: a row of halftone spheres, one per stage.
   * stages: [{label, state: pending|running|done|warn|failed|skipped, fill (0..1), big, sub, href, current}]
   */
  function press(stages, options) {
    const o = Object.assign({ r: 66, gap: 168, label: 'Pipeline', enter: false }, options || {});
    const r = o.r; const n = stages.length;
    const W = 2 * r + (n - 1) * o.gap + 24; const cy = r + 12; const H = cy + r + 60;
    let svg = '<svg class="press' + (o.enter ? ' enter' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label) + '">';
    // connecting thread
    svg += '<line x1="' + (12 + r) + '" y1="' + cy + '" x2="' + (12 + r + (n - 1) * o.gap) + '" y2="' + cy + '" stroke="' + INK.ink + '" stroke-width="1.5"/>';
    stages.forEach((s, i) => {
      const cx = 12 + r + i * o.gap;
      const st = s.state || 'pending';
      const pending = st === 'pending' || st === 'skipped';
      const accent = st === 'running' || s.current;
      const density = pending ? 0.18 : st === 'running' ? 0.55 : Math.max(0.25, Math.min(1, s.fill == null ? 1 : s.fill));
      const base = accent ? INK.cyan : pending ? INK.paper : INK.apricot;
      const body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 6) + '" fill="' + INK.paper + '"/>' +
        halftone(cx, cy, r, { density, base, tone: INK.ink }) +
        '<circle class="ring' + (pending ? ' pending' : '') + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>' +
        (st === 'failed' ? '<path class="failmark" d="M' + (cx - 16) + ' ' + (cy - 16) + 'l32 32M' + (cx + 16) + ' ' + (cy - 16) + 'l-32 32"/>' : '') +
        (s.big != null && st !== 'failed' && !pending ? '<text class="big" x="' + cx + '" y="' + (cy + 13) + '">' + esc(s.big) + '</text>' : '') +
        '<text class="lbl" x="' + cx + '" y="' + (cy + r + 28) + '">' + esc(s.label) + '</text>' +
        (s.sub ? '<text class="sub" x="' + cx + '" y="' + (cy + r + 47) + '">' + esc(s.sub) + '</text>' : '');
      const cls = 'stage' + (st === 'running' ? ' running' : '') + (s.justDone ? ' just-done' : '');
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

  /** Abstract halftone portrait generated from a name (no photos, no real faces). */
  function avatar(name) {
    const h = hash(String(name || '?'));
    const hx = 28 + (h % 9); const sw = 21 + ((h >>> 4) % 7); const accent = ((h >>> 8) % 3) === 0;
    const extra = ((h >>> 11) % 3) === 0 ? '<rect x="' + (hx - 11) + '" y="23" width="22" height="4.5" rx="2.25" fill="' + INK.ink + '"/>'
      : ((h >>> 11) % 3) === 1 ? '<path d="M' + (hx - 14) + ' 21 Q' + hx + ' 3 ' + (hx + 14) + ' 21 Z" fill="' + INK.ink + '"/>' : '';
    return '<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="' + (accent ? INK.cyanSoft : INK.apricotSoft) + '"/>' +
      '<clipPath id="avc' + h + '"><rect width="64" height="64" rx="18"/></clipPath><g clip-path="url(#avc' + h + ')">' +
      halftone(32, 66, sw + 2, { cell: 3.4, base: accent ? INK.cyan : INK.apricot, light: [0.3, 0.1] }) +
      halftone(hx, 27, 12.5, { cell: 3, base: INK.paper }) + extra + '</g></svg>';
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
      { id: 'discover', label: 'People & needs', done: Math.min(1, p.needs.length / 4), big: p.needs.length, sub: p.personas.length + ' personas', detail: p.needs.length + ' needs and ' + p.personas.length + ' personas' },
      { id: 'ideate', label: 'Ideas', done: Math.min(1, p.concepts.length / 3), big: p.concepts.length, sub: 'concepts', detail: p.concepts.length + ' concepts' },
      { id: 'evaluate', label: 'Decision', done: rated ? 1 : p.concepts.length ? 0.4 : 0, big: rated ? '✓' : '–', sub: rated ? 'all rated' : 'rate concepts', detail: rated ? 'Every concept is rated' : 'Rate every concept' },
      { id: 'build', label: 'Build plan', done: Math.min(1, p.features.length / 5), big: p.features.length, sub: 'features', detail: p.features.length + ' features planned' },
      { id: 'report', label: 'Traced', done: a.summary.total ? Math.min(1, a.summary.traceability / 0.8) : 0, big: a.summary.total ? Math.round(a.summary.traceability * 100) + '%' : '–', sub: 'claims backed', detail: 'Traceability ' + pct(a.summary.traceability) }
    ];
  }

  /** Sidebar rail node showing how complete a step is. */
  function railNode(done) {
    const r = 2.5 + 6 * Math.max(0, Math.min(1, done || 0));
    return '<svg class="node" viewBox="0 0 28 28" aria-hidden="true"><circle class="bg" cx="14" cy="14" r="12"/>' + (done ? '<circle class="fill" cx="14" cy="14" r="' + r.toFixed(1) + '"/>' : '') + '</svg>';
  }

  PL.comp = { INK, halftone, logo, motif, heroArt, press, avatar, plates, stepProgress, railNode, badge, strengthDots, citeEditor, tabs, empty, stat, stackedBars, scatter, gantt, evidenceGraph, riskMatrix, PALETTE, findingTitle, pct };
})(typeof globalThis !== 'undefined' ? globalThis : this);
