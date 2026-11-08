/* ProductLab AI - Evaluate view: decision matrix, sensitivity, competitors, risks */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct, formModal, nextId, toast, parseIds } = PL.ui;
  const C = PL.comp;
  const D = PL.decision;

  function ratingVal(p, cid, kid) {
    const r = p.ratings[cid] && p.ratings[cid][kid];
    return r && typeof r === 'object' ? r.value : r;
  }

  function matrixTab(ctx) {
    const p = ctx.project;
    if (!p.concepts.length) return C.empty('Add concepts first (Ideate).');
    const ranked = D.wdm(p.concepts, p.criteria, p.ratings);
    const byId = new Map(ranked.map((r) => [r.id, r]));
    const w = D.normalizeWeights(p.criteria);
    const wsum = p.criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    const crit = '<div class="card"><div class="row between"><h2>Criteria and weights</h2><button class="btn small" data-act="add-crit">+ Criterion</button></div>' +
      (Math.abs(wsum - 100) > 0.01 ? '<div class="warnbox">Weights add up to ' + fix(wsum, 1) + ', not 100. They are normalised automatically (shown as effective %).</div>' : '') +
      '<div class="table-wrap"><table><thead><tr><th>Criterion</th><th>What it means</th><th class="num">Weight</th><th class="num">Effective</th><th></th></tr></thead><tbody>' +
      p.criteria.map((c, i) => '<tr><td><input data-act="set" data-path="criteria.' + esc(c.id) + '.name" value="' + esc(c.name) + '"></td><td><input class="wide" data-act="set" data-path="criteria.' + esc(c.id) + '.description" value="' + esc(c.description || '') + '"></td>' +
        '<td class="num"><input type="number" min="0" step="1" data-act="set" data-type="number" data-path="criteria.' + esc(c.id) + '.weight" value="' + esc(c.weight) + '"></td><td class="num">' + pct(w[i]) + '</td>' +
        '<td><button class="icon-btn" data-act="del" data-path="criteria.' + esc(c.id) + '" data-confirm="Delete criterion ' + esc(c.name) + '?" aria-label="Delete">✕</button></td></tr>').join('') + '</tbody></table></div></div>';
    const grid = '<div class="card"><h2>Weighted decision matrix</h2><p class="muted small">Total = Σ (weight × rating). Rate each concept 1–5 per criterion. Use ✎ to record why, with evidence.</p>' +
      (p.autopilot && p.autopilot.model ? '<div class="infobox">These ratings were <b>suggested by AI</b> (' + esc(p.autopilot.model) + ') with a reason for each (\u{1F4CE}). They are a starting point: change any score or weight and the ranking updates. Then select the concept your team wants to build.</div>' : '') +
      '<div class="table-wrap"><table><thead><tr><th>Concept</th>' + p.criteria.map((c, i) => '<th class="num">' + esc(c.name) + '<br><span class="muted">' + pct(w[i]) + '</span></th>').join('') + '<th class="num">Score</th><th class="num">Rank</th></tr></thead><tbody>' +
      p.concepts.map((c) => {
        const r = byId.get(c.id);
        return '<tr class="' + (r.rank === 1 ? 'selected' : '') + '"><td><b>' + esc(c.name) + '</b>' + (p.selectedConcept === c.id ? ' <span class="pill">Selected</span>' : '') + '</td>' +
          p.criteria.map((k) => {
            const cell = p.ratings[c.id] && p.ratings[c.id][k.id];
            const hasNote = cell && typeof cell === 'object' && (cell.note || (cell.evidence || []).length);
            return '<td class="num"><input type="number" min="1" max="5" step="0.1" data-act="rate" data-c="' + esc(c.id) + '" data-k="' + esc(k.id) + '" data-path="r.' + esc(c.id) + '.' + esc(k.id) + '" value="' + esc(ratingVal(p, c.id, k.id) == null ? '' : ratingVal(p, c.id, k.id)) + '" aria-label="' + esc(c.name + ' ' + k.name) + '">' +
              '<button class="icon-btn" data-act="note" data-c="' + esc(c.id) + '" data-k="' + esc(k.id) + '" title="' + esc(hasNote ? (cell.note || '') + ' ' + (cell.evidence || []).join(', ') : 'Add rationale') + '" aria-label="Rationale">' + (hasNote ? '\u{1F4CE}' : '✎') + '</button></td>';
          }).join('') + '<td class="num"><b>' + fix(r.total) + '</b></td><td class="num">' + r.rank + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn primary" data-act="pick-top">Select top-ranked concept (' + esc(ranked[0].name) + ')</button></div></div>';
    const chart = '<div class="grid two"><div class="card"><h2>Score breakdown</h2>' + PL.fig.fig(C.stackedBars(ranked.map((r) => ({ label: r.name, total: r.total, highlight: r.rank === 1, segments: r.breakdown.map((b, i) => ({ value: b.contribution, label: p.criteria[i].name })) })), p.criteria.map((c) => c.name), { max: 5 }), '<b>' + esc(ranked[0].name) + '</b> ranks first with ' + fix(ranked[0].total) + ' out of 5' + (ranked[1] ? ', ' + fix(ranked[0].total - ranked[1].total) + ' ahead of ' + esc(ranked[1].name) + '.' : '.'), 'bars') + '</div>' +
      '<div class="card"><h2>Profiles of the top ideas</h2>' + PL.fig.radar(p, ranked) + '</div></div>';
    return crit + grid + chart;
  }

  function sensitivityTab(ctx, u) {
    const p = ctx.project;
    if (p.concepts.length < 2) return C.empty('Sensitivity analysis needs at least two concepts.');
    const base = D.normalizeWeights(p.criteria);
    const what = (u.whatif && u.whatif.length === p.criteria.length) ? u.whatif : p.criteria.map((c) => Number(c.weight) || 0);
    const wcrit = p.criteria.map((c, i) => Object.assign({}, c, { weight: what[i] }));
    const now = D.wdm(p.concepts, wcrit, p.ratings);
    const baseTop = D.wdm(p.concepts, p.criteria, p.ratings)[0];
    const sens = D.sensitivity(p.concepts, p.criteria, p.ratings);
    const spread = Number(u.spread || 0.3); const noise = Number(u.noise || 0);
    const mc = D.monteCarlo(p.concepts, p.criteria, p.ratings, { runs: 2000, spread, ratingNoise: noise, seed: 42 });
    const changed = now[0].id !== baseTop.id;
    const robust = sens.filter((s) => !s.flip || Math.abs(s.flip.delta) >= 0.15).length;
    return '<div class="grid two"><div class="card"><h2>What-if weights</h2><p class="muted small">Drag to explore other priorities. This does not change the project until you apply it.</p>' +
      p.criteria.map((c, i) => '<div class="field"><label>' + esc(c.name) + ': <b>' + fix(what[i], 0) + '</b> <span class="muted">(project: ' + esc(c.weight) + ')</span></label><input type="range" min="0" max="100" step="1" value="' + what[i] + '" data-act="whatif" data-i="' + i + '" aria-label="' + esc(c.name) + ' weight"></div>').join('') +
      '<div class="row"><button class="btn small" data-act="whatif-reset">Reset</button><button class="btn small" data-act="whatif-apply">Apply to project</button></div></div>' +
      '<div class="card"><h2>Ranking with these weights</h2>' + (changed ? '<div class="warnbox">With these weights <b>' + esc(now[0].name) + '</b> overtakes ' + esc(baseTop.name) + '.</div>' : '<div class="okbox"><b>' + esc(baseTop.name) + '</b> still ranks first.</div>') +
      C.stackedBars(now.map((r) => ({ label: r.name, total: r.total, highlight: r.rank === 1, segments: r.breakdown.map((b, i) => ({ value: b.contribution, label: p.criteria[i].name })) })), null, { max: 5 }) + '</div></div>' +
      '<div class="card"><h2>One-at-a-time sensitivity</h2><p class="muted small">How far each weight would have to move (others re-scaled proportionally) before the winner changes. Large moves mean a robust decision. ' + robust + ' of ' + sens.length + ' criteria need a shift of 15 points or more.</p>' + PL.fig.tornado(sens) +
      '<div class="table-wrap"><table><thead><tr><th>Criterion</th><th class="num">Current weight</th><th class="num">Winner changes at</th><th class="num">Shift needed</th><th>New winner</th></tr></thead><tbody>' +
      sens.map((s, i) => '<tr><td>' + esc(s.name) + '</td><td class="num">' + pct(base[i]) + '</td><td class="num">' + (s.flip ? pct(s.flip.at) : 'never') + '</td><td class="num">' + (s.flip ? (s.flip.delta > 0 ? '+' : '') + Math.round(s.flip.delta * 100) + ' pts' : '–') + '</td><td>' + (s.flip ? esc(s.flip.newWinnerName) : '<span class="muted">' + esc(baseTop.name) + ' stays first</span>') + '</td></tr>').join('') +
      '</tbody></table></div></div>' +
      '<div class="card"><div class="row between"><h2>Monte Carlo robustness</h2><div class="row small"><label>Weight spread</label><select data-act="uiset" data-view="evaluate" data-key="spread">' + [0.1, 0.2, 0.3, 0.5].map((x) => '<option value="' + x + '"' + (x === spread ? ' selected' : '') + '>±' + x * 100 + '%</option>').join('') + '</select>' +
      '<label>Rating noise</label><select data-act="uiset" data-view="evaluate" data-key="noise">' + [0, 0.25, 0.5, 1].map((x) => '<option value="' + x + '"' + (x === noise ? ' selected' : '') + '>±' + x + '</option>').join('') + '</select></div></div>' +
      '<p class="muted small">2,000 simulated panels: every weight is multiplied by a random factor within the spread (and ratings jittered by the noise), then re-ranked. Seeded, so results are reproducible.</p>' +
      C.stackedBars(mc.map((m) => ({ label: m.name, total: m.winRate, display: pct(m.winRate, 1) + ' wins, mean rank ' + fix(m.meanRank, 1), segments: [{ value: m.winRate, label: 'Win rate' }] })), null, { max: 1, width: 720 }) + '</div>';
  }

  function competitorsTab(ctx) {
    const p = ctx.project;
    const sel = p.concepts.find((c) => c.id === p.selectedConcept);
    const pts = p.competitors.map((c) => ({ x: Number(c.x) || 0, y: Number(c.y) || 0, label: c.name }));
    if (sel) pts.push({ x: Number(p.position.x) || 0, y: Number(p.position.y) || 0, label: sel.name + ' (target)', kind: 'us' });
    return '<div class="grid two"><div class="card"><h2>Market landscape</h2>' + C.scatter(pts, { x: 'Solution breadth', y: 'User need fulfilment' }) +
      (sel ? '<div class="row small"><label>Target position of ' + esc(sel.name) + '</label> breadth <input type="number" min="0" max="10" step="0.5" data-act="set" data-type="number" data-path="position.x" value="' + esc(p.position.x) + '"> fulfilment <input type="number" min="0" max="10" step="0.5" data-act="set" data-type="number" data-path="position.y" value="' + esc(p.position.y) + '"></div>' : '') +
      '<p class="muted small">Positions are team judgements on a 0–10 scale; strengths and gaps should cite evidence where possible.</p></div>' +
      '<div class="card"><div class="row between"><h2>Competitor lens</h2><button class="btn small" data-act="add-comp">+ Competitor</button></div>' +
      (p.competitors.length ? p.competitors.map((c) => '<div class="claim"><div class="row"><input style="font-weight:700" data-act="set" data-path="competitors.' + esc(c.id) + '.name" value="' + esc(c.name) + '"><input class="muted" style="flex:1" data-act="set" data-path="competitors.' + esc(c.id) + '.category" value="' + esc(c.category || '') + '">' +
        '<input type="number" min="0" max="10" step="0.5" title="Breadth" data-act="set" data-type="number" data-path="competitors.' + esc(c.id) + '.x" value="' + esc(c.x) + '"><input type="number" min="0" max="10" step="0.5" title="Fulfilment" data-act="set" data-type="number" data-path="competitors.' + esc(c.id) + '.y" value="' + esc(c.y) + '">' +
        '<button class="icon-btn" data-act="del" data-path="competitors.' + esc(c.id) + '" data-confirm="Delete competitor?" aria-label="Delete">✕</button></div>' +
        '<div class="small"><b>Strengths</b> <input class="wide" data-act="set" data-path="competitors.' + esc(c.id) + '.strengths" value="' + esc(c.strengths || '') + '"></div>' +
        '<div class="small"><b>Gaps</b> <input class="wide" data-act="set" data-path="competitors.' + esc(c.id) + '.gaps" value="' + esc(c.gaps || '') + '"></div>' +
        C.citeEditor(ctx, 'competitors.' + c.id + '.evidence', c.evidence, c.gaps || '') + '</div>').join('') : C.empty('No competitors yet.')) + '</div></div>';
  }

  function risksTab(ctx) {
    const p = ctx.project;
    const sorted = p.risks.slice().sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);
    return '<div class="grid two"><div class="card"><h2>Inverse thinking</h2><p class="muted small">Ask “How could this product fail?” and turn each failure into a mitigation. Likelihood and impact are 1–5.</p>' + C.riskMatrix(p.risks) + '</div>' +
      '<div class="card"><div class="row between"><h2>Risk register</h2><button class="btn small" data-act="add-risk">+ Failure mode</button></div>' +
      (sorted.length ? sorted.map((r) => '<div class="claim"><div class="row"><span class="mono">' + esc(r.id) + '</span><input style="flex:1;font-weight:600" data-act="set" data-path="risks.' + esc(r.id) + '.failure" value="' + esc(r.failure) + '"><span class="pill ' + (r.likelihood * r.impact >= 15 ? '' : 'grey') + '">' + r.likelihood * r.impact + '</span><button class="icon-btn" data-act="del" data-path="risks.' + esc(r.id) + '" data-confirm="Delete risk?" aria-label="Delete">✕</button></div>' +
        '<div class="row small"><label>Likelihood</label><select data-act="set" data-type="number" data-path="risks.' + esc(r.id) + '.likelihood">' + [1, 2, 3, 4, 5].map((x) => '<option' + (x === Number(r.likelihood) ? ' selected' : '') + '>' + x + '</option>').join('') + '</select><label>Impact</label><select data-act="set" data-type="number" data-path="risks.' + esc(r.id) + '.impact">' + [1, 2, 3, 4, 5].map((x) => '<option' + (x === Number(r.impact) ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        '<div class="small"><b>Cause</b> <input class="wide" data-act="set" data-path="risks.' + esc(r.id) + '.cause" value="' + esc(r.cause || '') + '"></div>' +
        '<div class="small"><b>Mitigation</b> <input class="wide" data-act="set" data-path="risks.' + esc(r.id) + '.mitigation" value="' + esc(r.mitigation || '') + '"></div>' +
        C.citeEditor(ctx, 'risks.' + r.id + '.evidence', r.evidence, r.failure + '. ' + (r.cause || '')) + '</div>').join('') : C.empty('No risks recorded.')) + '</div></div>';
  }

  PL.views.evaluate = {
    render(ctx) {
      const u = ctx.ui('evaluate');
      const tab = u.tab || 'matrix';
      const p = ctx.project;
      return C.tabs('evaluate', tab, [
        { id: 'matrix', label: 'Decision matrix' },
        { id: 'sensitivity', label: 'Sensitivity & robustness' },
        { id: 'competitors', label: 'Competitors', count: p.competitors.length },
        { id: 'risks', label: 'Risks', count: p.risks.length }
      ]) + (tab === 'sensitivity' ? sensitivityTab(ctx, u) : tab === 'competitors' ? competitorsTab(ctx) : tab === 'risks' ? risksTab(ctx) : matrixTab(ctx));
    },
    actions: {
      rate(el, e, ctx) {
        const v = el.value === '' ? '' : Math.max(1, Math.min(5, Number(el.value)));
        ctx.commit((p) => {
          p.ratings[el.dataset.c] = p.ratings[el.dataset.c] || {};
          const cur = p.ratings[el.dataset.c][el.dataset.k];
          if (cur && typeof cur === 'object') cur.value = v; else p.ratings[el.dataset.c][el.dataset.k] = { value: v, note: '', evidence: [] };
        });
      },
      async note(el, e, ctx) {
        const p = ctx.project;
        const cell = (p.ratings[el.dataset.c] || {})[el.dataset.k] || {};
        const c = p.concepts.find((x) => x.id === el.dataset.c); const k = p.criteria.find((x) => x.id === el.dataset.k);
        const v = await formModal('Rationale: ' + c.name + ' × ' + k.name, [{ name: 'note', label: 'Why this rating?', type: 'textarea', value: cell.note || '' }, { name: 'evidence', label: 'Evidence IDs', value: (cell.evidence || []).join(', '), help: 'Comma separated, e.g. E19, E20' }]);
        if (!v) return;
        const ids = parseIds(v.evidence);
        const missing = ids.filter((id) => !ctx.index.byId.has(id));
        ctx.commit((pr) => {
          pr.ratings[c.id] = pr.ratings[c.id] || {};
          const cur = pr.ratings[c.id][k.id];
          const val = cur && typeof cur === 'object' ? cur.value : cur;
          pr.ratings[c.id][k.id] = { value: val == null ? '' : val, note: v.note, evidence: ids };
        });
        if (missing.length) toast('Not in the evidence library: ' + missing.join(', '), 'bad');
      },
      'pick-top'(el, e, ctx) { const top = D.wdm(ctx.project.concepts, ctx.project.criteria, ctx.project.ratings)[0]; ctx.commit((p) => { p.selectedConcept = top.id; }); toast(top.name + ' selected', 'ok'); },
      'add-crit'(el, e, ctx) { ctx.commit((p) => p.criteria.push({ id: nextId(p.criteria, 'K'), name: 'New criterion', weight: 10, description: '' })); },
      whatif(el, e, ctx) {
        const u = ctx.ui('evaluate'); const p = ctx.project;
        const cur = (u.whatif && u.whatif.length === p.criteria.length) ? u.whatif.slice() : p.criteria.map((c) => Number(c.weight) || 0);
        cur[Number(el.dataset.i)] = Number(el.value);
        u.whatif = cur; PL.store.save(); ctx.render();
      },
      'whatif-reset'(el, e, ctx) { ctx.ui('evaluate').whatif = null; PL.store.save(); ctx.render(); },
      'whatif-apply'(el, e, ctx) {
        const w = ctx.ui('evaluate').whatif;
        if (!w) return;
        ctx.commit((p) => p.criteria.forEach((c, i) => { c.weight = w[i]; }));
        ctx.ui('evaluate').whatif = null; toast('Weights applied', 'ok');
      },
      async 'add-comp'(el, e, ctx) {
        const v = await formModal('Add competitor', [{ name: 'name', label: 'Name', required: true }, { name: 'category', label: 'Category' }, { name: 'x', label: 'Solution breadth (0-10)', type: 'number', value: 5 }, { name: 'y', label: 'User need fulfilment (0-10)', type: 'number', value: 5 }, { name: 'strengths', label: 'Strengths' }, { name: 'gaps', label: 'Gaps' }]);
        if (!v || !v.name) return;
        ctx.commit((p) => p.competitors.push(Object.assign({ id: nextId(p.competitors, 'K'), evidence: [] }, v)));
      },
      async 'add-risk'(el, e, ctx) {
        const v = await formModal('Add failure mode', [{ name: 'failure', label: 'How could the product fail?', required: true }, { name: 'cause', label: 'Why would that happen?' }, { name: 'likelihood', label: 'Likelihood (1-5)', type: 'number', value: 3 }, { name: 'impact', label: 'Impact (1-5)', type: 'number', value: 3 }, { name: 'mitigation', label: 'Mitigation' }]);
        if (!v || !v.failure) return;
        ctx.commit((p) => p.risks.push(Object.assign({ id: nextId(p.risks, 'X'), evidence: [] }, v, { likelihood: Math.max(1, Math.min(5, Number(v.likelihood) || 3)), impact: Math.max(1, Math.min(5, Number(v.impact) || 3)) })));
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
