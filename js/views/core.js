/* ProductLab AI - Projects, Overview and Settings views */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, pct, fix, formModal, confirmModal, download, readFile, slug, toast, clone } = PL.ui;
  const C = PL.comp;
  const S = PL.store;

  /* ---------------- Projects ---------------- */

  PL.views.projects = {
    render(ctx) {
      const list = ctx.state.projects.map((p) => {
        const cur = p.id === ctx.state.currentId;
        return '<div class="card' + (cur ? ' concept-card selected' : '') + '">' +
          '<div class="row between"><div><div class="muted small">' + esc(p.domain || 'Project') + '</div><h2>' + esc(p.name) + '</h2></div>' + (cur ? '<span class="pill">Open</span>' : '') + '</div>' +
          '<p class="muted small">' + esc((p.challenge || '').slice(0, 220)) + (p.challenge && p.challenge.length > 220 ? '…' : '') + '</p>' +
          '<div class="row small muted">' + p.findings.length + ' evidence · ' + p.needs.length + ' needs · ' + p.concepts.length + ' concepts · ' + p.features.length + ' features · updated ' + esc(String(p.updatedAt || '').slice(0, 10)) + '</div>' +
          '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="open" data-id="' + esc(p.id) + '">Open</button>' +
          '<button class="btn" data-act="dup" data-id="' + esc(p.id) + '">Duplicate</button>' +
          '<button class="btn" data-act="export" data-id="' + esc(p.id) + '">Export JSON</button>' +
          '<span class="spacer"></span><button class="btn ghost danger" data-act="remove" data-id="' + esc(p.id) + '">Delete</button></div></div>';
      }).join('');
      return '<section class="hero"><h1>ProductLab AI</h1><p>Turn real evidence into a product strategy your team can defend. ' +
        'Collect findings with sources, mine user needs, generate concepts with Random Association and Morphological Analysis, choose with a weighted decision matrix and sensitivity analysis, then plan features and an MVP roadmap — with every claim checked against the evidence it cites.</p>' +
        '<div class="row"><button class="btn primary" data-act="new">New project</button><label class="btn ghost" for="import-project">Import project (.json)</label>' +
        '<input id="import-project" type="file" accept=".json,application/json" hidden data-act="import"><button class="btn ghost" data-act="samples">Restore sample case studies</button></div></section>' +
        (list || C.empty('No projects yet. Create one or restore the sample case studies.')) +
        '<p class="muted small">Projects are stored only in this browser. Export a project to share it with your team or to back it up; teammates can import the file.</p>';
    },
    actions: {
      open(el, e, ctx) { ctx.state.currentId = el.dataset.id; S.save(); ctx.go('overview'); },
      async new(el, e, ctx) {
        const v = await formModal('New project', [
          { name: 'name', label: 'Project name', required: true },
          { name: 'domain', label: 'Domain', help: 'e.g. Healthcare, Sustainability, Education' },
          { name: 'challenge', label: 'Challenge', type: 'textarea', help: 'The engineering or societal problem in one or two sentences.' },
          { name: 'hmw', label: 'How might we … ?', type: 'textarea' },
          { name: 'team', label: 'Team members (comma separated)' }
        ], { submit: 'Create' });
        if (!v || !v.name) return;
        S.addProject(S.blankProject({ name: v.name, domain: v.domain, challenge: v.challenge, hmw: v.hmw, team: v.team.split(',').map((x) => x.trim()).filter(Boolean) }));
        ctx.go('evidence');
      },
      dup(el, e, ctx) {
        const p = ctx.state.projects.find((x) => x.id === el.dataset.id);
        const c = clone(p); c.id = S.blankProject().id; c.name = p.name + ' (copy)';
        S.addProject(c); ctx.render(); toast('Duplicated', 'ok');
      },
      export(el, e, ctx) {
        const p = ctx.state.projects.find((x) => x.id === el.dataset.id);
        download(slug(p.name) + '.productlab.json', JSON.stringify(p, null, 2), 'application/json');
      },
      async remove(el, e, ctx) {
        const p = ctx.state.projects.find((x) => x.id === el.dataset.id);
        if (await confirmModal('Delete "' + p.name + '" from this browser? Export it first if you want to keep a copy.', 'Delete')) { S.removeProject(p.id); ctx.render(); }
      },
      async import(el, e, ctx) {
        const file = el.files && el.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await readFile(file));
          const list = Array.isArray(data.projects) ? data.projects : [data];
          list.forEach((p) => { if (!p || typeof p !== 'object' || !Array.isArray(p.findings || [])) throw new Error('Not a ProductLab project file'); S.addProject(p); });
          toast('Imported ' + list.length + ' project(s)', 'ok');
          ctx.go('overview');
        } catch (err) { toast('Import failed: ' + err.message, 'bad'); }
        el.value = '';
      },
      async samples(el, e, ctx) {
        if (await confirmModal('Restore the two sample case studies (PCOS/PMOS and campus food waste)? Your edits to those two sample projects will be replaced; other projects are untouched.', 'Restore')) { S.resetSamples(); ctx.render(); toast('Samples restored', 'ok'); }
      }
    }
  };

  /* ---------------- Overview ---------------- */

  function progress(p, audit) {
    const rated = p.concepts.length && p.concepts.every((c) => p.criteria.every((k) => p.ratings[c.id] && p.ratings[c.id][k.id] && p.ratings[c.id][k.id].value !== ''));
    return [
      { id: 'evidence', label: 'Collect evidence', done: Math.min(1, p.findings.length / 10), detail: p.findings.length + ' findings, ' + p.references.length + ' sources' },
      { id: 'discover', label: 'Identify needs', done: Math.min(1, p.needs.length / 4), detail: p.needs.length + ' needs, ' + p.personas.length + ' personas' },
      { id: 'ideate', label: 'Generate concepts', done: Math.min(1, p.concepts.length / 3), detail: p.concepts.length + ' concepts' },
      { id: 'evaluate', label: 'Evaluate & select', done: rated ? 1 : p.concepts.length ? 0.4 : 0, detail: rated ? 'All concepts rated' : 'Rate every concept' },
      { id: 'build', label: 'Plan the build', done: Math.min(1, p.features.length / 5), detail: p.features.length + ' features' },
      { id: 'report', label: 'Audit & report', done: audit.summary.total ? Math.min(1, audit.summary.traceability / 0.8) : 0, detail: 'Traceability ' + pct(audit.summary.traceability) }
    ];
  }

  function nextAction(steps) {
    const s = steps.find((x) => x.done < 1);
    return s ? s : null;
  }

  PL.views.overview = {
    render(ctx) {
      const p = ctx.project;
      const audit = PL.evidence.audit(p, ctx.index);
      const ranked = p.concepts.length ? PL.decision.wdm(p.concepts, p.criteria, p.ratings) : [];
      const sched = p.features.length ? PL.planning.schedule(p) : null;
      const steps = progress(p, audit);
      const next = nextAction(steps);
      const top = ranked[0];
      return (p.caveats ? '<div class="warnbox">' + esc(p.caveats) + '</div>' : '') +
        '<div class="stats">' +
        C.stat('Evidence findings', p.findings.length, p.references.length + ' sources') +
        C.stat('Validated needs', p.needs.length) +
        C.stat('Concepts', p.concepts.length) +
        C.stat('Traceability', pct(audit.summary.traceability), audit.summary.supported + ' supported of ' + audit.summary.total + ' claims') +
        C.stat('Top concept', top ? esc(top.name) : '–', top ? 'score ' + fix(top.total) + ' / 5' : '') +
        C.stat('MVP duration', sched ? Math.ceil(sched.mvpWeeks) + ' wks' : '–', sched ? sched.phases[0].tasks.length + ' Must features' : '') +
        '</div>' +
        (next ? '<div class="infobox">Next step: <a href="#/' + next.id + '">' + esc(next.label) + '</a> — ' + esc(next.detail) + '</div>' : '<div class="okbox">Every workflow step has content. Review the <a href="#/report">traceability audit</a> and export the report.</div>') +
        '<div class="steps" style="margin-bottom:16px">' + steps.map((s, i) => '<a class="step' + (s.done >= 1 ? ' done' : '') + '" href="#/' + s.id + '"><div class="row"><span class="num">' + (i + 1) + '</span><b>' + esc(s.label) + '</b></div><div class="muted small" style="margin-top:6px">' + esc(s.detail) + '</div><div class="progress"><span style="width:' + Math.round(s.done * 100) + '%"></span></div></a>').join('') + '</div>' +
        '<div class="grid two"><div class="card"><h2>Project brief</h2>' +
        '<div class="field"><label>Name</label><input class="wide" data-act="set" data-path="name" value="' + esc(p.name) + '"></div>' +
        '<div class="field"><label>Domain</label><input class="wide" data-act="set" data-path="domain" value="' + esc(p.domain) + '"></div>' +
        '<div class="field"><label>Challenge</label><textarea rows="3" data-act="set" data-path="challenge">' + esc(p.challenge) + '</textarea></div>' +
        '<div class="field"><label>How might we …</label><textarea rows="3" data-act="set" data-path="hmw">' + esc(p.hmw) + '</textarea></div>' +
        '<div class="field"><label>Team (comma separated)</label><input class="wide" data-act="set" data-type="list" data-path="team" value="' + esc((p.team || []).join(', ')) + '"></div></div>' +
        '<div class="card"><h2>Domain vocabulary</h2><p class="muted small">Words that mean the same thing in this domain. The evidence engine treats them as one term when matching claims to evidence (one group per line, comma separated).</p>' +
        '<textarea rows="12" class="mono" data-act="glossary" data-focus="glossary">' + esc((p.glossary || []).map((g) => g.join(', ')).join('\n')) + '</textarea>' +
        '<p class="muted small">Example: <span class="mono">diagnosis, diagnose, undiagnosed</span></p></div></div>';
    },
    actions: {
      glossary(el, e, ctx) {
        const groups = el.value.split('\n').map((l) => l.split(',').map((x) => x.trim()).filter(Boolean)).filter((g) => g.length > 1);
        ctx.commit((p) => { p.glossary = groups; });
        toast('Vocabulary updated (' + groups.length + ' groups)', 'ok');
      }
    }
  };

  /* ---------------- Settings ---------------- */

  PL.views.settings = {
    render(ctx) {
      const s = ctx.state.settings;
      const ai = s.ai;
      const presets = PL.llm.PRESETS;
      return '<div class="grid two"><div class="card"><h2>AI assistant (optional)</h2>' +
        '<p class="muted small">ProductLab AI works fully offline. Connect a language model only if you want AI-generated concepts. Generated claims are always checked by the citation guard before you can use them.</p>' +
        '<div class="field"><label for="ai-preset">Provider</label><select id="ai-preset" class="wide" data-act="preset">' + Object.keys(presets).map((k) => '<option value="' + k + '"' + (ai.preset === k ? ' selected' : '') + '>' + esc(presets[k].label) + '</option>').join('') + '<option value="custom"' + (ai.preset === 'custom' ? ' selected' : '') + '>Custom OpenAI-compatible endpoint</option></select></div>' +
        '<div class="field"><label for="ai-base">Base URL</label><input id="ai-base" class="wide mono" data-act="aiset" data-key="baseUrl" value="' + esc(ai.baseUrl) + '"></div>' +
        '<div class="field"><label for="ai-model">Model</label><input id="ai-model" class="wide mono" data-act="aiset" data-key="model" value="' + esc(ai.model) + '"><small class="help">Model names change often — check your provider’s current list.</small></div>' +
        '<div class="field"><label for="ai-key">API key</label><input id="ai-key" class="wide mono" type="password" autocomplete="off" data-act="aikey" value="' + esc(ctx.state.apiKey) + '" placeholder="' + (ai.provider === 'gemini' ? 'Get a free key at aistudio.google.com' : 'sk-…') + '"></div>' +
        '<label class="check"><input type="checkbox" data-act="remember"' + (ai.remember ? ' checked' : '') + '> Remember the key on this device (otherwise it is forgotten when the tab closes)</label>' +
        '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="test">Test connection</button><span class="muted small" id="ai-status"></span></div>' +
        '<p class="muted small" style="margin-top:10px">The key is sent only to the provider above, directly from your browser.</p></div>' +
        '<div class="card"><h2>Citation guard</h2><p class="muted small">Each claim is compared with the evidence it cites using TF-IDF cosine similarity. Above the <b>strong</b> threshold a claim counts as supported; between the thresholds it is partially supported; below, the citation is flagged as not supporting the claim.</p>' +
        '<div class="field"><label>Strong threshold: <b>' + fix(s.guard.strong) + '</b></label><input type="range" min="0.05" max="0.5" step="0.01" value="' + s.guard.strong + '" data-act="guard" data-key="strong"></div>' +
        '<div class="field"><label>Weak threshold: <b>' + fix(s.guard.weak) + '</b></label><input type="range" min="0.01" max="0.3" step="0.01" value="' + s.guard.weak + '" data-act="guard" data-key="weak"></div>' +
        '<button class="btn small" data-act="guard-reset">Reset to defaults (0.20 / 0.08)</button>' +
        '<h2 style="margin-top:22px">Data</h2><div class="row"><button class="btn" data-act="export-all">Export all projects</button><button class="btn danger" data-act="wipe">Clear all data in this browser</button></div>' +
        '<p class="muted small" style="margin-top:10px">All projects live in this browser’s local storage. Nothing is uploaded anywhere.</p></div></div>';
    },
    actions: {
      preset(el, e, ctx) {
        const k = el.value; const pr = PL.llm.PRESETS[k];
        const ai = ctx.state.settings.ai;
        ai.preset = k;
        if (pr) { ai.provider = pr.provider; ai.baseUrl = pr.baseUrl; ai.model = pr.model; } else { ai.provider = 'openai'; }
        S.save(); ctx.render();
      },
      aiset(el, e, ctx) { ctx.state.settings.ai[el.dataset.key] = el.value.trim(); S.save(); toast('Saved', 'ok'); },
      aikey(el, e, ctx) { S.setApiKey(el.value.trim(), ctx.state.settings.ai.remember); toast('Key stored for ' + (ctx.state.settings.ai.remember ? 'this device' : 'this session'), 'ok'); },
      remember(el, e, ctx) { ctx.state.settings.ai.remember = el.checked; S.setApiKey(ctx.state.apiKey, el.checked); S.save(); },
      async test(el, e, ctx) {
        const st = document.getElementById('ai-status');
        st.textContent = 'Contacting provider…';
        try {
          const reply = await PL.llm.chat(Object.assign({}, ctx.state.settings.ai, { apiKey: ctx.state.apiKey, temperature: 0 }), [{ role: 'user', content: 'Reply with the JSON {"ok":true} and nothing else.' }]);
          const j = PL.llm.extractJSON(reply);
          st.textContent = j && j.ok ? 'Connected ✓' : 'Connected, but the reply was unexpected: ' + reply.slice(0, 80);
        } catch (err) { st.textContent = 'Failed: ' + err.message + (/Failed to fetch|NetworkError/.test(err.message) ? ' (network or CORS blocked — check the base URL)' : ''); }
      },
      guard(el, e, ctx) { ctx.state.settings.guard[el.dataset.key] = Number(el.value); S.save(); ctx.render(); },
      'guard-reset'(el, e, ctx) { ctx.state.settings.guard = { strong: 0.2, weak: 0.08 }; S.save(); ctx.render(); },
      'export-all'(el, e, ctx) { download('productlab-projects.json', JSON.stringify({ projects: ctx.state.projects }, null, 2), 'application/json'); },
      async wipe(el, e, ctx) {
        if (!(await confirmModal('Delete every project and setting stored in this browser? This cannot be undone.', 'Delete everything'))) return;
        try { localStorage.removeItem('productlab-ai:v1'); } catch (err) { /* ignore */ }
        S.setApiKey('', false);
        location.hash = '#/projects';
        location.reload();
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
