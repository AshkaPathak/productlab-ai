/* ProductLab AI - Start from a problem (autopilot) */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, pct, toast } = PL.ui;
  const C = PL.comp;
  const A = PL.autopilot;
  const S = PL.store;

  const EXAMPLES = [
    { short: 'Saved posts I never find again', text: 'People save posts, reels and videos on Instagram, YouTube and X but can never find them again, and the pile of saved content keeps growing.' },
    { short: 'Exam stress on campus', text: 'College students struggle to manage stress and sleep during exam season and do not use the counselling services available on campus.' },
    { short: 'Produce lost after harvest', text: 'Small farmers in India lose a large share of perishable produce after harvest because they lack cold storage and timely market prices.' }
  ];

  // What each stage produces, in the user's words
  const OUTPUT = {
    plan: 'a sharper problem',
    research: 'real papers and pages',
    users: 'who it affects',
    ideas: 'product ideas',
    evaluate: 'a matrix you decide on',
    build: 'what it takes to build'
  };
  const LABEL = { plan: 'Understand', research: 'Research', users: 'People', ideas: 'Ideas', evaluate: 'Decide', build: 'Build' };

  const run = { running: false, problem: '', steps: {}, log: [], projectId: null, error: '', entered: false };

  function aiSettings(state) { return Object.assign({}, state.settings.ai, { apiKey: state.apiKey }); }

  function stages(withCounts, project) {
    const counts = {};
    if (project) {
      const ranked = project.concepts.length && Object.keys(project.ratings).length ? PL.decision.wdm(project.concepts, project.criteria, project.ratings) : [];
      counts.research = { big: project.findings.length, sub: project.references.length + ' sources' };
      counts.users = { big: project.needs.length, sub: project.needs.length === 1 ? 'need' : 'needs' + (project.personas.length ? ', ' + project.personas.length + (project.personas.length === 1 ? ' persona' : ' personas') : '') };
      counts.ideas = { big: project.concepts.length, sub: 'concepts' };
      counts.evaluate = ranked.length ? { big: ranked[0].total.toFixed(1), sub: ranked[0].name } : null;
      counts.build = { big: project.features.length, sub: 'features' };
      counts.plan = { big: '✓', sub: 'problem refined' };
    }
    return A.STEPS.map((s) => {
      const st = run.steps[s.id] || { status: 'pending' };
      const c = withCounts && counts[s.id];
      return {
        label: LABEL[s.id], state: st.status === 'warn' ? 'done' : st.status, fill: st.status === 'warn' ? 0.6 : 1,
        big: c && st.status !== 'skipped' ? c.big : null, sub: st.status === 'skipped' ? 'needs an AI key' : c ? c.sub : OUTPUT[s.id],
        justDone: st.doneAt && Date.now() - st.doneAt < 1200
      };
    });
  }

  function idle(ctx) {
    const s = ctx.state.settings.ai;
    const ai = A.hasModel(aiSettings(ctx.state));
    const canWeb = ai && s.provider === 'gemini';
    const u = ctx.ui('start');
    const preview = A.STEPS.map((x) => ({ label: LABEL[x.id], state: 'pending', sub: OUTPUT[x.id] }));
    return '<section class="start">' +
      '<h1 class="ask">What problem are you trying to solve?</h1>' +
      '<p class="ask-sub">Describe it in a sentence or two. ProductLab reads real research, then drafts who the problem affects, ideas to solve it, a decision matrix for you to choose from, and what it would take to build your pick.</p>' +
      '<div class="composer"><label for="problem" class="sr-only">Problem statement</label><textarea id="problem" rows="3" data-focus="problem" placeholder="e.g. ' + esc(EXAMPLES[0].text) + '">' + esc(u.problem || '') + '</textarea>' +
      '<div class="row">' + EXAMPLES.map((x, i) => '<button class="example" data-act="example" data-i="' + i + '">' + esc(x.short) + '</button>').join('') + '</div></div>' +
      '<div class="row start-actions"><button class="btn accent big" data-act="run">Find users, ideas and a plan</button>' +
      '<label class="check small"><input type="checkbox" id="opt-web"' + (canWeb && u.web !== false ? ' checked' : '') + (canWeb ? '' : ' disabled') + '> Search the web too</label>' +
      '<label class="small" for="opt-papers">Papers per search</label><select id="opt-papers">' + [5, 8, 12].map((n) => '<option' + (Number(u.papers || 8) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      (ai ? '<p class="muted small">Using ' + esc(s.model) + '. A run takes 1 to 2 minutes.</p>'
        : '<div class="warnbox">Without an AI model, ProductLab only gathers research and groups it into themes. <a href="#/settings">Add a free Gemini key</a> to get users, ideas, scores and a build plan.</div>') +
      '<div class="press-wrap">' + C.press(preview, { label: 'What you will get' }) + '</div>' +
      '<div class="notes">' +
      '<div class="note"><h3>' + mini('ink') + 'Facts come from sources</h3><p>Findings are quoted from research papers on OpenAlex, or from web pages Google Search links to. Nothing is written from the model’s memory.</p></div>' +
      '<div class="note"><h3>' + mini('apricot') + 'Every claim cites its evidence</h3><p>The citation check compares each claim with the finding it cites and flags anything made up.</p></div>' +
      '<div class="note"><h3>' + mini('cyan') + 'You make the call</h3><p>Scores are suggestions with reasons. Change any of them and the ranking, risks and build plan follow.</p></div>' +
      '</div></section>';
  }

  function mini(kind) {
    return '<svg viewBox="0 0 22 22" aria-hidden="true">' + C.orb(11, 11, 10, kind === 'ink' ? 'plum' : kind) + '</svg>';
  }

  function working() {
    return '<section class="start"><h1 class="ask small-ask">' + (run.running ? 'Working on it' : run.error ? 'Something stopped the run' : 'Here is your starting point') + '</h1>' +
      '<blockquote class="problem-quote">' + esc(run.problem) + '</blockquote>' +
      '<div class="press-wrap">' + C.press(stages(!run.running, run.projectId ? S.state.projects.find((p) => p.id === run.projectId) : null), { label: 'Progress', enter: !run.entered }) + '</div>' +
      (run.running ? '<div class="runlog">' + A.STEPS.map((s) => {
        const st = run.steps[s.id] || { status: 'pending', detail: '' };
        return '<div class="' + st.status + '"><b><i></i>' + esc(LABEL[s.id]) + (st.status === 'running' ? ' <span class="spin dark"></span>' : '') + '</b><div class="muted small">' + esc(st.detail || (st.status === 'pending' ? 'Waiting' : '')) + '</div></div>';
      }).join('') + '</div>' : '') +
      (run.error ? '<div class="warnbox">' + esc(run.error) + '</div>' : '') + '</section>';
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
    let out = '';
    if (p.personas.length) {
      out += '<section class="block"><h2>Who this affects</h2><div class="people stagger">' + p.personas.map((x, i) => '<div class="persona" style="--i:' + i + '">' + C.avatar(x.name) +
        '<div><h3>' + esc(x.name) + '</h3><p class="muted small">' + esc(x.role) + '</p><ul class="small">' + (x.pains || []).map((pn) => '<li>' + esc(pn.text) + '</li>').join('') + '</ul></div></div>').join('') + '</div>' +
        '<a class="more" href="#/discover" data-act="jump" data-view="discover" data-tab="personas">See all ' + p.needs.length + ' needs and their evidence</a></section>';
    }
    if (ranked.length) {
      out += '<section class="block"><h2>Ideas, ranked for you to decide</h2><p class="muted">Each score comes with a reason. Change any score or weight and the order updates.</p>' +
        C.stackedBars(ranked.map((r) => ({ label: r.name, total: r.total, highlight: r.rank === 1, segments: r.breakdown.map((b, i) => ({ value: b.contribution, label: p.criteria[i].name })) })), p.criteria.map((c) => c.name), { max: 5 }) +
        '<a class="more" href="#/evaluate" data-act="jump" data-view="evaluate" data-tab="matrix">Review the scores and choose</a></section>';
    }
    if (sel && stack.length) {
      const rows = [['Languages', pick('Languages')], ['App', pick('Client') || pick('Web')], ['Backend', pick('Backend')], ['Database', pick('Database') || (/Supabase/.test(pick('Backend') || '') ? 'PostgreSQL (through Supabase)' : '')], ['Intelligence', pick('Intelligence')], ['Privacy', pick('Privacy & security')], ['Integrations', pick('Integrations')]]
        .filter((r) => r[1]).map((r) => ({ label: r[0], value: r[1] }));
      if (sched) rows.push({ label: 'First release', value: sched.phases[0].tasks.length + ' must-have features in about ' + Math.ceil(sched.mvpWeeks) + ' weeks for a team of ' + sched.settings.teamSize });
      out += '<section class="block"><h2>What it takes to build ' + esc(sel.name) + '</h2>' + C.plates(rows) +
        '<p class="muted small">Prefer another idea? Select it, then use Re-plan in Build plan.</p><a class="more" href="#/build" data-act="jump" data-view="build" data-tab="stack">Open the full build plan</a></section>';
    }
    if (Object.values(run.steps).some((x) => x.status === 'skipped')) out += '<div class="infobox">This run gathered research only. <a href="#/settings">Add a free Gemini key</a> and run it again to get people, ideas, scores and a build plan.</div>';
    out += '<p class="muted small">' + Math.round(audit.summary.traceability * 100) + '% of claims are backed by the evidence they cite' + (audit.summary.invalid ? '; ' + audit.summary.invalid + ' made-up citation' + (audit.summary.invalid > 1 ? 's were' : ' was') + ' caught and flagged' : '') + '.</p>';
    out += '<div class="row"><button class="btn accent" data-act="go" data-to="story">Scroll through the story</button><button class="btn primary" data-act="go" data-to="overview">Open the project</button><button class="btn" data-act="go" data-to="report">Audit and report</button><button class="btn ghost" data-act="again">Try another problem</button></div>';
    return out;
  }

  PL.views.start = {
    render(ctx) {
      if (run.running || run.projectId || run.error) {
        const html = working() + (run.running ? '' : results(ctx)) + (run.error && !run.projectId ? '<button class="btn" data-act="again">Try again</button>' : '');
        if (!run.running) run.entered = true;
        return html;
      }
      return idle(ctx);
    },
    actions: {
      example(el, e, ctx) { ctx.ui('start').problem = EXAMPLES[Number(el.dataset.i)].text; S.save(); ctx.render(); },
      again(el, e, ctx) { Object.assign(run, { projectId: null, steps: {}, log: [], error: '', entered: false }); ctx.render(); },
      jump(el, e, ctx) { ctx.state.currentId = run.projectId; ctx.ui(el.dataset.view).tab = el.dataset.tab; S.save(); ctx.go(el.dataset.view); },
      async run(el, e, ctx) {
        const problem = document.getElementById('problem').value.trim();
        if (problem.split(/\s+/).length < 6) { toast('Describe the problem in at least one full sentence', 'bad'); document.getElementById('problem').focus(); return; }
        const u = ctx.ui('start');
        u.problem = problem; u.web = document.getElementById('opt-web').checked; u.papers = Number(document.getElementById('opt-papers').value);
        S.save();
        Object.assign(run, { running: true, problem, steps: {}, log: [], projectId: null, error: '', entered: false });
        ctx.render();
        run.entered = true;
        try {
          const project = await A.run(problem, aiSettings(ctx.state), {
            web: u.web, papersPerQuery: u.papers, openAlexKey: ctx.state.settings.openAlexKey || '',
            onStep: (id, status, detail) => {
              run.steps[id] = { status, detail, doneAt: status === 'done' ? Date.now() : (run.steps[id] || {}).doneAt };
              PL.app.render();
            },
            onLog: (m) => { run.log.push(m); }
          });
          const added = S.addProject(Object.assign(S.blankProject(), project, { id: S.blankProject().id, team: [] }));
          run.projectId = added.id;
          toast('Project created: ' + added.name, 'ok');
        } catch (err) {
          run.error = err.message + (/Failed to fetch|NetworkError/.test(err.message) ? '. The browser could not reach the service; check your internet connection.' : '');
        }
        run.running = false;
        PL.app.render();
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
