/* ProductLab AI - application shell, router and event wiring */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  const { esc, toast, getPath, setPath, parseIds, confirmModal } = PL.ui;
  const S = PL.store;

  const NAV = [
    { id: 'start', label: 'Home', icon: '✦', group: 'Workspace', hint: 'What ProductLab does, and where you describe your problem' },
    { id: 'projects', label: 'Projects', icon: '▦', group: 'Workspace' },
    { id: 'overview', label: 'Overview', icon: '◎', group: 'Workspace', needsProject: true },
    { id: 'story', label: 'Story', icon: '◐', group: 'Workspace', needsProject: true, hint: 'Scroll through the whole project, one graphic at a time' },
    { id: 'evidence', label: 'Evidence', icon: '≡', group: 'Workflow', step: 1, needsProject: true, hint: 'Research synthesizer & evidence graph' },
    { id: 'discover', label: 'People & needs', icon: '✦', group: 'Workflow', step: 2, needsProject: true, hint: 'Opportunity miner & personas' },
    { id: 'ideate', label: 'Ideas', icon: '✵', group: 'Workflow', step: 3, needsProject: true, hint: 'Random association, morphological analysis, AI assist' },
    { id: 'evaluate', label: 'Decision', icon: '⚖', group: 'Workflow', step: 4, needsProject: true, hint: 'Decision matrix, sensitivity, competitors, risks' },
    { id: 'build', label: 'Build plan', icon: '⚒', group: 'Workflow', step: 5, needsProject: true, hint: 'Features, roadmap, tech stack, business model' },
    { id: 'report', label: 'Audit & report', icon: '⎙', group: 'Workflow', step: 6, needsProject: true, hint: 'Traceability audit & strategy report' },
    { id: 'study', label: 'Evaluation study', icon: 'Σ', group: 'Research', needsProject: true, hint: 'Compare against ordinary AI brainstorming' },
    { id: 'settings', label: 'Settings', icon: '⚙', group: 'Research' }
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

  function sidebar(project) {
    const C = PL.comp;
    let prog = null;
    if (project) { try { prog = C.stepProgress(project, PL.evidence.audit(project, indexFor(project))); } catch (e) { prog = null; } }
    const item = (n) => {
      const disabled = n.needsProject && !project;
      const p = n.step && prog ? prog[n.step - 1] : null;
      return '<a href="#/' + n.id + '" class="nav-item' + (route === n.id ? ' active' : '') + (disabled ? ' disabled' : '') + '"' + (route === n.id ? ' aria-current="page"' : '') + (n.hint ? ' title="' + esc(n.hint) + '"' : '') + (disabled ? ' aria-disabled="true" tabindex="-1"' : '') + '>' +
        (n.step ? C.railNode(p ? p.done : 0) : '<span class="nav-icon">' + icon(n.id) + '</span>') + '<span>' + esc(n.label) + '</span>' +
        (p && p.big != null && p.big !== '\u2013' ? '<small>' + esc(p.big) + '</small>' : '') + '</a>';
    };
    const groups = [
      '<div class="nav-group">' + NAV.filter((n) => n.group === 'Workspace').map(item).join('') + '</div>',
      '<div class="nav-group"><div class="nav-title">' + (project ? esc(project.name.length > 30 ? project.name.slice(0, 29) + '\u2026' : project.name) : 'Workflow') + '</div><div class="rail">' + NAV.filter((n) => n.group === 'Workflow').map(item).join('') + '</div></div>',
      '<div class="nav-group">' + NAV.filter((n) => n.group === 'Research').map(item).join('') + '</div>'
    ].join('');
    return '<aside class="sidebar"><a class="brand" href="#/start">' + C.logo() + '<span>ProductLab</span></a>' +
      '<div class="brand-sub">From problem to product, with sources</div>' + groups +
      '<div class="side-foot">' + (S.state.persisted ? 'Saved in this browser' : '<span class="bad-text">Not saved. Export your project to keep it.</span>') + '</div></aside>';
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
    const head = ctx.project && nav && nav.needsProject && nav.id !== 'story'
      ? '<header class="topbar"><div><div class="crumb">' + esc(ctx.project.domain || 'Project') + '</div><h1>' + esc(ctx.project.name) + '</h1></div><div class="topbar-step">' + PL.comp.motif() + '<span>' + (nav.step ? 'Step ' + nav.step + ' of 6: ' : '') + esc(nav.label) + '</span></div></header>'
      : '';
    app.innerHTML = sidebar(ctx.project) + '<main class="main" id="main" tabindex="-1">' + head + '<div class="view view-' + esc(route) + '">' + body + '</div></main>';
    if (view.after) { try { view.after(ctx, app); } catch (e) { console.error(e); } }
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
    root.addEventListener('hashchange', onHash);
    if (!location.hash) location.hash = '#/start';
    onHash();
  }

  PL.app = { start, render, go, NAV, makeCtx, ui };
  PL.views = PL.views || {};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof globalThis !== 'undefined' ? globalThis : this);
