/* ProductLab AI - Discover view: needs, opportunity miner (themes), personas */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, formModal, nextId, toast } = PL.ui;
  const C = PL.comp;

  function needsTab(ctx) {
    const p = ctx.project;
    const orphans = PL.cluster.orphanFindings(p);
    return (p.needs.length ? '<div class="card"><h2>What hurts most, and how sure we are</h2>' + PL.fig.needsMap(p, ctx.index) + '</div>' : '') + '<div class="card"><div class="row between" style="margin-bottom:8px"><div><h2>Validated needs</h2><p class="muted small" style="margin:0">Each need should be backed by evidence. The badge shows whether the cited findings actually support the statement.</p></div><button class="btn primary" data-act="add-need">+ Add need</button></div>' +
      (p.needs.length ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th style="width:50%">Need statement & evidence</th><th>Severity</th><th></th></tr></thead><tbody>' +
        p.needs.map((n) => '<tr><td class="mono">' + esc(n.id) + '</td><td><textarea rows="2" data-act="set" data-path="needs.' + esc(n.id) + '.statement">' + esc(n.statement) + '</textarea>' +
          C.citeEditor(ctx, 'needs.' + n.id + '.evidence', n.evidence, n.statement) + '</td>' +
          '<td><select data-act="set" data-type="number" data-path="needs.' + esc(n.id) + '.severity" aria-label="Severity">' + [5, 4, 3, 2, 1].map((s) => '<option value="' + s + '"' + (Number(n.severity) === s ? ' selected' : '') + '>' + s + (s === 5 ? ' critical' : s === 1 ? ' minor' : '') + '</option>').join('') + '</select></td>' +
          '<td><button class="icon-btn" data-act="del" data-path="needs.' + esc(n.id) + '" data-confirm="Delete need ' + esc(n.id) + '?" aria-label="Delete">✕</button></td></tr>').join('') +
        '</tbody></table></div>' : C.empty('No needs yet. Use the Opportunity miner to turn evidence themes into needs.')) +
      (orphans.length ? '<p class="muted small" style="margin-top:10px">' + orphans.length + ' evidence findings are not used by any need yet: <span class="mono">' + esc(orphans.join(', ')) + '</span></p>' : '') +
      '</div><div class="card"><h2>How might we …</h2><textarea rows="2" data-act="set" data-path="hmw">' + esc(p.hmw) + '</textarea></div>';
  }

  function themesTab(ctx, u) {
    const p = ctx.project;
    const th = Number(u.threshold || 0.12);
    const themes = PL.cluster.themes(p, ctx.index, { threshold: th });
    const byId = new Map(p.findings.map((f) => [f.id, f]));
    const multi = themes.filter((t) => t.members.length > 1);
    const singles = themes.filter((t) => t.members.length === 1);
    return '<div class="card"><h2>Opportunity miner</h2><p class="muted small">Groups evidence findings into themes using average-linkage clustering on TF-IDF similarity, and links each theme to the closest need. Themes without a matching need are candidate opportunities.</p>' +
      '<div class="row"><label for="th">Grouping strictness: <b>' + fix(th) + '</b></label><input id="th" type="range" min="0.04" max="0.4" step="0.01" value="' + th + '" data-act="uiset" data-view="discover" data-key="threshold" style="width:220px"><span class="muted small">' + multi.length + ' themes, ' + singles.length + ' single findings</span></div>' + PL.fig.themeBubbles(themes, p.findings) + '</div>' +
      '<div class="grid two">' + multi.map((t) => {
        const need = t.need ? p.needs.find((n) => n.id === t.need.id) : null;
        return '<div class="card"><div class="row between"><h3>' + esc(t.label) + '</h3><span class="pill grey">' + t.members.length + ' findings</span></div>' +
          '<ul class="small">' + t.members.map((id) => '<li><span class="mono">' + esc(id) + '</span> ' + esc((byId.get(id) || {}).text || '') + '</li>').join('') + '</ul>' +
          (need ? '<div class="okbox">Matches need <b>' + esc(need.id) + '</b>: ' + esc(need.statement) + ' <span class="muted">(similarity ' + fix(t.need.score) + ')</span></div>'
            : '<div class="warnbox">No need covers this theme yet — a possible new opportunity.</div>') +
          '<button class="btn small" data-act="theme-need" data-members="' + esc(t.members.join(',')) + '" data-label="' + esc(t.label) + '">Create need from theme</button></div>';
      }).join('') + '</div>' +
      (singles.length ? '<details class="card"><summary>' + singles.length + ' findings did not group with others</summary><ul class="small">' + singles.map((t) => '<li><span class="mono">' + esc(t.members[0]) + '</span> ' + esc((byId.get(t.members[0]) || {}).text || '') + '</li>').join('') + '</ul></details>' : '');
  }

  function personasTab(ctx) {
    const p = ctx.project;
    return '<div class="row between" style="margin-bottom:12px"><p class="muted small" style="margin:0">Personas built from evidence are proto-personas: assumptions to validate with real users. Pain points cite the evidence they rest on.</p><button class="btn primary" data-act="add-persona">+ Add persona</button></div>' +
      '<div class="grid two">' + p.personas.map((ps) => '<div class="card persona-card"><div class="row between">' + C.avatar(ps.name) + '<input class="wide" style="font-weight:700;font-size:1.05rem" data-act="set" data-path="personas.' + esc(ps.id) + '.name" value="' + esc(ps.name) + '" aria-label="Persona name"><button class="icon-btn" data-act="del" data-path="personas.' + esc(ps.id) + '" data-confirm="Delete persona?" aria-label="Delete persona">✕</button></div>' +
        '<input class="wide muted" style="margin-top:6px" data-act="set" data-path="personas.' + esc(ps.id) + '.role" value="' + esc(ps.role || '') + '" aria-label="Role">' +
        (ps.note ? '<div class="muted small" style="margin-top:4px">' + esc(ps.note) + '</div>' : '') +
        '<div class="field" style="margin-top:10px"><label>Goals (comma separated)</label><input class="wide" data-act="set" data-type="list" data-path="personas.' + esc(ps.id) + '.goals" value="' + esc((ps.goals || []).join(', ')) + '"></div>' +
        '<label>Pain points</label>' + (ps.pains || []).map((pain, i) => '<div class="claim"><div class="row"><textarea rows="2" style="flex:1" data-act="set" data-path="personas.' + esc(ps.id) + '.pains.' + i + '.text">' + esc(pain.text) + '</textarea><button class="icon-btn" data-act="del-pain" data-persona="' + esc(ps.id) + '" data-i="' + i + '" aria-label="Remove pain point">✕</button></div>' +
          C.citeEditor(ctx, 'personas.' + ps.id + '.pains.' + i + '.evidence', pain.evidence, pain.text) + '</div>').join('') +
        '<button class="btn small" data-act="add-pain" data-persona="' + esc(ps.id) + '">+ Pain point</button></div>').join('') + '</div>' +
      (p.personas.length ? '' : C.empty('No personas yet.'));
  }

  PL.views.discover = {
    render(ctx) {
      const u = ctx.ui('discover');
      const tab = u.tab || 'needs';
      const p = ctx.project;
      return C.tabs('discover', tab, [
        { id: 'needs', label: 'Needs', count: p.needs.length },
        { id: 'themes', label: 'Opportunity miner' },
        { id: 'personas', label: 'Personas', count: p.personas.length }
      ]) + (tab === 'themes' ? themesTab(ctx, u) : tab === 'personas' ? personasTab(ctx) : needsTab(ctx));
    },
    actions: {
      async 'add-need'(el, e, ctx) {
        const v = await formModal('Add need', [
          { name: 'statement', label: 'Need statement', type: 'textarea', required: true, help: 'Who needs what, and why. e.g. "Women with symptoms need a faster path to diagnosis."' },
          { name: 'severity', label: 'Severity', type: 'select', value: 3, options: [5, 4, 3, 2, 1] },
          { name: 'evidence', label: 'Evidence IDs (optional)', help: 'e.g. E7, E8 — suggestions appear after saving' }
        ]);
        if (!v || !v.statement) return;
        ctx.commit((p) => p.needs.push({ id: nextId(p.needs, 'N'), statement: v.statement, severity: Number(v.severity), evidence: PL.ui.parseIds(v.evidence) }));
      },
      'theme-need'(el, e, ctx) {
        const members = el.dataset.members.split(',');
        ctx.commit((p) => p.needs.push({ id: nextId(p.needs, 'N'), statement: 'Users need better support with ' + el.dataset.label.replace(/ · /g, ', ') + '. (Edit this statement.)', severity: 3, evidence: members.slice(0, 6) }));
        ctx.ui('discover').tab = 'needs'; ctx.render();
        toast('Need created — rewrite the statement in plain language', 'ok');
      },
      async 'add-persona'(el, e, ctx) {
        const v = await formModal('Add persona', [{ name: 'name', label: 'Name or label', required: true }, { name: 'role', label: 'Role / description' }]);
        if (!v || !v.name) return;
        ctx.commit((p) => p.personas.push({ id: nextId(p.personas, 'P'), name: v.name, role: v.role, note: 'proto-persona', goals: [], pains: [] }));
      },
      'add-pain'(el, e, ctx) { ctx.commit((p) => p.personas.find((x) => x.id === el.dataset.persona).pains.push({ text: 'New pain point', evidence: [] })); },
      'del-pain'(el, e, ctx) { ctx.commit((p) => p.personas.find((x) => x.id === el.dataset.persona).pains.splice(Number(el.dataset.i), 1)); }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
