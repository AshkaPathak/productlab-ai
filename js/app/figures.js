/* ProductLab AI - figures: one picture per step, each with a one-line takeaway.
 * Plain SVG, no libraries. Every mark carries a <title> so hovering shows the
 * exact value, and every figure has a caption that says what it shows in words.
 */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  const { esc, fix, pct } = PL.ui;
  const C = PL.comp;
  const INK = Object.assign({ white: '#ffffff' }, C.INK);

  /* Categorical order, validated for colour-blind separation (adjacent pairs
     deltaE >= 10 under protan/deutan/tritan) on the light card surface. */
  const CAT = ['#5866ec', '#d8961c', '#1f9e8f', '#e0604e', '#9a5fc0', '#7f8a2e'];
  const STATUS_COL = { supported: '#3a9a6c', partial: '#e0a144', unsupported: '#cf4b63', invalid: '#8e2340', uncited: '#a9a59a' };
  const STATUS_TONE = { supported: 'ok', partial: 'warn', unsupported: 'bad', invalid: 'bad2' };
  // Flat colours are CSS variables so a project theme can re-tint them (legends use them as backgrounds).
  const V = (name) => 'var(--' + name + ')';
  const MOSCOW_COL = { Must: V('deep-2'), Should: V('sea'), Could: V('build'), "Won't": V('line-2') };
  const MOSCOW_TONE = { Must: 'deep', Should: 'sea', Could: 'build', "Won't": 'mist' };
  const HAIR = '#e2dfd5'; const HAIR2 = '#cfcbbf';

  const trunc = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fig(svg, caption, cls) {
    return '<figure class="fig' + (cls ? ' ' + cls : '') + '"><div class="fig-art">' + svg + '</div>' + (caption ? '<figcaption>' + caption + '</figcaption>' : '') + '</figure>';
  }

  function legend(items) {
    return '<div class="fig-legend">' + items.map((it) => '<span><i style="' + (it.ring ? 'background:transparent;border:1.5px solid ' + it.color : 'background:' + it.color) + '"></i>' + esc(it.label) + '</span>').join('') + '</div>';
  }

  /** A glossy orb mark. */
  function disc(cx, cy, r, tone) {
    return C.orb(cx, cy, r, tone);
  }

  /* ------------------------------------------------------------------ */
  /* Evidence: where the evidence comes from                            */
  /* ------------------------------------------------------------------ */

  const STRENGTH_ROWS = [
    { s: 3, label: 'Reviews, guidelines, national data' },
    { s: 2, label: 'Peer-reviewed studies' },
    { s: 1, label: 'News, industry, grey literature' }
  ];

  function sourceMap(p) {
    const refs = p.references;
    if (!refs.length) return '';
    const count = new Map(refs.map((r) => [r.id, 0]));
    p.findings.forEach((f) => count.set(f.ref, (count.get(f.ref) || 0) + 1));
    const years = refs.map((r) => Number(r.year)).filter(Number.isFinite);
    const y0 = years.length ? Math.min(...years) : 2020; const y1 = years.length ? Math.max(...years) : 2026;
    const span = Math.max(1, y1 - y0);
    const W = 820; const left = 250; const right = 50; const rowH = 86; const top = 26;
    const H = top + rowH * 3 + 34;
    const sx = (y) => left + 28 + ((y - y0) / span) * (W - left - right - 28);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sources by year and strength">';
    STRENGTH_ROWS.forEach((row, i) => {
      const cy = top + i * rowH + rowH / 2;
      svg += '<line x1="' + left + '" y1="' + cy + '" x2="' + (W - right + 30) + '" y2="' + cy + '" class="grid"/>';
      svg += '<text x="' + (left - 16) + '" y="' + (cy + 4) + '" text-anchor="end" class="lb">' + esc(row.label) + '</text>';
    });
    // year ticks
    const step = span > 12 ? 5 : span > 6 ? 2 : 1;
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) svg += '<text x="' + sx(y) + '" y="' + (H - 8) + '" text-anchor="middle" class="ax small">' + y + '</text>';
    // discs, dodged so two sources in the same year and row do not overlap
    const placed = [];
    refs.slice().sort((a, b) => (count.get(b.id) || 0) - (count.get(a.id) || 0)).forEach((r) => {
      const n = count.get(r.id) || 0;
      const s = clamp(Number(r.strength) || 1, 1, 3);
      const rad = n ? 7 + 6 * Math.sqrt(n) : 6;
      const rowY = top + (3 - s) * rowH + rowH / 2;
      let cx = Number.isFinite(Number(r.year)) ? sx(Number(r.year)) : W - right + 24;
      let cy = rowY;
      for (let k = 0; k < 14; k++) {
        const hit = placed.find((q) => Math.hypot(q.x - cx, q.y - cy) < q.r + rad + 2);
        if (!hit) break;
        const dir = k % 2 ? -1 : 1;
        cy = rowY + dir * Math.ceil((k + 1) / 2) * 12;
        if (Math.abs(cy - rowY) > rowH / 2 - rad) { cy = rowY; cx += rad * 1.2; }
      }
      cx = Math.min(cx, W - rad - 3);
      placed.push({ x: cx, y: cy, r: rad });
      const tip = r.id + ': ' + (r.title || '') + (r.year ? ' (' + r.year + ')' : '') + '\n' + n + ' finding' + (n === 1 ? '' : 's') + ', strength ' + s + '/3';
      svg += '<g class="mark"><title>' + esc(tip) + '</title>' + (n ? disc(cx, cy, rad, s === 3 ? 'deep' : s === 2 ? 'soft' : 'mist')
        : '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="#fff" fill-opacity=".6" stroke="' + HAIR2 + '" stroke-dasharray="2 3"/>') +
        (rad >= 16 ? '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="val ' + (s === 3 ? 'on-dark' : 'halo') + '">' + n + '</text>' : '') + '</g>';
    });
    svg += '</svg>';
    const strong = p.findings.filter((f) => { const r = refs.find((x) => x.id === f.ref); return r && Number(r.strength) === 3; }).length;
    const unused = refs.filter((r) => !count.get(r.id)).length;
    const cap = '<b>' + p.findings.length + ' findings from ' + refs.length + ' sources</b>, ' + (years.length ? y0 + ' to ' + y1 : 'undated') + '. ' +
      pct(p.findings.length ? strong / p.findings.length : 0) + ' come from reviews, guidelines or national data. Bigger discs hold more findings' + (unused ? '; ' + unused + ' dashed source' + (unused > 1 ? 's have' : ' has') + ' none yet.' : '.');
    return fig(svg, cap);
  }

  /** One dot per finding, grouped by kind; filled when a claim cites it. */
  function evidenceUse(p) {
    if (!p.findings.length) return '';
    const used = new Map();
    PL.evidence.claimsOf(p).forEach((c) => (c.evidence || []).forEach((id) => used.set(id, (used.get(id) || 0) + 1)));
    const kinds = [...new Set(p.findings.map((f) => f.kind || 'other'))];
    const W = 820; const left = 120; const cell = 22; const rowH = 30; const perRow = Math.floor((W - left - 10) / cell);
    let y = 8; let svg = '';
    kinds.forEach((k) => {
      const items = p.findings.filter((f) => (f.kind || 'other') === k);
      const lines = Math.ceil(items.length / perRow);
      svg += '<text x="' + (left - 14) + '" y="' + (y + 15) + '" text-anchor="end" class="lb">' + esc(k) + '</text>';
      items.forEach((f, i) => {
        const cx = left + (i % perRow) * cell + 9; const cy = y + Math.floor(i / perRow) * cell + 11;
        const n = used.get(f.id) || 0;
        svg += '<g class="mark"><title>' + esc(f.id + ': ' + trunc(f.text, 140) + '\n' + (n ? 'Cited by ' + n + ' claim' + (n > 1 ? 's' : '') : 'Not cited yet')) + '</title>' +
          (n ? disc(cx, cy, 8.5, n >= 3 ? 'think' : 'deep') : '<circle cx="' + cx + '" cy="' + cy + '" r="7.5" fill="#fff" stroke="' + HAIR2 + '" stroke-width="1.5"/>') + '</g>';
      });
      y += Math.max(rowH, lines * cell + 8);
    });
    const H = y + 4;
    const usedN = p.findings.filter((f) => used.has(f.id)).length;
    return fig('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evidence in use">' + svg + '</svg>',
      '<b>' + usedN + ' of ' + p.findings.length + ' findings</b> are cited by at least one claim. Each dot is one finding; hover for its text.' +
      legend([{ color: V('think'), label: 'Cited 3+ times' }, { color: V('deep-2'), label: 'Cited' }, { color: HAIR2, label: 'Not cited yet', ring: true }]));
  }

  /* ------------------------------------------------------------------ */
  /* People & needs                                                     */
  /* ------------------------------------------------------------------ */

  function needsMap(p, index, opts) {
    const o = Object.assign({ compact: false }, opts || {});
    if (!p.needs.length) return '';
    const W = 820; const m = { l: 56, r: 24, t: 20, b: 46 }; const H = o.compact ? 300 : 360;
    const pw = W - m.l - m.r; const ph = H - m.t - m.b;
    const sx = (v) => m.l + v * pw; const sy = (s) => m.t + (5 - s) / 4 * ph;
    const pts = p.needs.map((n) => {
      const ev = PL.evidence.evidenceScore(index, [{ text: n.statement, evidence: n.evidence || [] }]);
      return { n, x: clamp(ev, 0, 1), y: clamp(Number(n.severity) || 3, 1, 5), k: (n.evidence || []).length };
    });
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Needs by severity and evidence">';
    svg += '<rect x="' + sx(0.5) + '" y="' + m.t + '" width="' + (pw / 2) + '" height="' + (sy(3.5) - m.t) + '" style="fill:var(--think-soft)" rx="10"/>';
    svg += '<text x="' + (sx(1) - 10) + '" y="' + (m.t + 18) + '" text-anchor="end" class="ax">Severe and well evidenced</text>';
    svg += '<text x="' + (sx(0) + 10) + '" y="' + (m.t + 18) + '" class="ax">Severe, needs more evidence</text>';
    [1, 2, 3, 4, 5].forEach((s) => { svg += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + sy(s) + '" y2="' + sy(s) + '" class="grid"/><text x="' + (m.l - 12) + '" y="' + (sy(s) + 4) + '" text-anchor="end" class="ax small">' + s + '</text>'; });
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => { svg += '<text x="' + sx(v) + '" y="' + (H - m.b + 18) + '" text-anchor="middle" class="ax small">' + Math.round(v * 100) + '%</text>'; });
    svg += '<text x="' + (m.l + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="ax">Evidence behind the need</text>';
    svg += '<text transform="translate(16 ' + (m.t + ph / 2) + ') rotate(-90)" text-anchor="middle" class="ax">Severity</text>';
    const placed = [];
    pts.sort((a, b) => b.k - a.k).forEach((pt) => {
      const r = 9 + 4 * Math.sqrt(pt.k);
      const x0 = sx(pt.x); const cy = sy(pt.y); let cx = x0;
      for (let i = 1; i < 16 && placed.some((q) => Math.abs(q.y - cy) < 2 && Math.abs(q.x - cx) < q.r + r + 3); i++) {
        cx = clamp(x0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (2 * r + 4), m.l + r, W - m.r - r);
      }
      placed.push({ x: cx, y: cy, r });
      const hot = pt.x >= 0.5 && pt.y >= 4;
      svg += '<g class="mark"><title>' + esc(pt.n.id + ' (severity ' + pt.y + ', evidence ' + pct(pt.x) + ', ' + pt.k + ' findings)\n' + pt.n.statement) + '</title>' +
        disc(cx, cy, r, hot ? 'think' : 'soft') +
        '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="val halo">' + esc(pt.n.id) + '</text></g>';
    });
    svg += '</svg>';
    const hot = pts.filter((pt) => pt.x >= 0.5 && pt.y >= 4);
    const thin = pts.filter((pt) => pt.x < 0.5 && pt.y >= 4);
    const cap = (hot.length ? '<b>' + hot.map((x) => esc(x.n.id)).join(', ') + '</b> ' + (hot.length > 1 ? 'are' : 'is') + ' severe and well evidenced: the strongest place to start.' : 'No need is both severe (4+) and well evidenced yet.') +
      (thin.length ? ' ' + thin.map((x) => esc(x.n.id)).join(', ') + ' ' + (thin.length > 1 ? 'are' : 'is') + ' severe but thinly evidenced.' : '') + ' Bigger circles cite more findings.';
    return fig(svg, cap);
  }

  /** Circle packing of evidence themes. Cyan = no need covers it yet. */
  /** Turn a stemmed term ("diagnos") back into the commonest real word in the texts ("diagnosis"). */
  function unstem(stem, texts) {
    const tally = new Map(); const re = new RegExp('\\b(' + String(stem).replace(/[^a-z0-9]/gi, '') + '[a-z]*)', 'gi');
    texts.forEach((t) => { let mm; while ((mm = re.exec(t))) { const w = mm[1].toLowerCase(); tally.set(w, (tally.get(w) || 0) + 1); } });
    let best = stem; let n = 0; tally.forEach((v, k) => { if (v > n || (v === n && k.length < best.length)) { best = k; n = v; } });
    return best;
  }

  function themeBubbles(themes, findings) {
    const texts = new Map((findings || []).map((f) => [f.id, f.text]));
    const multi = themes.filter((t) => t.members.length > 1);
    if (!multi.length) return '';
    const items = multi.map((t) => ({ t, r: 30 + 17 * Math.sqrt(t.members.length) })).sort((a, b) => b.r - a.r);
    const placed = [];
    items.forEach((it, i) => {
      if (!i) { it.x = 0; it.y = 0; placed.push(it); return; }
      for (let d = 0; d < 2000; d += 3) {
        let ok = false;
        for (let a = 0; a < 360; a += 12) {
          const x = Math.cos((a + i * 37) * Math.PI / 180) * d * 1.5; const y = Math.sin((a + i * 37) * Math.PI / 180) * d;
          if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + it.r + 4)) { it.x = x; it.y = y; ok = true; break; }
        }
        if (ok) break;
      }
      placed.push(it);
    });
    const minX = Math.min(...placed.map((q) => q.x - q.r)) - 6; const maxX = Math.max(...placed.map((q) => q.x + q.r)) + 6;
    const minY = Math.min(...placed.map((q) => q.y - q.r)) - 6; const maxY = Math.max(...placed.map((q) => q.y + q.r)) + 6;
    let svg = '<svg class="chart" viewBox="' + minX.toFixed(0) + ' ' + minY.toFixed(0) + ' ' + (maxX - minX).toFixed(0) + ' ' + (maxY - minY).toFixed(0) + '" role="img" aria-label="Evidence themes" style="max-width:' + Math.min(820, Math.round(maxX - minX)) + 'px">';
    placed.forEach((it) => {
      const open = !it.t.need;
      const words = (it.t.terms || String(it.t.label).split(' · ')).map((w) => unstem(w, it.t.members.map((id) => (texts.get(id) || ''))));
      svg += '<g class="mark"><title>' + esc(words.join(', ') + '\n' + it.t.members.length + ' findings: ' + it.t.members.join(', ') + '\n' + (open ? 'No need covers this theme yet' : 'Matches need ' + it.t.need.id)) + '</title>' +
        C.orb(it.x, it.y, it.r, open ? 'think' : 'build', { shadow: true }) +
        '<text x="' + it.x + '" y="' + (it.y - (it.r > 40 ? 6 : 0) + 4) + '" text-anchor="middle" class="val halo">' + esc(trunc(words[0], it.r > 40 ? 16 : 10)) + '</text>' +
        (it.r > 40 && words[1] ? '<text x="' + it.x + '" y="' + (it.y + 16) + '" text-anchor="middle" class="lb halo">' + esc(trunc(words[1], 16)) + '</text>' : '') + '</g>';
    });
    svg += '</svg>';
    const open = multi.filter((t) => !t.need).length;
    return fig(svg, '<b>' + multi.length + ' themes</b> in the evidence' + (open ? ', <b>' + open + '</b> with no need covering ' + (open > 1 ? 'them' : 'it') + ' yet. Those are open opportunities.' : ', each already covered by a need.') + ' Size shows how many findings agree.' +
      legend([{ color: V('think'), label: 'Open opportunity' }, { color: V('build'), label: 'Covered by a need' }]), 'center');
  }

  /* ------------------------------------------------------------------ */
  /* Ideas                                                              */
  /* ------------------------------------------------------------------ */

  /** Concepts x needs: which idea answers which need. */
  function coverage(p) {
    if (!p.concepts.length || !p.needs.length) return '';
    const left = 200; const cell = 46; const top = 40; const rowH = 40;
    const W = left + p.needs.length * cell + 90; const H = top + p.concepts.length * rowH + 8;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Which concept answers which need" style="max-width:' + W + 'px">';
    p.needs.forEach((n, j) => {
      const x = left + j * cell + cell / 2;
      svg += '<g class="mark"><title>' + esc(n.id + ' (severity ' + n.severity + '): ' + n.statement) + '</title><text x="' + x + '" y="' + (top - 22) + '" text-anchor="middle" class="ax">' + esc(n.id) + '</text>' +
        '<text x="' + x + '" y="' + (top - 8) + '" text-anchor="middle" class="ax small">sev ' + esc(n.severity) + '</text></g>';
    });
    svg += '<text x="' + (W - 10) + '" y="' + (top - 15) + '" text-anchor="end" class="ax">Covered</text>';
    p.concepts.forEach((c, i) => {
      const y = top + i * rowH + rowH / 2; const sel = p.selectedConcept === c.id;
      if (sel) svg += '<rect x="0" y="' + (y - rowH / 2 + 3) + '" width="' + W + '" height="' + (rowH - 6) + '" rx="16" fill="#fff" fill-opacity=".75" stroke="' + HAIR + '"/>';
      svg += '<text x="' + (left - 14) + '" y="' + (y + 4) + '" text-anchor="end" class="lb' + (sel ? ' strong' : '') + '">' + esc(trunc(c.name, 26)) + '</text>';
      let k = 0;
      p.needs.forEach((n, j) => {
        const x = left + j * cell + cell / 2; const on = (c.needs || []).includes(n.id);
        if (on) k++;
        const r = on ? 5 + 2.2 * (Number(n.severity) || 3) : 3;
        svg += '<g><title>' + esc(c.name + (on ? ' addresses ' : ' does not address ') + n.id) + '</title>' + (on ? disc(x, y, r, sel ? 'think' : 'deep') : '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + HAIR + '"/>') + '</g>';
      });
      svg += '<text x="' + (W - 10) + '" y="' + (y + 4) + '" text-anchor="end" class="val">' + k + '/' + p.needs.length + '</text>';
    });
    svg += '</svg>';
    const orphan = p.needs.filter((n) => !p.concepts.some((c) => (c.needs || []).includes(n.id)));
    return fig(svg, orphan.length ? '<b>' + orphan.map((n) => esc(n.id)).join(', ') + '</b> ' + (orphan.length > 1 ? 'are' : 'is') + ' not addressed by any concept yet. Bigger dots are more severe needs.'
      : '<b>Every need is addressed</b> by at least one concept. Bigger dots are more severe needs.');
  }

  /** Glass mark for a concept: two overlapping orbs in tones seeded from its name, inside an evidence ring. */
  function conceptMark(name, score) {
    let h = 2166136261; const s = String(name || '?');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h >>>= 0;
    const pairs = [['build', 'think'], ['deep', 'build'], ['sea', 'soft'], ['spark', 'build'], ['teal', 'soft'], ['soft', 'think']];
    const pr = pairs[h % pairs.length]; const flip = (h >>> 7) & 1;
    const R = 28; const circ = 2 * Math.PI * R; const sc = clamp(Number(score) || 0, 0, 1);
    return '<svg class="cmark" viewBox="0 0 64 64" role="img" aria-label="Evidence ' + pct(sc) + '"><title>Evidence score ' + pct(sc) + '</title>' +
      '<circle cx="32" cy="32" r="' + R + '" fill="none" stroke="' + HAIR + '" stroke-width="3"/>' +
      '<circle cx="32" cy="32" r="' + R + '" fill="none" style="stroke:var(--think-ink)" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (circ * sc).toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
      C.orb(flip ? 28 : 36, 34, 17, pr[0]) + C.orb(flip ? 39 : 24, 24, 9.5, pr[1]) + '</svg>';
  }

  /** The morphological box drawn as columns, with the chosen path threaded through. */
  function morphPath(params, sel, optLabel) {
    if (!params.length) return '';
    const colW = Math.min(180, Math.floor(800 / params.length)); const boxH = 30; const gap = 8; const top = 30;
    const maxOpts = Math.max(...params.map((pm) => pm.options.length));
    const W = params.length * colW + 10; const H = top + maxOpts * (boxH + gap) + 6;
    const centres = [];
    let boxes = '';
    params.forEach((pm, i) => {
      const x = 5 + i * colW;
      boxes += '<text x="' + (x + colW / 2 - 6) + '" y="16" text-anchor="middle" class="ax">' + esc(trunc(pm.name, Math.floor(colW / 7.5))) + '</text>';
      pm.options.forEach((o, j) => {
        const lab = optLabel(o); const on = sel[pm.id] === lab; const y = top + j * (boxH + gap);
        if (on) centres.push([x + (colW - 12) / 2, y + boxH / 2]);
        boxes += '<g class="mark"><title>' + esc(lab + (o.hint ? ': ' + o.hint : '')) + '</title>' +
          '<rect x="' + x + '" y="' + y + '" width="' + (colW - 12) + '" height="' + boxH + '" rx="' + (boxH / 2) + '" fill="' + (on ? INK.ink : '#fff') + '" fill-opacity="' + (on ? 1 : 0.7) + '" stroke="' + (on ? INK.ink : HAIR2) + '" stroke-width="1.5"/>' +
          '<text x="' + (x + (colW - 12) / 2) + '" y="' + (y + boxH / 2 + 4.5) + '" text-anchor="middle" class="lb" fill="' + (on ? INK.white : INK.ink) + '" style="fill:' + (on ? INK.white : INK.ink) + '">' + esc(trunc(lab, Math.floor((colW - 20) / 7))) + '</text></g>';
      });
    });
    let path = '';
    if (centres.length > 1) path = '<path d="M' + centres.map((c) => c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' L') + '" fill="none" style="stroke:var(--think)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>';
    const n = Object.keys(sel).length;
    return fig('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Morphological box" style="max-width:' + W + 'px">' + path + boxes + '</svg>',
      n ? '<b>' + n + ' of ' + params.length + '</b> parameters chosen. The cyan line is your combination through the box of ' + params.reduce((n, pm) => n * pm.options.length, 1) + ' possibilities.' : 'Pick one option per parameter below. The cyan line will trace your combination through the box.');
  }

  /* ------------------------------------------------------------------ */
  /* Decision                                                           */
  /* ------------------------------------------------------------------ */

  /** Radar of the top concepts across criteria (scale 1-5). Colour follows the concept, not its rank. */
  function radar(p, ranked, opts) {
    const o = Object.assign({ top: 3 }, opts || {});
    const crit = p.criteria; if (crit.length < 3 || !ranked.length) return '';
    const show = ranked.slice(0, o.top);
    const W = 460; const H = 400; const cx = W / 2; const cy = 200; const R = 140;
    const ang = (i) => -Math.PI / 2 + (i / crit.length) * 2 * Math.PI;
    const pt = (i, v) => { const k = Math.max(0, (v - 1) / 4); return [cx + Math.cos(ang(i)) * R * k, cy + Math.sin(ang(i)) * R * k]; };
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Concept profiles" style="max-width:' + W + 'px">';
    [2, 3, 4, 5].forEach((v) => { svg += '<polygon points="' + crit.map((_, i) => pt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ') + '" fill="none" stroke="' + (v === 5 ? HAIR2 : HAIR) + '"/>'; });
    [2, 3, 4, 5].forEach((v) => { const [x, y] = pt(0, v); svg += '<text x="' + (x + 5).toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" class="ax small">' + v + '</text>'; });
    crit.forEach((k, i) => {
      const [x, y] = pt(i, 5); const [lx, ly] = pt(i, 5.8);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + HAIR + '"/>';
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + (Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end') + '" class="ax">' + esc(trunc(k.name, 16)) + '</text>';
    });
    const colorOf = (id) => CAT[Math.max(0, p.concepts.findIndex((c) => c.id === id)) % CAT.length];
    show.slice().reverse().forEach((r) => {
      const col = colorOf(r.id);
      const vals = crit.map((k) => { const cell = (p.ratings[r.id] || {})[k.id]; const v = cell && typeof cell === 'object' ? cell.value : cell; return Number(v) || 0; });
      svg += '<g class="mark"><title>' + esc(r.name + ': ' + crit.map((k, i) => k.name + ' ' + vals[i]).join(', ')) + '</title><polygon points="' + vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ') + '" fill="' + col + '" fill-opacity=".12" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round"/>' +
        vals.map((v, i) => { const [x, y] = pt(i, v); return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + col + '" stroke="#fff" stroke-width="2"/>'; }).join('') + '</g>';
    });
    svg += '</svg>';
    let cap = '';
    if (show.length >= 2) {
      const val = (id, k) => { const cell = (p.ratings[id] || {})[k.id]; return Number(cell && typeof cell === 'object' ? cell.value : cell) || 0; };
      const a = show[0]; const b = show[1];
      const aWins = crit.filter((k) => val(a.id, k) > val(b.id, k)).map((k) => k.name.toLowerCase());
      const bWins = crit.filter((k) => val(b.id, k) > val(a.id, k)).map((k) => k.name.toLowerCase());
      cap = 'Ratings from 1 at the centre to 5 at the rim. <b>' + esc(a.name) + '</b> ' + (aWins.length ? 'leads on ' + esc(aWins.join(', ')) : 'ties on every criterion') + (bWins.length ? '; <b>' + esc(b.name) + '</b> is stronger on ' + esc(bWins.join(', ')) + '.' : '.');
    }
    return fig(svg, cap + legend(show.map((r) => ({ color: colorOf(r.id), label: r.name }))), 'center');
  }

  /** How far each weight must move before the winner changes. Short bars = fragile. */
  function tornado(sens, criteria) {
    if (!sens.length) return '';
    const W = 760; const left = 170; const right = 150; const rowH = 34; const top = 26;
    const H = top + sens.length * rowH + 30; const mid = left + (W - left - right) / 2; const half = (W - left - right) / 2;
    const cap = 50; const sx = (pts) => mid + clamp(pts, -cap, cap) / cap * half;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weight shift needed to change the winner">';
    [-50, -25, 0, 25, 50].forEach((v) => { svg += '<line x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + (top - 8) + '" y2="' + (H - 26) + '" class="grid"/><text x="' + sx(v) + '" y="' + (H - 10) + '" text-anchor="middle" class="ax small">' + (v > 0 ? '+' : '') + v + '</text>'; });
    svg += '<text x="' + mid + '" y="12" text-anchor="middle" class="ax">Weight change (points) before the winner changes</text>';
    sens.forEach((s, i) => {
      const y = top + i * rowH;
      svg += '<text x="' + (left - 12) + '" y="' + (y + 19) + '" text-anchor="end" class="lb">' + esc(s.name) + '</text>';
      if (!s.flip) {
        svg += '<rect x="' + (left) + '" y="' + (y + 8) + '" width="' + (W - left - right) + '" height="16" rx="8" fill="' + HAIR + '"><title>' + esc(s.name + ': no weight change alters the winner') + '</title></rect>' +
          '<text x="' + (W - right + 10) + '" y="' + (y + 20) + '" class="lg">never changes</text>';
        return;
      }
      const d = Math.round(s.flip.delta * 100); const fragile = Math.abs(d) < 15;
      const x0 = Math.min(mid, sx(d)); const w = Math.max(3, Math.abs(sx(d) - mid));
      svg += '<rect x="' + x0 + '" y="' + (y + 6) + '" width="' + w + '" height="20" rx="10" style="fill:var(--' + (fragile ? 'spark' : 'deep-2') + ')"><title>' + esc(s.name + ': ' + (d > 0 ? '+' : '') + d + ' points makes ' + s.flip.newWinnerName + ' the winner') + '</title></rect>' +
        '<text x="' + (W - right + 10) + '" y="' + (y + 20) + '" class="lg">' + esc(trunc(s.flip.newWinnerName, 18)) + '</text>';
    });
    svg += '<line x1="' + mid + '" x2="' + mid + '" y1="' + (top - 8) + '" y2="' + (H - 26) + '" stroke="' + INK.ink2 + '" stroke-width="1.2"/></svg>';
    const flips = sens.filter((s) => s.flip).sort((a, b) => Math.abs(a.flip.delta) - Math.abs(b.flip.delta));
    const c = flips.length ? 'Most sensitive to <b>' + esc(flips[0].name.toLowerCase()) + '</b>: a ' + Math.abs(Math.round(flips[0].flip.delta * 100)) + '-point ' + (flips[0].flip.delta > 0 ? 'increase' : 'decrease') + ' would make ' + esc(flips[0].flip.newWinnerName) + ' the winner.' + (Math.abs(flips[0].flip.delta) >= 0.15 ? ' Every shift is 15 points or more, so the choice is robust.' : ' Short pink bars mark fragile criteria.')
      : '<b>No single weight change</b> alters the winner. The choice is robust.';
    return fig(svg, c);
  }

  /* ------------------------------------------------------------------ */
  /* Build                                                              */
  /* ------------------------------------------------------------------ */

  function riceBubbles(rows) {
    if (!rows.length) return '';
    const W = 820; const H = 380; const m = { l: 60, r: 30, t: 24, b: 48 };
    const maxE = Math.max(1, ...rows.map((r) => Number(r.feature.effort) || 0)) * 1.1;
    const maxR = Math.max(1, ...rows.map((r) => r.adjusted)) * 1.12;
    const sx = (v) => m.l + v / maxE * (W - m.l - m.r); const sy = (v) => H - m.b - v / maxR * (H - m.t - m.b);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Value against effort">';
    svg += '<rect x="' + m.l + '" y="' + m.t + '" width="' + ((W - m.l - m.r) / 2) + '" height="' + ((H - m.t - m.b) / 2) + '" style="fill:var(--think-soft)" fill-opacity=".8" rx="16"/>';
    svg += '<text x="' + (m.l + 12) + '" y="' + (m.t + 20) + '" class="ax">Quick wins</text>';
    svg += '<line x1="' + m.l + '" y1="' + (H - m.b) + '" x2="' + (W - m.r) + '" y2="' + (H - m.b) + '" stroke="' + HAIR2 + '"/><line x1="' + m.l + '" y1="' + m.t + '" x2="' + m.l + '" y2="' + (H - m.b) + '" stroke="' + HAIR2 + '"/>';
    svg += '<text x="' + ((W + m.l) / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="ax">Effort (person-weeks)</text>';
    svg += '<text transform="translate(18 ' + ((H - m.b + m.t) / 2) + ') rotate(-90)" text-anchor="middle" class="ax">Evidence-adjusted RICE</text>';
    for (let i = 0; i <= 4; i++) { const e = maxE / 4 * i; svg += '<text x="' + sx(e) + '" y="' + (H - m.b + 16) + '" text-anchor="middle" class="ax small">' + fix(e, 1) + '</text>'; }
    const labelled = new Set(rows.slice(0, 6).map((r) => r.feature.id));
    const used = [];
    rows.slice().sort((a, b) => (Number(b.feature.reach) || 0) - (Number(a.feature.reach) || 0)).forEach((r) => {
      const f = r.feature; const x = sx(Number(f.effort) || 0); const y = sy(r.adjusted); const rad = 6 + 10 * Math.sqrt((Number(f.reach) || 0) / 100);
      const col = MOSCOW_COL[f.moscow] || MOSCOW_COL.Could;
      svg += '<g class="mark"><title>' + esc('#' + r.rank + ' ' + f.name + '\nRICE ' + fix(r.adjusted, 1) + ', effort ' + f.effort + ' person-weeks, reach ' + f.reach + '%, ' + f.moscow) + '</title>' + disc(+x.toFixed(1), +y.toFixed(1), +rad.toFixed(1), MOSCOW_TONE[f.moscow] || 'build') + '</g>';
      if (labelled.has(f.id)) {
        let ly = y + 4; const lx = x + rad + 6;
        while (used.some((u) => Math.abs(u.y - ly) < 14 && Math.abs(u.x - lx) < 150)) ly += 14;
        used.push({ x: lx, y: ly });
        svg += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" class="lb halo">' + esc(trunc(f.name, 24)) + '</text>';
      }
    });
    svg += '</svg>';
    const midE = maxE / 2 / 1.1 * 1.1; const midR = maxR / 2;
    const quick = rows.filter((r) => (Number(r.feature.effort) || 0) < midE && r.adjusted >= midR).map((r) => r.feature.name);
    return fig(svg, (quick.length ? 'Quick wins: <b>' + esc(quick.slice(0, 3).join(', ')) + '</b>, high value for little effort.' : 'No feature is both high value and low effort yet.') + ' Bigger bubbles reach more users.' +
      legend(['Must', 'Should', 'Could', "Won't"].map((k) => ({ color: MOSCOW_COL[k], label: k }))));
  }

  /** The recommended stack drawn as stacked slabs, top layer first. */
  function stackDiagram(rec) {
    if (!rec.length) return '';
    const W = 820; const slabH = 34; const depth = 14; const gap = 10; const skew = 26; const x0 = 24; const sw = W - 2 * x0 - skew;
    const H = rec.length * (slabH + depth + gap) + depth + 6;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Recommended technology stack">';
    const tints = [['think', 'var(--tn-think-0)', 'var(--tn-think-1)'], ['soft', 'var(--tn-soft-0)', 'var(--tn-soft-1)'], ['build', 'var(--tn-build-0)', 'var(--tn-build-1)']];
    rec.forEach((r, i) => {
      const y = depth + i * (slabH + depth + gap);
      const t = i === 0 ? tints[0] : tints[1 + (i % 2)];
      const top = 'M' + (x0 + skew) + ' ' + (y - depth) + ' L' + (x0 + skew + sw) + ' ' + (y - depth) + ' L' + (x0 + sw) + ' ' + y + ' L' + x0 + ' ' + y + ' Z';
      const short = String(r.choice).split(/\s[(:]|;\s/)[0];
      svg += '<g class="mark slab" style="--i:' + i + '"><title>' + esc(r.layer + ': ' + r.choice) + '</title>' +
        '<path d="' + top + '" style="fill:' + t[1] + '" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<rect x="' + x0 + '" y="' + y + '" width="' + sw + '" height="' + slabH + '" fill="#fff" fill-opacity=".86" stroke="' + HAIR + '"/>' +
        '<rect x="' + x0 + '" y="' + y + '" width="6" height="' + slabH + '" style="fill:' + t[2] + '"/>' +
        '<path d="M' + (x0 + sw) + ' ' + y + ' L' + (x0 + sw + skew) + ' ' + (y - depth) + ' L' + (x0 + sw + skew) + ' ' + (y - depth + slabH) + ' L' + (x0 + sw) + ' ' + (y + slabH) + ' Z" style="fill:' + t[2] + '" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<text x="' + (x0 + 20) + '" y="' + (y + 22) + '" class="val">' + esc(r.layer) + '</text>' +
        '<text x="' + (x0 + 200) + '" y="' + (y + 22) + '" class="lb">' + esc(trunc(short, 70)) + '</text></g>';
    });
    svg += '</svg>';
    return fig(svg, '<b>' + rec.length + ' layers</b>, from the languages your team writes down to delivery. Each choice follows from the constraints on the left; hover a layer for the full pick.');
  }

  /* ------------------------------------------------------------------ */
  /* Audit                                                              */
  /* ------------------------------------------------------------------ */

  function claimWaffle(audit) {
    const items = audit.items; if (!items.length) return '';
    const order = ['supported', 'partial', 'unsupported', 'invalid', 'uncited'];
    const sorted = items.slice().sort((a, b) => order.indexOf(a.result.status) - order.indexOf(b.result.status));
    const cols = 30; const cell = 24; const rows = Math.ceil(sorted.length / cols);
    const W = cols * cell + 4; const H = rows * cell + 4;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Every claim by status" style="max-width:' + W + 'px">';
    sorted.forEach((it, i) => {
      const x = 2 + (i % cols) * cell + cell / 2; const y = 2 + Math.floor(i / cols) * cell + cell / 2; const st = it.result.status;
      svg += '<g class="mark"><title>' + esc(PL.evidence.STATUS[st].label + '\n' + it.group + ': ' + trunc(it.text, 140)) + '</title>' +
        (st === 'uncited' ? '<circle cx="' + x + '" cy="' + y + '" r="8" fill="#fff" stroke="' + STATUS_COL[st] + '" stroke-width="1.6"/>' : disc(x, y, 9.5, STATUS_TONE[st])) +
        (st === 'unsupported' || st === 'invalid' ? '<path d="M' + (x - 3.5) + ' ' + (y - 3.5) + 'l7 7M' + (x + 3.5) + ' ' + (y - 3.5) + 'l-7 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' : '') + '</g>';
    });
    svg += '</svg>';
    const s = audit.summary;
    return fig(svg, '<b>' + pct(s.traceability) + ' of ' + s.total + ' claims</b> are backed by the evidence they cite. Each dot is one claim; hover to read it.' +
      legend(order.filter((k) => s[k]).map((k) => ({ color: STATUS_COL[k], label: PL.evidence.STATUS[k].label + ' (' + s[k] + ')', ring: k === 'uncited' }))));
  }

  function sectionBars(byGroup) {
    const keys = Object.keys(byGroup); if (!keys.length) return '';
    const W = 520; const left = 120; const rowH = 30; const H = keys.length * rowH + 6; const bw = W - left - 60;
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Traced claims by section" style="max-width:' + W + 'px">';
    keys.forEach((g, i) => {
      const v = byGroup[g].total ? byGroup[g].traced / byGroup[g].total : 0; const y = i * rowH + 4;
      svg += '<text x="' + (left - 10) + '" y="' + (y + 15) + '" text-anchor="end" class="lb">' + esc(g) + '</text>' +
        '<rect x="' + left + '" y="' + (y + 4) + '" width="' + bw + '" height="14" rx="7" fill="' + HAIR + '"/>' +
        '<rect x="' + left + '" y="' + (y + 4) + '" width="' + Math.max(3, bw * v) + '" height="14" rx="7" style="fill:var(--' + (v >= 0.8 ? 'deep-2' : 'spark') + ')"><title>' + esc(g + ': ' + byGroup[g].traced + ' of ' + byGroup[g].total + ' claims traced') + '</title></rect>' +
        '<text x="' + (left + bw + 8) + '" y="' + (y + 15) + '" class="val">' + pct(v) + '</text>';
    });
    return svg + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Study                                                              */
  /* ------------------------------------------------------------------ */

  function dumbbell(metrics, d) {
    const rows = metrics.filter((m) => d.A[m.id] && d.B[m.id] && d.A[m.id].n && d.B[m.id].n);
    if (!rows.length) return '';
    const W = 760; const left = 170; const right = 40; const rowH = 38; const top = 28; const H = top + rows.length * rowH + 26;
    const sx = (v) => left + (v - 1) / 4 * (W - left - right);
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Baseline against ProductLab">';
    [1, 2, 3, 4, 5].forEach((v) => { svg += '<line x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + (top - 10) + '" y2="' + (H - 24) + '" class="grid"/><text x="' + sx(v) + '" y="' + (H - 8) + '" text-anchor="middle" class="ax small">' + v + '</text>'; });
    rows.forEach((m, i) => {
      const y = top + i * rowH + 10; const a = d.A[m.id].mean; const b = d.B[m.id].mean;
      svg += '<text x="' + (left - 12) + '" y="' + (y + 4) + '" text-anchor="end" class="lb">' + esc(m.name) + '</text>' +
        '<line x1="' + sx(a) + '" x2="' + sx(b) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--' + (b >= a ? 'deep-2' : 'spark') + ')" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="' + sx(a) + '" cy="' + y + '" r="8" fill="#fff" stroke="#6f7391" stroke-width="2.5"><title>' + esc('A baseline: ' + fix(a)) + '</title></circle>' +
        '<g><title>' + esc('B ProductLab: ' + fix(b)) + '</title>' + disc(sx(b), y, 9.5, 'sea') + '</g>';
    });
    svg += '</svg>';
    const up = rows.filter((m) => d.B[m.id].mean > d.A[m.id].mean).length;
    return fig(svg, '<b>ProductLab concepts scored higher on ' + up + ' of ' + rows.length + '</b> rated metrics (means on a 1 to 5 scale). See the table for the test statistics.' +
      legend([{ color: '#6f7391', label: 'A: baseline', ring: true }, { color: V('sea'), label: 'B: ProductLab' }]));
  }

  PL.fig = { CAT, STATUS_COL, fig, legend, sourceMap, evidenceUse, needsMap, themeBubbles, coverage, conceptMark, morphPath, radar, tornado, riceBubbles, stackDiagram, claimWaffle, sectionBars, dumbbell };
})(typeof globalThis !== 'undefined' ? globalThis : this);
