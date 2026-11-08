/* ProductLab AI - scroll motion.
 * Figures build in as they scroll into view (once per screen, so editing a
 * field does not replay them). On the story page each chapter also reports
 * its scroll progress as the CSS variable --p (0 entering, 1 settled), and the
 * opening sphere reports --q as it scrolls away. Reduced motion shows
 * everything at once.
 */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  const reduce = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let observer = null;
  let lastRoute = null;
  let seen = new Set();
  let ticking = false;

  function countUp(el) {
    const to = Number(el.dataset.to); if (!Number.isFinite(to)) return;
    const dec = Number(el.dataset.dec || 0); const suffix = el.dataset.suffix || '';
    if (reduce()) { el.textContent = to.toFixed(dec) + suffix; return; }
    const t0 = performance.now(); const dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function show(el, instant) {
    el.classList.add('in');
    if (instant) { el.classList.add('instant'); el.querySelectorAll('.countup').forEach((c) => { c.textContent = Number(c.dataset.to).toFixed(Number(c.dataset.dec || 0)) + (c.dataset.suffix || ''); }); }
    else el.querySelectorAll('.countup').forEach(countUp);
  }

  function progress() {
    ticking = false;
    const vh = root.innerHeight || 800;
    let current = -1;
    document.querySelectorAll('.chapter').forEach((ch, i) => {
      const r = ch.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.7)));
      ch.style.setProperty('--p', p.toFixed(3));
      if (ch.classList.contains('opening')) ch.style.setProperty('--q', Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.8))).toFixed(3));
      if (r.top < vh * 0.5 && r.bottom > vh * 0.5) current = i;
    });
    document.querySelectorAll('.story-dots button').forEach((b, i) => {
      b.classList.toggle('on', i === current);
      b.setAttribute('aria-current', i === current ? 'step' : 'false');
    });
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(progress); } }

  /** Called after every render. */
  function attach(route, app) {
    if (route !== lastRoute) { seen = new Set(); lastRoute = route; }
    if (observer) observer.disconnect();
    const els = Array.from(app.querySelectorAll('.fig, .reveal'));
    els.forEach((el, i) => {
      el.dataset.key = route + ':' + i;
      el.querySelectorAll('.mark').forEach((m, j) => m.style.setProperty('--i', Math.min(j, 40)));
    });
    if (reduce() || !('IntersectionObserver' in root)) { els.forEach((el) => show(el, true)); progress(); return; }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        show(en.target, false);
        seen.add(en.target.dataset.key);
        observer.unobserve(en.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => {
      if (seen.has(el.dataset.key)) { show(el, true); return; }
      el.querySelectorAll('.countup').forEach((c) => { c.textContent = (0).toFixed(Number(c.dataset.dec || 0)) + (c.dataset.suffix || ''); });
      observer.observe(el);
    });
    progress();
  }

  if (root.addEventListener) {
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('resize', onScroll);
  }

  PL.motion = { attach, countUp };
})(typeof globalThis !== 'undefined' ? globalThis : this);
