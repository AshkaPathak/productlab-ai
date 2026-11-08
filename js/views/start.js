/* ProductLab AI - Start from a problem (autopilot wizard) */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct, toast } = PL.ui;
  const C = PL.comp;
  const A = PL.autopilot;
  const S = PL.store;

  const EXAMPLES = [
    'People save posts, reels and videos on Instagram, YouTube and X but can never find them again, and the pile of saved content keeps growing.',
    'College students struggle to manage stress and sleep during exam season and do not use the counselling services available on campus.',
    'Small farmers in India lose a large share of perishable produce after harvest because they lack cold storage and timely market prices.'
  ];

  // run state lives in memory only (one run at a time)
  const run = { running: false, problem: '', steps: {}, log: [], projectId: null, error: '' };

  function aiSettings(state) { return Object.assign({}, state.settings.ai, { apiKey: state.apiKey }); }

  const ICON = { pending: '○', running: '<span class="spin dark"></span>', done: '✔', warn: '⚠', failed: '✖', skipped: '–' };

  function progress() {
    return '<div class="card"><h2>' + (run.running ? 'Working on it…' : 'Finished') + '</h2><p class="muted small">' + esc(run.problem) + '</p><ol class="pipeline">' +
      A.STEPS.map((s) => {
        const st = run.steps[s.id] || { status: 'pending', detail: '' };
        return '<li class="pipe ' + st.status + '"><span class="pipe-icon">' + ICON[st.status] + '</span><div><b>' + esc(s.label) + '</b>' + (st.detail ? '<div class="muted small">' + esc(st.detail) + '</div>' : '') + '</div></li>';
      }).join('') + '</ol>' +
      (run.log.length ? '<details><summary>Research log</summary><ul class="small">' + run.log.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul></details>' : '') +
      (run.error ? '<div class="warnbox">' + esc(run.error) + '</div>' : '') + '</div>';
  }

  function results(ctx) {
    const p = ctx.state.projects.find((x) => x.id === run.projectId);
    if (!p) return '';
    const idx = PL.evidence.buildIndex(p, ctx.state.settings.guard);
    const audit = PL.evidence.audit(p, idx);
    const ranked = p.concepts.length && Object.keys(p.ratings).length ? PL.decision.wdm(p.concepts, p.criteria, p.ratings) : [];
    const sel = p.concepts.find((c) => c.id === p.selectedConcept);
    const stack = p.features.length ? PL.planning.recommendStack(p.constraints) : [];
    const sched = p.features.length ? PL.planning.schedule(p) : null;
    const pick = (layer) => (stack.find((r) => r.layer === layer) || {}).choice;
    return '<div class="stats">' + C.stat('Evidence', p.findings.length, p.references.length + ' real sources') + C.stat('Users & needs', p.personas.length + ' / ' + p.needs.length, 'personas / needs') +
      C.stat('Concepts', p.concepts.length) + C.stat('Traceability', pct(audit.summary.traceability), audit.summary.invalid ? audit.summary.invalid + ' invented citation(s) caught' : 'claims backed by evidence') + '</div>' +
      '<div class="grid two">' +
      (p.personas.length ? '<div class="card"><h2>Potential users</h2>' + p.personas.map((x) => '<div class="claim"><b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.role) + '</span><ul class="small">' + (x.pains || []).map((pn) => '<li>' + esc(pn.text) + ' <span class="mono muted">' + esc((pn.evidence || []).join(', ')) + '</span></li>').join('') + '</ul></div>').join('') + '<a href="#/discover" data-act="jump" data-view="discover" data-tab="personas">All personas & needs →</a></div>' : '') +
      (ranked.length ? '<div class="card"><h2>Weighted decision matrix</h2><p class="muted small">Scores are AI suggestions with reasons. <b>You decide</b>: adjust ratings or weights, then select the concept to build.</p>' +
        C.stackedBars(ranked.map((r) => ({ label: r.name, total: r.total, highlight: r.rank === 1, segments: r.breakdown.map((b, i) => ({ value: b.contribution, label: p.criteria[i].name })) })), p.criteria.map((c) => c.name), { max: 5 }) +
        '<a href="#/evaluate" data-act="jump" data-view="evaluate" data-tab="matrix">Review scores and choose →</a></div>' : '') + '</div>' +
      (sel && stack.length ? '<div class="card"><h2>Requirements to build ' + esc(sel.name) + '</h2><div class="table-wrap"><table><tbody>' +
        [['Languages', pick('Languages')], ['App framework', pick('Client') || pick('Web')], ['Backend', pick('Backend')], ['Database', pick('Database') || (/(Supabase)/.test(pick('Backend') || '') ? 'PostgreSQL (via Supabase)' : '')], ['Intelligence', pick('Intelligence')], ['Privacy & security', pick('Privacy & security')], ['Integrations', pick('Integrations')]]
          .filter((r) => r[1]).map((r) => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') +
        (sched ? '<tr><th>MVP</th><td>' + sched.phases[0].tasks.length + ' must-have features, about ' + Math.ceil(sched.mvpWeeks) + ' weeks for a team of ' + sched.settings.teamSize + '</td></tr>' : '') +
        '</tbody></table></div><p class="muted small">Selected another concept? Open Build plan and use <b>Re-plan for selected concept</b>.</p><a href="#/build" data-act="jump" data-view="build" data-tab="stack">Full tech stack, features and roadmap →</a></div>' : '') +
      '<div class="row"><button class="btn primary" data-act="go" data-to="overview">Open the full project</button><button class="btn" data-act="go" data-to="report">Traceability audit & report</button><button class="btn ghost" data-act="again">Start another problem</button></div>';
  }

  PL.views.start = {
    render(ctx) {
      const s = ctx.state.settings.ai;
      const ai = A.hasModel(aiSettings(ctx.state));
      const canWeb = ai && s.provider === 'gemini';
      const u = ctx.ui('start');
      if (run.running || run.projectId) return progress() + (run.running ? '' : results(ctx));
      return '<section class="hero"><h1>Start from a problem</h1><p>Describe a problem in a sentence or two. ProductLab searches real research papers' + (canWeb ? ' and the web' : '') +
        ', then drafts the potential users and their needs, product concepts, a weighted decision matrix for you to choose from, and the requirements to build the chosen idea — with every claim linked to a source.</p></section>' +
        '<div class="card"><label for="problem">Problem statement</label><textarea id="problem" rows="4" data-focus="problem" placeholder="e.g. ' + esc(EXAMPLES[0]) + '">' + esc(u.problem || '') + '</textarea>' +
        '<div class="row small" style="margin:8px 0"><span class="muted">Examples:</span>' + EXAMPLES.map((x, i) => '<button class="chip add" data-act="example" data-i="' + i + '">' + esc(x.split(' ').slice(0, 6).join(' ')) + '…</button>').join('') + '</div>' +
        '<div class="row small" style="margin-top:10px"><label class="check"><input type="checkbox" id="opt-web"' + (canWeb && u.web !== false ? ' checked' : '') + (canWeb ? '' : ' disabled') + '> Also search the web (Gemini with Google Search)</label>' +
        '<label for="opt-papers">Papers per search</label><select id="opt-papers">' + [5, 8, 12].map((n) => '<option' + (Number(u.papers || 8) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
        (ai ? '<div class="okbox">AI model connected: <b>' + esc(s.model) + '</b>. A full run makes about 7 model requests and 3–4 paper searches.</div>'
          : '<div class="warnbox">No AI model connected. Autopilot will still search real papers and group the evidence into themes, but users, concepts, scores and requirements need a model. <a href="#/settings">Connect a free Gemini key</a> (about one minute).</div>') +
        '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="run">Run autopilot</button><span class="muted small">Takes about 1–2 minutes.</span></div></div>' +
        '<div class="card"><h2>How it stays honest</h2><ul class="small"><li><b>Evidence comes from real sources only:</b> sentences quoted from paper abstracts on OpenAlex, and web facts that Google Search grounding links to a page.</li>' +
        '<li><b>Everything the AI writes must cite evidence IDs.</b> The citation guard checks each claim and flags invented or unsupported citations.</li>' +
        '<li><b>You stay the decision-maker:</b> ratings are suggestions with reasons; change them and the ranking, sensitivity analysis and build plan update.</li></ul></div>';
    },
    actions: {
      example(el, e, ctx) { ctx.ui('start').problem = EXAMPLES[Number(el.dataset.i)]; S.save(); ctx.render(); },
      again(el, e, ctx) { run.projectId = null; run.steps = {}; run.log = []; run.error = ''; ctx.render(); },
      jump(el, e, ctx) { ctx.state.currentId = run.projectId; ctx.ui(el.dataset.view).tab = el.dataset.tab; S.save(); ctx.go(el.dataset.view); },
      async run(el, e, ctx) {
        const problem = document.getElementById('problem').value.trim();
        if (problem.split(/\s+/).length < 6) { toast('Describe the problem in at least one full sentence', 'bad'); return; }
        const u = ctx.ui('start');
        u.problem = problem; u.web = document.getElementById('opt-web').checked; u.papers = Number(document.getElementById('opt-papers').value);
        S.save();
        Object.assign(run, { running: true, problem, steps: {}, log: [], projectId: null, error: '' });
        ctx.render();
        try {
          const project = await A.run(problem, aiSettings(ctx.state), {
            web: u.web, papersPerQuery: u.papers, openAlexKey: ctx.state.settings.openAlexKey || '',
            onStep: (id, status, detail) => { run.steps[id] = { status, detail }; PL.app.render(); },
            onLog: (m) => { run.log.push(m); }
          });
          const added = S.addProject(Object.assign(S.blankProject(), project, { id: S.blankProject().id, team: [] }));
          run.projectId = added.id;
          toast('Project created: ' + added.name, 'ok');
        } catch (err) {
          run.error = err.message + (/Failed to fetch|NetworkError/.test(err.message) ? ' — the browser could not reach the service. Check your internet connection.' : '');
        }
        run.running = false;
        PL.app.render();
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
