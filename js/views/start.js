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
        label: LABEL[s.id], kind: s.id === 'build' ? 'build' : 'think', state: st.status === 'warn' ? 'done' : st.status, fill: st.status === 'warn' ? 0.6 : 1,
        big: c && st.status !== 'skipped' ? c.big : null, sub: st.status === 'skipped' ? 'needs an AI key' : c ? c.sub : OUTPUT[s.id],
        justDone: st.doneAt && Date.now() - st.doneAt < 1200
      };
    });
  }

  /* Plain-language walkthrough of each step: what happens, what you get. */
  const WORDS = [
    ['Finding', 'One fact from a source, quoted exactly, such as a statistic from a study.'],
    ['Persona', 'A short profile of a typical person who has the problem. A starting guess to check with real people.'],
    ['Need', 'Something those people are struggling with, ranked by how much it hurts (severity 1 to 5).'],
    ['Concept', 'One idea for a product or service that answers one or more needs.'],
    ['Decision matrix', 'A scorecard. Each idea gets a 1 to 5 score per criterion; criteria that matter more count for more.'],
    ['Sensitivity', 'How much the scores would have to change before a different idea comes out on top. A big number means a safe choice.'],
    ['RICE and MoSCoW', 'Ways to rank features: value for effort (RICE), and must, should, could or won’t have (MoSCoW).'],
    ['Tech stack', 'The programming languages, frameworks and services you would build the product with.'],
    ['Traceability', 'The share of claims that point to a source which actually says what the claim says.']
  ];

  const FAQ = [
    ['Do I need to know product design or research methods?', 'No. Write the problem the way you would explain it to a friend. Every step explains itself, and you can change anything it suggests.'],
    ['What do I need to start?', PL.llm.PRESETS.shared.baseUrl ? 'Just the problem. ProductLab\u2019s shared AI is ready to use with no sign-up or key. If it reaches its daily limit, or you use ProductLab a lot, you can add your own free Google Gemini key in Settings.' : 'Just the problem. For people, ideas, scores and a build plan, add a free Google Gemini API key in Settings; the steps are shown there and take about two minutes.'],
    ['How do I know it is not making things up?', 'Facts are only taken from sources, never written from the model’s memory, and every claim is checked against the fact it cites. Anything unsupported is flagged in red.'],
    ['Where is my work saved?', 'In this browser only. The only things sent anywhere are search phrases to OpenAlex and the text the AI needs, through ProductLab\u2019s shared AI or your own key. On Google\u2019s free tier, Google may use that text to improve its products, so leave out anything confidential. You can export any project as a file from Projects.']
  ];

  function idle(ctx) {
    const s = ctx.state.settings.ai;
    const ai = A.hasModel(aiSettings(ctx.state));
    const sharedAI = PL.llm.isShared(s) && !ctx.state.apiKey;
    const canWeb = ai && s.provider === 'gemini' && !sharedAI;
    const u = ctx.ui('start');
    const G = PL.guide;
    return '<section class="home">' +
      // 1. one promise and the box to type in, together
      '<header class="hero home-hero" id="ask">' +
      '<p class="kicker">ProductLab AI</p>' +
      '<h1 class="hook">Got a problem that\u2019s <em>everywhere?</em><br>Leave with a plan you can build.</h1>' +
      '<p class="home-sub">Describe it the way you\u2019d tell a friend. ProductLab reads the research, finds who it hurts, suggests ideas, helps you choose and plans the build. No expertise needed.</p>' +
      '<div class="composer"><label for="problem" class="composer-label">What problem are you trying to solve?</label>' +
      '<textarea id="problem" rows="3" data-focus="problem" placeholder="e.g. ' + esc(EXAMPLES[0].text) + '">' + esc(u.problem || '') + '</textarea>' +
      '<div class="row composer-foot"><span class="muted small">Or try one:</span>' + EXAMPLES.map((x, i) => '<button class="example" data-act="example" data-i="' + i + '">' + esc(x.short) + '</button>').join('') +
      '<span class="spacer"></span><button class="btn primary big" data-act="run">Find users, ideas and a plan <span aria-hidden="true">\u2192</span></button></div>' +
      '<details class="run-options"><summary>Search options</summary><div class="row">' +
      '<label class="small" for="opt-papers">Papers per search</label><select id="opt-papers">' + [5, 8, 12].map((n) => '<option' + (Number(u.papers || 8) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<label class="check small" title="Uses Google Search grounding, which Google includes only on paid Gemini projects"><input type="checkbox" id="opt-web"' + (canWeb && u.web === true ? ' checked' : '') + (canWeb ? '' : ' disabled') + '> Search the web too (needs a paid Gemini key)</label></div></details></div>' +
      (ai ? '<p class="hero-note">' + (sharedAI ? 'No sign-up or key needed.' : 'Using ' + esc(s.model) + '.') + ' Takes 1 to 2 minutes, and you can watch each step happen. <button class="linkish" data-act="try-example">Or see a finished example</button></p>'
        : '<p class="hero-note">First, <a href="#/settings">add a free Gemini key</a> (two minutes). Without one, ProductLab only gathers research. <button class="linkish" data-act="try-example">See a finished example</button></p>') +
      '</header>' +

      // 2. the six steps, one colour each
      '<section class="home-section reveal"><h2 class="big-h">Six steps, each with one clear question.</h2>' +
      '<p class="lede">ProductLab drafts all six for you. Then you open each step, read a short summary and change anything you disagree with.</p>' +
      '<ol class="steps6">' + G.STEPS.map((st) => '<li class="s' + st.n + '"><span class="stepnum big s' + st.n + ' has">' + st.n + '</span><div><h3>' + esc(st.name) + '</h3><p class="q">' + esc(st.question) + '</p><p>' + esc(st.what) + '</p></div></li>').join('') + '</ol>' +
      '<div class="trust"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="var(--s6)"/><path d="M13 22.5l6 6L31 16" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<div><h3>Every claim is checked</h3><p>Each statement is compared with the source it cites. Anything made up or mismatched is flagged, so you know what to trust.</p></div></div></section>' +

      // 3. help, folded until wanted
      '<section class="home-section reveal"><h2 class="big-h">Questions?</h2><div class="faq">' +
      FAQ.map((q) => '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>').join('') +
      '<details><summary>What do the words mean?</summary><dl class="words">' + WORDS.map((w) => '<div class="word"><dt>' + esc(w[0]) + '</dt><dd>' + esc(w[1]) + '</dd></div>').join('') + '</dl></details>' +
      '</div></section>' +
      '</section>';
  }

  function mini(kind) {
    return '<svg viewBox="0 0 22 22" aria-hidden="true">' + C.orb(11, 11, 10, kind === 'ink' ? 'deep' : kind) + '</svg>';
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
      'to-ask'() {
        const box = document.getElementById('ask'); const ta = document.getElementById('problem');
        if (box) box.scrollIntoView({ behavior: root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        if (ta) setTimeout(() => ta.focus({ preventScroll: true }), 350);
      },
      'try-example'(el, e, ctx) {
        let p = ctx.state.projects.find((x) => x.id === 'pcos');
        if (!p) { S.resetSamples(); p = ctx.state.projects.find((x) => x.id === 'pcos'); }
        if (!p) return;
        ctx.state.currentId = p.id; S.save(); ctx.go('story');
      },
      example(el, e, ctx) { ctx.ui('start').problem = EXAMPLES[Number(el.dataset.i)].text; S.save(); ctx.render(); },
      again(el, e, ctx) { Object.assign(run, { projectId: null, steps: {}, log: [], error: '', entered: false }); ctx.render(); },
      jump(el, e, ctx) { ctx.state.currentId = run.projectId; Object.assign(ctx.ui(el.dataset.view), { tab: el.dataset.tab, details: true }); S.save(); ctx.go(el.dataset.view); },
      async run(el, e, ctx) {
        const problem = document.getElementById('problem').value.trim();
        if (problem.split(/\s+/).length < 6) { toast('Describe the problem in at least one full sentence', 'bad'); document.getElementById('problem').focus(); return; }
        const u = ctx.ui('start');
        if (!A.hasModel(aiSettings(ctx.state))) {
          u.problem = problem; S.save();
          const go = await PL.ui.formModal('No AI key connected yet', [], {
            intro: 'Without an AI key, ProductLab can only gather research papers. It cannot find the people affected, suggest ideas, help you decide or plan the build. A free Gemini key takes about two minutes to get.',
            submit: 'Add a free key first', alt: { label: 'Research only', value: 'research' }
          });
          if (!go) return;
          if (go !== 'research') { location.hash = '#/settings'; return; }
        }
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
