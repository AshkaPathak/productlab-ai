/* ProductLab AI - application shell, router and event wiring */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  const { esc, toast, getPath, setPath, parseIds, confirmModal } = PL.ui;
  const S = PL.store;

  const NAV = [
    { id: 'start', label: 'Home', group: 'Top', hint: 'What ProductLab does, and where you describe your problem' },
    { id: 'overview', label: 'Overview', group: 'Project', needsProject: true, hint: 'Where your project stands' },
    { id: 'evidence', label: 'Research', group: 'Project', step: 1, needsProject: true, hint: 'What do we already know?' },
    { id: 'discover', label: 'People', group: 'Project', step: 2, needsProject: true, hint: 'Who does this affect, and what do they need?' },
    { id: 'ideate', label: 'Ideas', group: 'Project', step: 3, needsProject: true, hint: 'How could we solve it?' },
    { id: 'evaluate', label: 'Decide', group: 'Project', step: 4, needsProject: true, hint: 'Which idea should we build?' },
    { id: 'build', label: 'Build', group: 'Project', step: 5, needsProject: true, hint: 'What will it take to build?' },
    { id: 'report', label: 'Check', group: 'Project', step: 6, needsProject: true, hint: 'Can we trust it?' },
    { id: 'story', label: 'Story', group: 'Project', needsProject: true, hint: 'The whole project as one scrolling page' },
    { id: 'projects', label: 'All projects', group: 'More' },
    { id: 'study', label: 'Evaluation study', group: 'More', needsProject: true, hint: 'Compare against ordinary AI brainstorming' },
    { id: 'settings', label: 'Settings', group: 'More', hint: 'Connect an AI model' }
  ];

  const ICONS = {
    start: '<path d="M4 11.5L12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10.5 19v-4.5h3V19"/>',
    projects: '<rect x="4" y="5" width="16" height="5" rx="1.5"/><rect x="4" y="14" width="16" height="5" rx="1.5"/>',
    overview: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
    story: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    study: '<path d="M9 4h6M10 4v5l-5 9a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5-9V4"/><path d="M7.5 15h9"/>',
    settings: '<path d="M5 7h14M5 17h14"/><circle cx="9" cy="7" r="2.2"/><circle cx="15" cy="17" r="2.2"/>'
  };
  const icon = (id) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[id] || '') + '</svg>';

  let route = 'projects';
  let renderedRoute = null;
  let cachedIndex = null; let cachedKey = '';

  function indexFor(project) {
    const g = S.state.settings.guard;
    const key = project.id + '|' + project.findings.length + '|' + JSON.stringify(project.findings.map((f) => f.text + (f.tags || []).join())).length + '|' + JSON.stringify(project.glossary) + '|' + JSON.stringify(project.references.map((r) => r.id + r.strength)) + '|' + g.strong + g.weak;
    if (key !== cachedKey) { cachedIndex = PL.evidence.buildIndex(project, { strong: g.strong, weak: g.weak }); cachedKey = key; }
    return cachedIndex;
  }

  function ui(view) { return (S.state.ui[view] = S.state.ui[view] || {}); }

  function makeCtx() {
    const project = S.current();
    return {
      project,
      state: S.state,
      index: project ? indexFor(project) : null,
      ui,
      commit(mutator, opts) {
        const p = S.current();
        if (p && mutator) mutator(p);
        if (p) p.updatedAt = new Date().toISOString();
        if (!S.save()) toast('Could not save to this browser (storage full or blocked). Export your project to keep it.', 'bad');
        if (!opts || opts.render !== false) render();
      },
      go,
      render,
      toast
    };
  }

  function go(r) {
    if (('#/' + r) !== location.hash) location.hash = '#/' + r;
    else { route = r; render(); }
  }

  /* one short, consistent count beside each step */
  function navCount(id, p, prog) {
    switch (id) {
      case 'evidence': return p.findings.length ? p.findings.length + ' facts' : '';
      case 'discover': return p.needs.length ? p.needs.length + (p.needs.length === 1 ? ' need' : ' needs') : '';
      case 'ideate': return p.concepts.length ? p.concepts.length + (p.concepts.length === 1 ? ' idea' : ' ideas') : '';
      case 'evaluate': return prog && prog.done >= 1 ? 'scored' : '';
      case 'build': return p.features.length ? p.features.length + (p.features.length === 1 ? ' feature' : ' features') : '';
      case 'report': return prog && prog.big && prog.big !== '\u2013' ? prog.big + ' backed' : '';
      default: return '';
    }
  }

  function sidebar(project) {
    const C = PL.comp;
    let prog = null;
    if (project) { try { prog = C.stepProgress(project, PL.evidence.audit(project, indexFor(project))); } catch (e) { prog = null; } }
    const item = (n) => {
      const disabled = n.needsProject && !project;
      const p = n.step && prog ? prog[n.step - 1] : null;
      const lead = n.step
        ? '<span class="stepnum s' + n.step + (p && p.done > 0 ? ' has' : '') + '" aria-hidden="true">' + n.step + '</span>'
        : '<span class="nav-icon">' + icon(n.id) + '</span>';
      const sub = n.step && project ? '<small>' + esc(navCount(n.id, project, p)) + '</small>' : '';
      return '<a href="#/' + n.id + '" class="nav-item' + (n.step ? ' step-item' : '') + (route === n.id ? ' active' : '') + (disabled ? ' disabled' : '') + '"' + (route === n.id ? ' aria-current="page"' : '') + (n.hint ? ' title="' + esc(n.hint) + '"' : '') + (disabled ? ' aria-disabled="true" tabindex="-1"' : '') + '>' +
        lead + '<span class="nav-label">' + esc(n.label) + '</span>' + sub + '</a>';
    };
    const group = (g) => NAV.filter((n) => n.group === g).map(item).join('');
    const pname = project ? project.name : '';
    return '<aside class="sidebar"><a class="brand" href="#/start">' + C.logo() + '<span>ProductLab</span></a>' +
      '<nav class="nav-group" aria-label="Main">' + group('Top') + '</nav>' +
      (project
        ? '<nav class="nav-group project-nav" aria-label="Your project"><div class="nav-title">Your project</div><div class="nav-project" title="' + esc(project.name) + '">' + esc(pname) + '</div>' + group('Project') + '</nav>'
        : '<div class="nav-hint">Describe a problem on Home to start a project.</div>') +
      '<nav class="nav-group more-nav" aria-label="More"><div class="nav-title">More</div>' + group('More') + '</nav>' +
      '<div class="side-foot">' + (S.state.persisted ? 'Saved in this browser' : '<span class="bad-text">Not saved. Export your project to keep it.</span>') + '</div></aside>';
  }

  /* Step pages: a header that asks the step's question, then a plain summary, then the full tools folded away. */
  function stepHead(project, nav) {
    const st = PL.guide && PL.guide.byId(nav.id);
    if (!st) {
      return '<header class="pagehead"><div class="crumb">' + esc(project.name) + '</div><h1>' + esc(nav.label) + '</h1></header>';
    }
    const i = PL.guide.STEPS.indexOf(st);
    const prev = PL.guide.STEPS[i - 1]; const next = PL.guide.STEPS[i + 1];
    return '<header class="pagehead s' + st.n + '"><div class="crumb">' + esc(project.name) + '</div>' +
      '<div class="pagehead-row"><span class="stepnum big s' + st.n + ' has" aria-hidden="true">' + st.n + '</span><div>' +
      '<div class="eyebrow">Step ' + st.n + ' of 6 \u00b7 ' + esc(st.name) + '</div><h1>' + esc(st.question) + '</h1><p class="pagehead-what">' + esc(st.what) + '</p></div></div>' +
      '<div class="stepper" aria-label="Steps">' + PL.guide.STEPS.map((x) => '<a href="#/' + x.id + '" class="dot s' + x.n + (x.id === nav.id ? ' on' : '') + '" title="' + esc(x.n + '. ' + x.name) + '"><span class="sr-only">' + esc(x.n + '. ' + x.name) + '</span></a>').join('') + '</div>' +
      '</header>';
  }

  function summaryCard(ctx, nav) {
    const sm = PL.guide && PL.guide.summary(nav.id, ctx);
    if (!sm) return '';
    const st = PL.guide.byId(nav.id);
    const nextNav = sm.next && NAV.find((n) => n.id === sm.next);
    const nextLabel = nextNav ? (nextNav.step ? 'Next: ' + nextNav.label : nextNav.id === 'story' ? 'See the whole story' : 'Go to ' + nextNav.label) : '';
    return '<section class="summary s' + st.n + '" aria-label="Summary"><div class="summary-tag">In short</div><h2 class="summary-head">' + esc(sm.headline) + '</h2>' +
      (sm.points.length ? '<ul class="summary-points">' + sm.points.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
      (nextNav ? '<div class="summary-actions"><a class="btn primary big" href="#/' + nextNav.id + '">' + esc(nextLabel) + ' <span aria-hidden="true">\u2192</span></a></div>' : '') + '</section>';
  }

  function withSummary(ctx, nav, body) {
    const card = summaryCard(ctx, nav);
    if (!card) return body;
    const open = !!ui(nav.id).details;
    return card + '<details class="deep" data-remember="' + esc(nav.id) + '"' + (open ? ' open' : '') + '><summary><span>All the details and editing tools</span><small>Charts, tables, sources and every field you can change</small></summary><div class="deep-body">' + body + '</div></details>';
  }

  function render() {
    const app = document.getElementById('app');
    if (!app) return;
    const ctx = makeCtx();
    const view = PL.views[route] || PL.views.projects;
    const nav = NAV.find((n) => n.id === route);
    if (nav && nav.needsProject && !ctx.project) { route = 'projects'; return render(); }
    const active = document.activeElement;
    const focusKey = active && active.dataset ? (active.dataset.path || active.dataset.focus || '') : '';
    const scroll = root.scrollY;
    let body;
    try { body = view.render(ctx); } catch (e) {
      console.error(e);
      body = '<div class="card"><h2>Something went wrong</h2><p class="muted">' + esc(e.message) + '</p><button class="btn" data-act="go" data-to="projects">Back to projects</button></div>';
    }
    const head = ctx.project && nav && nav.needsProject && nav.id !== 'story' ? stepHead(ctx.project, nav) : '';
    if (ctx.project && nav && nav.step) body = withSummary(ctx, nav, body);
    app.innerHTML = sidebar(ctx.project) + '<main class="main" id="main" tabindex="-1">' + head + '<div class="view view-' + esc(route) + '">' + body + '</div></main>';
    if (view.after) { try { view.after(ctx, app); } catch (e) { console.error(e); } }
    if (PL.theme) { try { PL.theme.apply(route === 'story' ? ctx.project : null); } catch (e) { console.error(e); } }
    if (PL.motion) { try { PL.motion.attach(route, app); } catch (e) { console.error(e); } }
    if (focusKey) {
      const el = app.querySelector('[data-path="' + CSS.escape(focusKey) + '"],[data-focus="' + CSS.escape(focusKey) + '"]');
      if (el && el.focus) el.focus({ preventScroll: true });
    }
    root.scrollTo(0, route === renderedRoute ? scroll : 0);
    renderedRoute = route;
  }

  /* ---------------- generic actions ---------------- */

  function coerce(el) {
    const t = el.dataset.type;
    if (el.type === 'checkbox') return el.checked;
    const v = el.value;
    if (t === 'number') return v === '' ? '' : Number(v);
    if (t === 'list') return v.split(',').map((x) => x.trim()).filter(Boolean);
    if (t === 'ids') return parseIds(v);
    return v;
  }

  const GENERIC = {
    set(el, e, ctx) { ctx.commit((p) => setPath(p, el.dataset.path, coerce(el))); },
    go(el) { go(el.dataset.to); },
    tab(el, e, ctx) { ui(el.dataset.view).tab = el.dataset.tab; S.save(); render(); },
    uiset(el, e, ctx) { const u = ui(el.dataset.view); u[el.dataset.key] = el.dataset.value != null ? el.dataset.value : coerce(el); S.save(); render(); },
    'cite-add'(el, e, ctx) {
      ctx.commit((p) => {
        const list = getPath(p, el.dataset.path) || [];
        if (!list.includes(el.dataset.id)) list.push(el.dataset.id);
        setPath(p, el.dataset.path, list);
      });
    },
    'cite-remove'(el, e, ctx) {
      ctx.commit((p) => setPath(p, el.dataset.path, (getPath(p, el.dataset.path) || []).filter((x) => x !== el.dataset.id)));
    },
    'cite-input'(el, e, ctx) {
      const ids = parseIds(el.value);
      if (!ids.length) return;
      const missing = ids.filter((id) => !ctx.index.byId.has(id));
      ctx.commit((p) => {
        const list = getPath(p, el.dataset.path) || [];
        ids.forEach((id) => { if (!list.includes(id)) list.push(id); });
        setPath(p, el.dataset.path, list);
      });
      if (missing.length) toast('Not in the evidence library: ' + missing.join(', '), 'bad');
    },
    async del(el, e, ctx) {
      const ok = await confirmModal(el.dataset.confirm || 'Delete this item?', 'Delete');
      if (!ok) return;
      ctx.commit((p) => {
        const w = el.dataset.path.split('.');
        const listPath = w.slice(0, -1).join('.');
        const list = getPath(p, listPath);
        if (Array.isArray(list)) setPath(p, listPath, list.filter((x) => String(x.id) !== w[w.length - 1]));
      });
    }
  };

  function dispatch(e, kind) {
    const el = e.target.closest(kind === 'input' ? '[data-live]' : '[data-act]');
    if (!el || el.closest('.modal-backdrop')) return;
    const tag = el.tagName;
    const isField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (kind === 'click' && isField && el.type !== 'checkbox' && el.type !== 'radio') return;
    if (kind === 'change' && !isField) return;
    if (kind === 'input' && !el.hasAttribute('data-live')) return;
    if (kind === 'click' && isField && (el.type === 'checkbox' || el.type === 'radio')) return; // handled on change
    const name = kind === 'input' ? el.dataset.live : el.dataset.act;
    const view = PL.views[route] || {};
    const fn = (view.actions && view.actions[name]) || GENERIC[name];
    if (!fn) return;
    if (kind === 'click' && (tag === 'A' || tag === 'BUTTON')) e.preventDefault();
    Promise.resolve(fn(el, e, makeCtx())).catch((err) => { console.error(err); toast(err.message || String(err), 'bad'); });
  }

  function onHash() {
    const r = (location.hash || '').replace(/^#\/?/, '') || 'projects';
    route = PL.views[r] ? r : 'projects';
    render();
    const m = document.getElementById('main');
    if (m) m.focus({ preventScroll: true });
  }

  function start() {
    S.load();
    document.addEventListener('click', (e) => dispatch(e, 'click'));
    document.addEventListener('change', (e) => dispatch(e, 'change'));
    document.addEventListener('input', (e) => dispatch(e, 'input'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches && e.target.matches('.cite-input')) { e.preventDefault(); e.target.blur(); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g.node')) { e.preventDefault(); dispatch({ target: e.target, preventDefault() {} }, 'click'); }
    });
    // remember whether each step's details are open, so experienced users are not asked twice
    document.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!d || !d.matches || !d.matches('details[data-remember]')) return;
      const u = ui(d.dataset.remember);
      if (!!u.details === d.open) return;
      u.details = d.open; S.save();
    }, true);
    root.addEventListener('hashchange', onHash);
    if (!location.hash) location.hash = '#/start';
    onHash();
  }

  PL.app = { start, render, go, NAV, makeCtx, ui };
  PL.views = PL.views || {};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof globalThis !== 'undefined' ? globalThis : this);
