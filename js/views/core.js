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
        let st = [];
        try { st = C.stepProgress(p).map((x) => ({ label: '', kind: x.kind, state: x.done > 0 ? 'done' : 'pending', fill: x.done })); } catch (e) { st = []; }
        return '<article class="project-row' + (cur ? ' current' : '') + '"><div><div class="muted small">' + esc(p.domain || 'Project') + ', updated ' + esc(String(p.updatedAt || '').slice(0, 10)) + '</div><h2>' + esc(p.name) + '</h2>' +
          '<p class="muted">' + esc((p.challenge || '').slice(0, 220)) + (p.challenge && p.challenge.length > 220 ? '\u2026' : '') + '</p>' +
          '<div class="row"><button class="btn primary" data-act="open" data-id="' + esc(p.id) + '">Open</button>' +
          '<button class="btn ghost" data-act="dup" data-id="' + esc(p.id) + '">Duplicate</button>' +
          '<button class="btn ghost" data-act="export" data-id="' + esc(p.id) + '">Export</button>' +
          '<button class="btn ghost danger" data-act="remove" data-id="' + esc(p.id) + '">Delete</button></div></div>' +
          (st.length ? C.press(st, { r: 26, gap: 62, label: p.name + ' progress' }) : '') + '</article>';
      }).join('');
      return '<section class="hero">' + C.heroArt() + '<h1>Your product labs</h1><p>Each project keeps its evidence, people, ideas, decision and build plan together. Start from a problem statement and ProductLab drafts the rest, or build a project by hand.</p>' +
        '<div class="row"><button class="btn accent" data-act="go" data-to="start">Start from a problem</button><button class="btn ghost" data-act="new">Blank project</button><label class="btn ghost" for="import-project">Import a project file</label>' +
        '<input id="import-project" type="file" accept=".json,application/json" hidden data-act="import"><button class="btn ghost" data-act="samples">Restore the sample projects</button></div></section>' +
        (list || C.empty('No projects yet. Start from a problem statement or restore the samples.')) +
        '<p class="muted small" style="margin-top:18px">Projects are stored in this browser. Export one to back it up or share it; teammates can import the file.</p>';
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
          let data;
          try { data = JSON.parse(await readFile(file)); } catch (err) { throw new Error('the file is damaged or is not a ProductLab export'); }
          const list = data && Array.isArray(data.projects) ? data.projects : [data];
          const real = (p) => p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.findings || []) && Array.isArray(p.concepts || []) &&
            !!(String(p.name || '').trim() || (p.findings || []).length || (p.concepts || []).length || String(p.challenge || '').trim());
          if (!list.length || !list.every(real)) throw new Error('this file does not contain a ProductLab project');
          list.forEach((p) => {
            const copy = Object.assign({}, p);
            if (ctx.state.projects.some((x) => x.name === copy.name)) copy.name = (copy.name || 'Project') + ' (imported copy)';
            S.addProject(copy);
          });
          toast('Imported ' + list.length + ' project' + (list.length > 1 ? 's' : ''), 'ok');
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

  const NEXT_LABEL = { evidence: 'Collect evidence', discover: 'Identify people and needs', ideate: 'Generate ideas', evaluate: 'Score and choose an idea', build: 'Plan the build', report: 'Fix flagged claims' };
  function nextAction(steps) {
    const s = steps.find((x) => x.done < 1);
    return s ? Object.assign({}, s, { label: NEXT_LABEL[s.id] }) : null;
  }

  PL.views.overview = {
    render(ctx) {
      const p = ctx.project;
      const audit = PL.evidence.audit(p, ctx.index);
      const ranked = p.concepts.length ? PL.decision.wdm(p.concepts, p.criteria, p.ratings) : [];
      const sched = p.features.length ? PL.planning.schedule(p) : null;
      const steps = C.stepProgress(p, audit);
      const next = nextAction(steps);
      const top = ranked[0];
      const stagesP = C.stepProgress(p, audit).map((x) => ({ label: x.label, kind: x.kind, state: x.done > 0 ? 'done' : 'pending', fill: x.done, big: x.big, sub: x.sub, href: '#/' + x.id, current: next && next.id === x.id }));
      const researchOnly = /^Research-only run/.test(p.caveats || '');
      return (p.caveats ? '<div class="warnbox">' + esc(p.caveats) + (researchOnly ? ' <a href="#/settings">Add a free Gemini key</a>, then run it again from <a href="#/start">Home</a>: your problem is still in the box.' : '') + '</div>' : '') +
        (next ? '<div class="next"><span>Next</span><b>' + esc(next.label) + '</b><span class="muted small">' + esc(next.detail) + '</span><a class="btn primary" href="#/' + next.id + '">Continue</a></div>'
          : '<div class="next"><b>Every step has content.</b><span class="muted small">Check the audit, then export the report.</span><a class="btn primary" href="#/report">Open the audit</a></div>') +
        '<div class="press-wrap">' + C.press(stagesP, { label: 'Project progress' }) + '</div>' +
        (top ? '<p class="lead">Leading idea: <b>' + esc(top.name) + '</b>, scoring ' + fix(top.total) + ' out of 5' + (sched ? '. Its first release takes about ' + Math.ceil(sched.mvpWeeks) + ' weeks.' : '.') + '</p>' : '') +
        '<a class="more" href="#/story">Scroll through the whole project as a story</a>' +
        '<div class="grid two"><div class="card"><h2>Project brief</h2>' +
        '<div class="field"><label>Name</label><input class="wide" data-act="set" data-path="name" value="' + esc(p.name) + '"></div>' +
        '<div class="field"><label>Domain</label><input class="wide" data-act="set" data-path="domain" value="' + esc(p.domain) + '"></div>' +
        '<div class="field"><label for="story-theme">Story theme</label><select id="story-theme" class="wide" data-act="set" data-path="theme">' +
          '<option value="auto"' + (!p.theme || p.theme === 'auto' ? ' selected' : '') + '>Match the project automatically (now: ' + esc(PL.theme.THEMES[PL.theme.pick(Object.assign({}, p, { theme: 'auto' }))].label) + ')</option>' +
          PL.theme.LIST.map((t) => '<option value="' + t.id + '"' + (p.theme === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '</select>' +
          '<span class="help">Colours for this project\u2019s Story page. The rest of the app keeps the ProductLab colours.</span></div>' +
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

  /* Settings for people who bring their own key (or a local model). */
  function ownKey(ctx, ai) {
    return (ai.provider === 'gemini' ? '<details class="keyguide"' + (ctx.state.apiKey ? '' : ' open') + '><summary>Get a free Gemini key (about two minutes)</summary><ol>' +
      '<li>Open <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio, API keys</a> and sign in with a Google account.</li>' +
      '<li>Choose <b>Create API key</b>. No card is needed for the free tier.</li>' +
      '<li>Copy the key (it starts with <span class="mono">AQ.</span> or <span class="mono">AIza</span>), paste it below and press <b>Test connection</b>.</li></ol>' +
      '<p class="muted small">Free keys have daily and per-minute limits, which Google shows in AI Studio; ProductLab waits and retries when asked to slow down. On the free tier Google may use what you send to improve its products, so avoid confidential details. Searching the web (Google Search grounding) needs a paid Gemini project.</p></details>' : '') +
      '<div class="field"><label for="ai-base">Base URL</label><input id="ai-base" class="wide mono" data-act="aiset" data-key="baseUrl" value="' + esc(ai.baseUrl) + '"></div>' +
      '<div class="field"><label for="ai-model">Model</label><input id="ai-model" class="wide mono" list="ai-models" data-act="aiset" data-key="model" value="' + esc(ai.model) + '">' +
      (ai.provider === 'gemini' ? '<datalist id="ai-models">' + PL.llm.GEMINI_MODELS.map((m) => '<option value="' + m.id + '">' + esc(m.note) + '</option>').join('') + '</datalist>' +
        '<small class="help">' + PL.llm.GEMINI_MODELS.map((m) => '<span class="mono">' + m.id + '</span>: ' + esc(m.note)).join('<br>') + '</small>' : '<small class="help">Model names change often, so check your provider\u2019s current list.</small>') + '</div>' +
      '<div class="field"><label for="ai-key">API key</label><input id="ai-key" class="wide mono" type="password" autocomplete="off" data-act="aikey" value="' + esc(ctx.state.apiKey) + '" placeholder="' + (ai.provider === 'gemini' ? 'Get a free key at aistudio.google.com' : 'sk-\u2026') + '"></div>' +
      '<label class="check"><input type="checkbox" data-act="remember"' + (ai.remember ? ' checked' : '') + '> Remember the key on this device (otherwise it is forgotten when the tab closes)</label>' +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="test">Test connection</button><span class="muted small" id="ai-status"></span></div>' +
      '<p class="muted small" style="margin-top:10px">The key stays in this browser and is sent only to the provider above. It is never saved in the project, the exported files or the code repository.</p>';
  }

  PL.views.settings = {
    render(ctx) {
      const s = ctx.state.settings;
      const ai = s.ai;
      const presets = PL.llm.PRESETS;
      const shared = ai.preset === 'shared';
      const keys = Object.keys(presets).filter((k) => k !== 'shared' || presets.shared.baseUrl);
      return '<div class="grid two"><div class="card"><h2>AI assistant</h2>' +
        (presets.shared.baseUrl
          ? '<p class="muted small">ProductLab\u2019s shared AI works without any setup. If you use ProductLab a lot, or the shared AI reaches its daily limit, you can add your own free Gemini key instead. Every claim the AI writes is checked by the citation guard.</p>'
          : '<p class="muted small">Without a model, ProductLab still finds research papers and groups them into themes. Connect one to get people, ideas, scores and a build plan. Every claim the model writes is checked by the citation guard.</p>') +
        '<div class="field"><label for="ai-preset">Provider</label><select id="ai-preset" class="wide" data-act="preset">' + keys.map((k) => '<option value="' + k + '"' + (ai.preset === k ? ' selected' : '') + '>' + esc(presets[k].label) + '</option>').join('') + '<option value="custom"' + (ai.preset === 'custom' ? ' selected' : '') + '>Custom OpenAI-compatible endpoint</option></select></div>' +
        (shared
          ? '<div class="infobox"><b>Nothing to set up.</b> ProductLab\u2019s shared AI uses ' + esc(ai.model) + ' through the team\u2019s own connection, so you do not need a key. It has a daily limit shared by everyone. Google may use what you send to improve its products, so avoid confidential details.</div>' +
            '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="test">Test connection</button><span class="muted small" id="ai-status"></span></div>'
          : ownKey(ctx, ai)) +
        '<h2 style="margin-top:22px">Paper search (OpenAlex)</h2><p class="muted small">Autopilot searches the free OpenAlex index of research papers. Without a key it allows about 100 searches a day; a free key from openalex.org raises that.</p>' +
        '<div class="field"><label for="oa-key">OpenAlex API key (optional)</label><input id="oa-key" class="wide mono" type="password" autocomplete="off" data-act="oakey" value="' + esc(ctx.state.settings.openAlexKey || '') + '"></div></div>' +
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
      oakey(el, e, ctx) { ctx.state.settings.openAlexKey = el.value.trim(); S.save(); toast('Saved', 'ok'); },
      aikey(el, e, ctx) { S.setApiKey(el.value.trim(), ctx.state.settings.ai.remember); toast('Key stored for ' + (ctx.state.settings.ai.remember ? 'this device' : 'this session'), 'ok'); },
      remember(el, e, ctx) { ctx.state.settings.ai.remember = el.checked; S.setApiKey(ctx.state.apiKey, el.checked); S.save(); },
      async test(el, e, ctx) {
        const st = document.getElementById('ai-status');
        st.textContent = 'Contacting provider…';
        let busy = '';
        let used = ctx.state.settings.ai.model;
        const hooks = {
          onWait: (sec) => { st.textContent = 'The provider is busy; trying again in ' + Math.round(sec) + ' seconds…'; },
          onFallback: (from, to) => { busy = from; st.textContent = from + ' is busy right now; trying ' + to + '…'; },
          onModel: (m) => { used = m; }
        };
        try {
          const reply = await PL.llm.chat(Object.assign({}, ctx.state.settings.ai, { apiKey: ctx.state.apiKey, temperature: 0 }, hooks), [{ role: 'user', content: 'Reply with the JSON {"ok":true} and nothing else.' }]);
          const j = PL.llm.extractJSON(reply);
          st.textContent = !(j && j.ok) ? 'Connected, but the reply was unexpected: ' + reply.slice(0, 80)
            : busy ? 'Connected ✓ The key works. ' + busy + ' is busy at Google right now, so ProductLab will use ' + used + ' until it frees up.'
              : 'Connected ✓ (' + used + ')';
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
