/* ProductLab AI - Build plan view: features (RICE), roadmap, tech stack, business model canvas */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct, formModal, nextId, toast } = PL.ui;
  const C = PL.comp;
  const P = PL.planning;

  const IMPACT = [{ v: 3, l: '3 massive' }, { v: 2, l: '2 high' }, { v: 1, l: '1 medium' }, { v: 0.5, l: '0.5 low' }, { v: 0.25, l: '0.25 minimal' }];
  const MOSCOW = ['Must', 'Should', 'Could', "Won't"];
  let replanBusy = false;

  function featuresTab(ctx) {
    const p = ctx.project;
    const sel = p.concepts.find((c) => c.id === p.selectedConcept);
    const rows = P.prioritize(p, ctx.index);
    return '<div class="card"><div class="row between"><div><h2>Feature prioritisation' + (sel ? ' for ' + esc(sel.name) : '') + '</h2>' +
      '<p class="muted small" style="margin:0">RICE = Reach × Impact × Confidence ÷ Effort. <b>Evidence-adjusted</b> RICE scales confidence by (0.5 + 0.5 × evidence score), so features nobody can back with evidence drop down the list.</p></div>' +
      '<div class="row">' + (sel ? '<button class="btn" data-act="replan"' + (replanBusy ? ' disabled' : '') + ' title="Draft features, constraints and business model for the selected concept with the AI model">' + (replanBusy ? '<span class="spin dark"></span> Planning\u2026' : C.icon('redo') + ' Re-plan for ' + esc(sel.name)) + '</button>' : '') +
      '<button class="btn primary" data-act="add-feature">+ Feature</button></div></div>' + PL.fig.riceBubbles(rows) + '</div>' +
      (rows.length ? rows.map((r) => {
        const f = r.feature; const id = esc(f.id); const base = 'features.' + id;
        return '<div class="card"><div class="row"><span class="pill">#' + r.rank + '</span><span class="mono muted">' + id + '</span>' +
          '<input style="flex:1;min-width:200px;font-weight:700" data-act="set" data-path="' + base + '.name" value="' + esc(f.name) + '">' +
          '<span class="small">RICE <b>' + fix(r.raw, 1) + '</b>, adjusted to <b>' + fix(r.adjusted, 1) + '</b> for ' + pct(r.evidence) + ' evidence</span>' +
          '<button class="icon-btn" data-act="del" data-path="' + base + '" data-confirm="Delete feature ' + esc(f.name) + '?" aria-label="Delete">' + C.icon('x') + '</button></div>' +
          '<div class="row small" style="margin-top:8px">' +
          '<label>Reach %</label><input type="number" min="0" max="100" data-act="set" data-type="number" data-path="' + base + '.reach" value="' + esc(f.reach) + '">' +
          '<label>Impact</label><select data-act="set" data-type="number" data-path="' + base + '.impact">' + IMPACT.map((x) => '<option value="' + x.v + '"' + (Number(f.impact) === x.v ? ' selected' : '') + '>' + x.l + '</option>').join('') + '</select>' +
          '<label>Confidence %</label><input type="number" min="0" max="100" data-act="set" data-type="number" data-path="' + base + '.confidence" value="' + esc(f.confidence) + '">' +
          '<label>Effort (person-weeks)</label><input type="number" min="0.1" step="0.5" data-act="set" data-type="number" data-path="' + base + '.effort" value="' + esc(f.effort) + '">' +
          '<label>MoSCoW</label><select data-act="set" data-path="' + base + '.moscow">' + MOSCOW.map((m) => '<option' + (f.moscow === m ? ' selected' : '') + '>' + m + '</option>').join('') + '</select>' +
          (f.moscow !== r.suggestedMoscow ? '<span class="muted">(suggested: ' + esc(r.suggestedMoscow) + ')</span>' : '') +
          '<label>Depends on</label><input class="mono" style="width:110px" data-act="set" data-type="ids" data-path="' + base + '.dependsOn" value="' + esc((f.dependsOn || []).join(', ')) + '">' +
          '<label>Needs</label><input class="mono" style="width:110px" data-act="set" data-type="ids" data-path="' + base + '.needs" value="' + esc((f.needs || []).join(', ')) + '"></div>' +
          '<div class="field" style="margin-top:8px"><textarea rows="2" placeholder="Rationale: why does the evidence justify this feature?" data-act="set" data-path="' + base + '.rationale">' + esc(f.rationale || f.description || '') + '</textarea>' +
          C.citeEditor(ctx, base + '.evidence', f.evidence, [f.name, f.rationale || f.description].join('. ')) + '</div></div>';
      }).join('') : C.empty('No features yet.'));
  }

  function roadmapTab(ctx) {
    const p = ctx.project;
    const order = P.prioritize(p, ctx.index).map((r) => r.feature.id);
    const s = P.schedule(p, { priority: order });
    const pl = p.plan;
    return '<div class="card"><h2>MVP roadmap</h2><div class="row small">' +
      '<label>Team size</label><input type="number" min="1" max="50" data-act="set" data-type="number" data-path="plan.teamSize" value="' + esc(pl.teamSize) + '">' +
      '<label>Sprint length (weeks)</label><input type="number" min="1" max="6" data-act="set" data-type="number" data-path="plan.sprintWeeks" value="' + esc(pl.sprintWeeks) + '">' +
      '<label>Focus</label><select data-act="set" data-type="number" data-path="plan.focus">' + [0.4, 0.5, 0.6, 0.7, 0.8, 1].map((x) => '<option value="' + x + '"' + (Number(pl.focus) === x ? ' selected' : '') + '>' + x * 100 + '% of time on build</option>').join('') + '</select>' +
      '<label>Risk buffer</label><select data-act="set" data-type="number" data-path="plan.buffer">' + [0, 0.1, 0.2, 0.3, 0.5].map((x) => '<option value="' + x + '"' + (Number(pl.buffer) === x ? ' selected' : '') + '>+' + x * 100 + '%</option>').join('') + '</select></div>' +
      '<p class="muted small">Features are scheduled in dependency order, then by MoSCoW and evidence-adjusted RICE. "Won’t" features are left out. Capacity = team × focus person-weeks per week.</p>' +
      (s.cyclic.length ? '<div class="warnbox">Dependency cycle between ' + esc(s.cyclic.join(', ')) + ' — these features cannot be scheduled. Fix "Depends on".</div>' : '') +
      '<div class="table-wrap">' + C.gantt(s) + '</div></div>' +
      '<div class="stats">' + s.phases.map((ph) => C.stat(ph.name, ph.tasks.length ? 'Week ' + Math.ceil(ph.weeks) : '–', ph.tasks.length + ' features, ' + fix(ph.effort, 1) + ' person-weeks')).join('') + C.stat('Total effort', fix(s.totalEffort, 1), 'person-weeks incl. buffer') + '</div>';
  }

  function stackTab(ctx) {
    const p = ctx.project;
    const k = p.constraints;
    const rec = P.recommendStack(k);
    const chk = (key, label) => '<label class="check"><input type="checkbox" data-act="set" data-path="constraints.' + key + '"' + (k[key] ? ' checked' : '') + '> ' + esc(label) + '</label>';
    const sel = (key, label, opts) => '<div class="field"><label>' + esc(label) + '</label><select data-act="set" data-path="constraints.' + key + '">' + opts.map((o) => '<option value="' + o[0] + '"' + (String(k[key]) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
    return '<div class="card"><h2>What it takes to build' + (p.concepts.find((c) => c.id === p.selectedConcept) ? ' ' + esc(p.concepts.find((c) => c.id === p.selectedConcept).name) : ' it') + '</h2>' + PL.fig.stackDiagram(rec) + '</div><div class="grid two"><div class="card"><h2>Constraints</h2>' +
      sel('platform', 'Platform', [['mobile', 'Mobile app'], ['web', 'Web app'], ['both', 'Mobile + web']]) +
      sel('ai', 'Intelligence needed', [['none', 'None'], ['rules', 'Transparent rules / statistics'], ['ml', 'Trained ML models'], ['llm', 'Generative AI (LLM)']]) +
      sel('budget', 'Budget', [['low', 'Low (student / pilot)'], ['medium', 'Medium'], ['high', 'High']]) +
      '<div class="field"><label>Expected users (first year)</label><input type="number" min="10" step="100" data-act="set" data-type="number" data-path="constraints.expectedUsers" value="' + esc(k.expectedUsers) + '" style="width:140px"></div>' +
      '<div class="field"><label>Team skills (comma separated)</label><input class="wide" data-act="set" data-type="list" data-path="constraints.skills" value="' + esc((k.skills || []).join(', ')) + '"></div>' +
      '<div class="field"><label>Region</label><input data-act="set" data-path="constraints.region" value="' + esc(k.region || '') + '"></div>' +
      chk('sensitiveData', 'Handles sensitive personal data (health, finance)') + chk('offline', 'Must work offline') + chk('wearables', 'Integrates wearables / phone health data') + chk('realtime', 'Needs realtime updates') + '</div>' +
      '<div class="card"><h2>Recommended stack</h2><p class="muted small">Rule-based and explainable: every pick lists the constraint that triggered it.</p>' +
      rec.map((r) => '<div class="claim"><div class="row between"><b>' + esc(r.layer) + '</b><span>' + esc(r.choice) + '</span></div><ul class="small">' + r.why.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' + (r.alternatives.length ? '<div class="muted small">Alternatives: ' + esc(r.alternatives.join(', ')) + '</div>' : '') + '</div>').join('') + '</div></div>';
  }

  function canvasTab(ctx) {
    const b = ctx.project.bmc || {};
    const blk = (cls, key, label) => '<div class="blk ' + cls + '"><label for="bmc-' + key + '">' + esc(label) + '</label><textarea id="bmc-' + key + '" data-act="set" data-path="bmc.' + key + '">' + esc(b[key] || '') + '</textarea></div>';
    return '<div class="card"><h2>Business Model Canvas</h2><p class="muted small">Validate business viability of the selected concept.</p><div class="bmc">' +
      blk('kp', 'keyPartners', 'Key partners') + blk('ka', 'keyActivities', 'Key activities') + blk('kr', 'keyResources', 'Key resources') + blk('vp', 'valuePropositions', 'Value propositions') +
      blk('cr', 'customerRelationships', 'Customer relationships') + blk('ch', 'channels', 'Channels') + blk('cs', 'customerSegments', 'Customer segments') +
      blk('cost', 'costStructure', 'Cost structure') + blk('rev', 'revenueStreams', 'Revenue streams') + '</div></div>';
  }

  PL.views.build = {
    render(ctx) {
      const u = ctx.ui('build');
      const tab = u.tab || 'features';
      const p = ctx.project;
      return C.tabs('build', tab, [
        { id: 'features', label: 'Features', count: p.features.length },
        { id: 'roadmap', label: 'MVP roadmap' },
        { id: 'stack', label: 'Tech stack' },
        { id: 'canvas', label: 'Business model' }
      ]) + (tab === 'roadmap' ? roadmapTab(ctx) : tab === 'stack' ? stackTab(ctx) : tab === 'canvas' ? canvasTab(ctx) : featuresTab(ctx));
    },
    actions: {
      async replan(el, e, ctx) {
        const p = ctx.project;
        const settings = Object.assign({}, ctx.state.settings.ai, { apiKey: ctx.state.apiKey });
        if (!PL.autopilot.hasModel(settings)) { toast('Connect an AI model in Settings first', 'bad'); return; }
        const sel = p.concepts.find((c) => c.id === p.selectedConcept);
        if (p.features.length && !(await PL.ui.confirmModal('Replace the ' + p.features.length + ' current features, constraints and business model with a new plan for ' + sel.name + '?', 'Re-plan'))) return;
        replanBusy = true; ctx.render();
        try {
          const b = await PL.autopilot.buildPlan(p, sel.id, settings);
          ctx.commit((pr) => { pr.features = b.features; pr.constraints = Object.assign({}, pr.constraints, b.constraints, { skills: pr.constraints.skills }); pr.bmc = Object.assign({}, pr.bmc, b.bmc); });
          toast(b.features.length + ' features planned for ' + sel.name, 'ok');
        } catch (err) { toast('Re-plan failed: ' + err.message, 'bad'); }
        replanBusy = false; ctx.render();
      },
      async 'add-feature'(el, e, ctx) {
        const v = await formModal('Add feature', [
          { name: 'name', label: 'Feature', required: true },
          { name: 'rationale', label: 'Rationale (what evidence justifies it?)', type: 'textarea' },
          { name: 'reach', label: 'Reach: % of target users per quarter', type: 'number', value: 50 },
          { name: 'impact', label: 'Impact', type: 'select', value: 1, options: IMPACT.map((x) => ({ value: x.v, label: x.l })) },
          { name: 'confidence', label: 'Confidence %', type: 'number', value: 50 },
          { name: 'effort', label: 'Effort (person-weeks)', type: 'number', value: 2, step: 0.5 },
          { name: 'moscow', label: 'MoSCoW', type: 'select', value: 'Should', options: MOSCOW }
        ]);
        if (!v || !v.name) return;
        ctx.commit((p) => p.features.push({ id: nextId(p.features, 'F'), name: v.name, description: '', rationale: v.rationale, reach: v.reach, impact: Number(v.impact), confidence: v.confidence, effort: v.effort, moscow: v.moscow, needs: [], evidence: [], dependsOn: [] }));
        toast('Feature added — cite evidence to raise its adjusted score', 'ok');
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
