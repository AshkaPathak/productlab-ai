/* ProductLab AI - Ideate view: concepts, morphological analysis, random association, AI assist */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct, formModal, nextId, toast, parseIds, confirmModal } = PL.ui;
  const C = PL.comp;
  const I = PL.ideation;

  const ORIGIN = { team: 'Team idea', morph: 'Morphological analysis', random: 'Random association', ai: 'AI (evidence-grounded)', 'ai-baseline': 'AI (baseline)' };

  function conceptsTab(ctx) {
    const p = ctx.project;
    return '<div class="row between" style="margin-bottom:12px"><p class="muted small" style="margin:0">Every concept carries claims; each claim cites evidence. The evidence score combines how well claims are supported with the strength of their sources.</p><button class="btn primary" data-act="add-concept">+ Add concept</button></div>' +
      (p.concepts.length ? p.concepts.map((c) => {
        const score = PL.evidence.conceptEvidenceScore(ctx.index, c);
        const sel = p.selectedConcept === c.id;
        return '<div class="card concept-card' + (sel ? ' selected' : '') + '"><div class="row"><span class="mono muted">' + esc(c.id) + '</span>' +
          '<input style="flex:1;min-width:180px;font-weight:700;font-size:1.05rem" data-act="set" data-path="concepts.' + esc(c.id) + '.name" value="' + esc(c.name) + '" aria-label="Concept name">' +
          '<span class="pill grey">' + esc(ORIGIN[c.origin] || c.origin || 'Team idea') + '</span><span class="pill" title="Evidence score">Evidence ' + pct(score) + '</span>' +
          (sel ? '<span class="pill">Selected</span>' : '<button class="btn small" data-act="select" data-id="' + esc(c.id) + '">Select</button>') +
          '<button class="icon-btn" data-act="del" data-path="concepts.' + esc(c.id) + '" data-confirm="Delete concept ' + esc(c.name) + '?" aria-label="Delete">✕</button></div>' +
          '<input class="wide muted" style="margin-top:6px" placeholder="Tagline" data-act="set" data-path="concepts.' + esc(c.id) + '.tagline" value="' + esc(c.tagline || '') + '">' +
          '<textarea rows="2" style="margin-top:6px" placeholder="Description" data-act="set" data-path="concepts.' + esc(c.id) + '.description">' + esc(c.description || '') + '</textarea>' +
          '<div class="row small" style="margin:6px 0"><label>Needs addressed</label><input class="mono" style="width:200px" data-act="set" data-type="ids" data-path="concepts.' + esc(c.id) + '.needs" value="' + esc((c.needs || []).join(', ')) + '"></div>' +
          (c.claims || []).map((cl, i) => '<div class="claim"><div class="row"><textarea rows="2" style="flex:1" data-act="set" data-path="concepts.' + esc(c.id) + '.claims.' + i + '.text">' + esc(cl.text) + '</textarea><button class="icon-btn" data-act="del-claim" data-id="' + esc(c.id) + '" data-i="' + i + '" aria-label="Remove claim">✕</button></div>' +
            C.citeEditor(ctx, 'concepts.' + c.id + '.claims.' + i + '.evidence', cl.evidence, cl.text) + '</div>').join('') +
          '<button class="btn small" data-act="add-claim" data-id="' + esc(c.id) + '">+ Claim</button></div>';
      }).join('') : C.empty('No concepts yet. Generate some with Morphological analysis, Random association or the AI assistant.'));
  }

  function selectionScore(ctx, sel) {
    const p = ctx.project;
    const complete = p.morph.params.every((pm) => sel[pm.id]);
    if (!complete) return null;
    return I.scoreCombo(sel, p, ctx.index);
  }

  function morphTab(ctx, u) {
    const p = ctx.project;
    const params = p.morph.params;
    const sel = u.sel || {};
    const v = I.violations(sel, p.morph.rules);
    const sc = selectionScore(ctx, sel);
    const total = I.comboCount(params);
    const blockedBy = (pid, opt) => p.morph.rules.find((r) => (r.a[0] === pid && r.a[1] === opt && sel[r.b[0]] === r.b[1]) || (r.b[0] === pid && r.b[1] === opt && sel[r.a[0]] === r.a[1]));
    let explore = '';
    if (u.explore && params.length) {
      const t = I.topCombos(p, ctx.index, 6);
      explore = '<div class="card"><h2>Most promising combinations</h2><p class="muted small">' + t.total + ' combinations in total; ' + t.rejected + ' rejected by compatibility rules; ' + t.feasible + ' scored by how well they cover the evidence-backed needs (severity-weighted). Showing a diverse top 6.</p>' +
        '<div class="table-wrap"><table><thead><tr>' + params.map((pm) => '<th>' + esc(pm.name) + '</th>').join('') + '<th class="num">Need fit</th><th>Needs covered</th><th></th></tr></thead><tbody>' +
        t.top.map((x, i) => '<tr>' + params.map((pm) => '<td class="small">' + esc(x.selection[pm.id]) + '</td>').join('') + '<td class="num">' + fix(x.score, 3) + '</td><td class="mono small">' + esc(x.matched.map((m) => m.id).join(', ')) + '</td><td><button class="btn small" data-act="use-combo" data-i="' + i + '">Use</button></td></tr>').join('') +
        '</tbody></table></div></div>';
      u._top = t.top.map((x) => x.selection);
    }
    return '<div class="card"><div class="row between"><div><h2>Morphological analysis</h2><p class="muted small" style="margin:0">Pick one option per parameter. ' + params.length + ' parameters create <b>' + total + '</b> possible combinations; compatibility rules remove impossible ones.</p></div>' +
      '<div class="row"><button class="btn" data-act="uiset" data-view="ideate" data-key="explore" data-value="' + (u.explore ? '' : '1') + '">' + (u.explore ? 'Hide' : 'Explore') + ' top combinations</button></div></div>' +
      (params.length ? '<div class="morph-grid" style="margin-top:14px">' + params.map((pm) => '<div><b>' + esc(pm.name) + '</b></div><div class="opts">' + pm.options.map((o) => {
        const lab = I.optLabel(o);
        const on = sel[pm.id] === lab;
        const b = !on && blockedBy(pm.id, lab);
        return '<button class="opt' + (on ? ' on' : '') + (b ? ' blocked' : '') + '" data-act="pick" data-param="' + esc(pm.id) + '" data-opt="' + esc(lab) + '" title="' + esc((o.hint || '') + (b ? '\nIncompatible: ' + b.reason : '')) + '" aria-pressed="' + on + '">' + esc(lab) + '</button>';
      }).join('') + '</div>').join('') + '</div>' : C.empty('No parameters yet. Add parameters below.')) +
      (v.length ? '<div class="warnbox">' + v.map((x) => 'Incompatible: ' + esc(x.reason)).join('<br>') + '</div>' : '') +
      (sc && !v.length ? '<div class="okbox">Need fit <b>' + fix(sc.score, 3) + '</b> — covers ' + (sc.matched.length ? sc.matched.map((m) => '<b>' + esc(m.id) + '</b>').join(', ') : 'no need strongly') + '. <button class="btn small primary" data-act="morph-concept">Create concept from this combination</button></div>' : '') +
      '</div>' + explore +
      '<details class="card"' + (params.length ? '' : ' open') + '><summary>Edit parameters and compatibility rules</summary>' +
      '<p class="muted small">One option per line. Add a short description after a colon to help the engine match options to needs, e.g. <span class="mono">Mobile app: smartphone tracking information</span>.</p>' +
      '<div class="grid two">' + params.map((pm) => '<div class="field"><div class="row"><input data-act="set" data-path="morph.params.' + esc(pm.id) + '.name" value="' + esc(pm.name) + '" style="font-weight:700"><button class="icon-btn" data-act="del" data-path="morph.params.' + esc(pm.id) + '" data-confirm="Delete parameter ' + esc(pm.name) + '?" aria-label="Delete parameter">✕</button></div>' +
        '<textarea rows="4" class="mono small" data-act="opts" data-param="' + esc(pm.id) + '" data-focus="opts-' + esc(pm.id) + '">' + esc(pm.options.map((o) => typeof o === 'string' ? o : o.label + (o.hint ? ': ' + o.hint : '')).join('\n')) + '</textarea></div>').join('') + '</div>' +
      '<button class="btn small" data-act="add-param">+ Parameter</button>' +
      '<h3 style="margin-top:16px">Compatibility rules</h3>' + (p.morph.rules.length ? '<ul class="small">' + p.morph.rules.map((r, i) => '<li><b>' + esc(r.a[1]) + '</b> cannot go with <b>' + esc(r.b[1]) + '</b> — ' + esc(r.reason) + ' <button class="icon-btn" data-act="del-rule" data-i="' + i + '" aria-label="Delete rule">✕</button></li>').join('') + '</ul>' : '<p class="muted small">No rules.</p>') +
      '<button class="btn small" data-act="add-rule"' + (params.length < 2 ? ' disabled' : '') + '>+ Rule</button></details>';
  }

  function randomTab(ctx, u) {
    const p = ctx.project;
    const seed = Number(u.seed || 7);
    const prompts = I.randomAssociation(p.needs, { seed, count: 4 });
    return '<div class="card"><div class="row between"><div><h2>Random association</h2><p class="muted small" style="margin:0">Unrelated stimulus words force new connections with a real need. Shuffle until a prompt sparks an idea, then capture it.</p></div><button class="btn primary" data-act="shuffle">Shuffle</button></div></div>' +
      '<div class="grid two">' + prompts.map((x, i) => '<div class="card"><div class="prompt"><span class="stim">' + esc(x.stimulus) + '</span> → <i>' + esc(x.attribute) + '</i><br>' + esc(x.prompt) + '</div>' +
        '<div class="row" style="margin-top:10px"><span class="muted small">Need ' + esc(x.need || '–') + '</span><span class="spacer"></span><button class="btn small" data-act="capture" data-i="' + i + '">Capture idea as concept</button></div></div>').join('') + '</div>' +
      '<p class="muted small">Session seed ' + seed + ' (record it to reproduce the same prompts). Stimuli: ' + esc(I.STIMULI.map((s) => s.word).join(', ')) + '.</p>';
  }

  function aiTab(ctx, u) {
    const ai = ctx.state.settings.ai;
    const ready = ai.model && (ctx.state.apiKey || /localhost|127\.0\.0\.1/.test(ai.baseUrl));
    const res = u.ai || null;
    const mode = u.aiMode || 'grounded';
    let out = '';
    if (res && res.concepts) {
      out = res.concepts.map((c, i) => {
        const verdicts = c.claims.map((cl) => PL.evidence.verify(ctx.index, cl));
        const traced = verdicts.filter((v) => v.status === 'supported' || v.status === 'partial').length;
        const halluc = verdicts.reduce((s, v) => s + v.missing.length, 0);
        return '<div class="card concept-card"><div class="row between"><h3>' + esc(c.name) + '</h3><span class="pill">Traceability ' + pct(c.claims.length ? traced / c.claims.length : 0) + '</span></div>' +
          (c.tagline ? '<div class="muted">' + esc(c.tagline) + '</div>' : '') + '<p class="small">' + esc(c.description) + '</p>' +
          c.claims.map((cl, j) => '<div class="claim small"><div>' + esc(cl.text) + '</div><div class="cite">' + C.badge(verdicts[j].status) + (cl.evidence || []).map((id) => '<span class="chip ' + (ctx.index.byId.has(id) ? '' : 'bad') + '" title="' + esc(C.findingTitle(ctx, id)) + '">' + esc(id) + '</span>').join('') + '</div></div>').join('') +
          (halluc ? '<div class="warnbox">' + halluc + ' citation(s) point to evidence IDs that do not exist — the guard caught them.</div>' : '') +
          '<div class="row" style="margin-top:10px"><button class="btn small primary" data-act="ai-add" data-i="' + i + '">Add to concepts</button><button class="btn small" data-act="ai-study" data-i="' + i + '">Add to evaluation study</button></div></div>';
      }).join('');
      out = '<p class="muted small">Generated ' + esc(res.at || '') + ' in ' + (res.mode === 'grounded' ? 'evidence-grounded' : 'baseline') + ' mode with ' + esc(res.model || '') + '.</p>' + out +
        '<details class="card"><summary>Show the exact prompt (for your methodology section)</summary><pre class="code">' + esc((res.messages || []).map((m) => m.role.toUpperCase() + ':\n' + m.content).join('\n\n')) + '</pre></details>';
    }
    return '<div class="card"><h2>AI assistant</h2>' +
      (ready ? '' : '<div class="infobox">Connect a language model in <a href="#/settings">Settings</a> (a free Google Gemini key works, or Ollama on your own computer). Everything else in ProductLab works without it.</div>') +
      '<p class="muted small"><b>Evidence-grounded</b> mode gives the model your needs and numbered evidence and requires citations. <b>Baseline</b> mode is ordinary AI brainstorming from the challenge alone — use it as the comparison condition in your evaluation study. Every claim is checked by the citation guard.</p>' +
      '<div class="row"><select data-act="uiset" data-view="ideate" data-key="aiMode" aria-label="Mode"><option value="grounded"' + (mode === 'grounded' ? ' selected' : '') + '>Evidence-grounded</option><option value="baseline"' + (mode === 'baseline' ? ' selected' : '') + '>Baseline (no evidence)</option></select>' +
      '<select data-act="uiset" data-view="ideate" data-key="aiCount" aria-label="Number of concepts">' + [2, 3, 4, 5].map((n) => '<option' + (Number(u.aiCount || 3) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<button class="btn primary" data-act="ai-run"' + (ready && !u.aiBusy ? '' : ' disabled') + '>' + (u.aiBusy ? '<span class="spin"></span> Generating…' : 'Generate concepts') + '</button></div>' +
      (u.aiError ? '<div class="warnbox">' + esc(u.aiError) + '</div>' : '') + '</div>' + out;
  }

  PL.views.ideate = {
    render(ctx) {
      const u = ctx.ui('ideate');
      const tab = u.tab || 'concepts';
      const p = ctx.project;
      return C.tabs('ideate', tab, [
        { id: 'concepts', label: 'Concepts', count: p.concepts.length },
        { id: 'morph', label: 'Morphological analysis' },
        { id: 'random', label: 'Random association' },
        { id: 'ai', label: 'AI assistant' }
      ]) + (tab === 'morph' ? morphTab(ctx, u) : tab === 'random' ? randomTab(ctx, u) : tab === 'ai' ? aiTab(ctx, u) : conceptsTab(ctx));
    },
    actions: {
      async 'add-concept'(el, e, ctx) {
        const v = await formModal('Add concept', [{ name: 'name', label: 'Name', required: true }, { name: 'tagline', label: 'Tagline' }, { name: 'description', label: 'Description', type: 'textarea' }]);
        if (!v || !v.name) return;
        ctx.commit((p) => p.concepts.push({ id: nextId(p.concepts, 'C'), name: v.name, tagline: v.tagline, description: v.description, origin: 'team', needs: [], claims: [] }));
      },
      select(el, e, ctx) { ctx.commit((p) => { p.selectedConcept = el.dataset.id; }); toast('Selected concept for the build plan', 'ok'); },
      'add-claim'(el, e, ctx) { ctx.commit((p) => p.concepts.find((c) => c.id === el.dataset.id).claims.push({ text: 'New claim — cite the evidence that supports it', evidence: [] })); },
      'del-claim'(el, e, ctx) { ctx.commit((p) => p.concepts.find((c) => c.id === el.dataset.id).claims.splice(Number(el.dataset.i), 1)); },
      pick(el, e, ctx) {
        const u = ctx.ui('ideate');
        u.sel = Object.assign({}, u.sel || {});
        if (u.sel[el.dataset.param] === el.dataset.opt) delete u.sel[el.dataset.param]; else u.sel[el.dataset.param] = el.dataset.opt;
        PL.store.save(); ctx.render();
      },
      'use-combo'(el, e, ctx) { const u = ctx.ui('ideate'); u.sel = Object.assign({}, u._top[Number(el.dataset.i)]); PL.store.save(); ctx.render(); },
      async 'morph-concept'(el, e, ctx) {
        const u = ctx.ui('ideate');
        const draft = I.synthesizeConcept(u.sel, ctx.project, ctx.index);
        const v = await formModal('Name this concept', [{ name: 'name', label: 'Name', value: '', required: true, help: 'Combination: ' + draft.name }, { name: 'tagline', label: 'Tagline' }], { intro: draft.claims.length + ' evidence-linked claims were drafted from the combination. Review them on the Concepts tab.' });
        if (!v || !v.name) return;
        ctx.commit((p) => p.concepts.push(Object.assign(draft, { id: nextId(p.concepts, 'C'), name: v.name, tagline: v.tagline || draft.tagline })));
        u.tab = 'concepts'; ctx.render();
      },
      opts(el, e, ctx) {
        const options = el.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? { label: l.slice(0, i).trim(), hint: l.slice(i + 1).trim() } : { label: l, hint: '' }; });
        ctx.commit((p) => { p.morph.params.find((x) => x.id === el.dataset.param).options = options; });
      },
      'add-param'(el, e, ctx) { ctx.commit((p) => p.morph.params.push({ id: nextId(p.morph.params, 'M'), name: 'New parameter', options: [{ label: 'Option A', hint: '' }, { label: 'Option B', hint: '' }] })); },
      async 'add-rule'(el, e, ctx) {
        const p = ctx.project;
        const opts = [];
        p.morph.params.forEach((pm) => pm.options.forEach((o) => opts.push({ value: pm.id + '|' + I.optLabel(o), label: pm.name + ': ' + I.optLabel(o) })));
        const v = await formModal('Add compatibility rule', [{ name: 'a', label: 'This option', type: 'select', options: opts }, { name: 'b', label: 'cannot be combined with', type: 'select', options: opts }, { name: 'reason', label: 'Reason', required: true }]);
        if (!v || !v.reason) return;
        const a = v.a.split('|'); const b = v.b.split('|');
        if (a[0] === b[0]) { toast('Choose options from two different parameters', 'bad'); return; }
        ctx.commit((pr) => pr.morph.rules.push({ a: [a[0], a.slice(1).join('|')], b: [b[0], b.slice(1).join('|')], reason: v.reason }));
      },
      'del-rule'(el, e, ctx) { ctx.commit((p) => p.morph.rules.splice(Number(el.dataset.i), 1)); },
      shuffle(el, e, ctx) { const u = ctx.ui('ideate'); u.seed = Math.floor(Math.random() * 99999) + 1; PL.store.save(); ctx.render(); },
      async capture(el, e, ctx) {
        const u = ctx.ui('ideate');
        const x = I.randomAssociation(ctx.project.needs, { seed: Number(u.seed || 7), count: 4 })[Number(el.dataset.i)];
        const v = await formModal('Capture idea', [{ name: 'name', label: 'Concept name', required: true }, { name: 'description', label: 'What is the idea?', type: 'textarea', required: true }], { intro: x.prompt });
        if (!v || !v.name) return;
        const need = ctx.project.needs.find((n) => n.id === x.need);
        ctx.commit((p) => p.concepts.push({ id: nextId(p.concepts, 'C'), name: v.name, tagline: 'Inspired by "' + x.stimulus + '": ' + x.attribute, description: v.description, origin: 'random', needs: need ? [need.id] : [], claims: need ? [{ text: 'Addresses the need: ' + need.statement, evidence: (need.evidence || []).slice(0, 3) }] : [] }));
        u.tab = 'concepts'; ctx.render();
      },
      async 'ai-run'(el, e, ctx) {
        const u = ctx.ui('ideate');
        const s = ctx.state.settings.ai;
        u.aiBusy = true; u.aiError = ''; ctx.render();
        try {
          const mode = u.aiMode || 'grounded';
          const r = await PL.llm.generateConcepts(ctx.project, Object.assign({}, s, { apiKey: ctx.state.apiKey }), { mode, count: Number(u.aiCount || 3) });
          if (!r.concepts.length) throw new Error('The model replied, but no concepts could be read from the reply.');
          u.ai = { concepts: r.concepts, mode, messages: r.messages, model: s.model, at: new Date().toLocaleString() };
        } catch (err) {
          u.aiError = err.message + (/Failed to fetch|NetworkError/.test(err.message) ? ' — the request was blocked (network or CORS). Check the base URL in Settings.' : '');
        }
        u.aiBusy = false; PL.store.save(); ctx.render();
      },
      'ai-add'(el, e, ctx) {
        const c = ctx.ui('ideate').ai.concepts[Number(el.dataset.i)];
        ctx.commit((p) => p.concepts.push(Object.assign(JSON.parse(JSON.stringify(c)), { id: nextId(p.concepts, 'C') })));
        toast('Added "' + c.name + '" to concepts', 'ok');
      },
      async 'ai-study'(el, e, ctx) {
        const u = ctx.ui('ideate');
        const c = u.ai.concepts[Number(el.dataset.i)];
        const v = await formModal('Add to evaluation study', [{ name: 'participant', label: 'Participant / session ID', required: true, value: 'P1' }, { name: 'condition', label: 'Condition', type: 'select', value: u.ai.mode === 'grounded' ? 'B' : 'A', options: [{ value: 'A', label: 'A – baseline (ordinary AI brainstorming)' }, { value: 'B', label: 'B – ProductLab evidence-linked workflow' }] }]);
        if (!v) return;
        ctx.commit((p) => p.experiment.entries.push({ id: nextId(p.experiment.entries, 'X'), participant: v.participant, condition: v.condition, name: c.name, description: c.description, claims: JSON.parse(JSON.stringify(c.claims)), source: 'ai-' + u.ai.mode }));
        toast('Added to study as condition ' + v.condition, 'ok');
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
