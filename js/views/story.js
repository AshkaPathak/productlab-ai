/* ProductLab AI - Story: the whole project as a scroll-driven page.
 * One chapter per step; each chapter leads with a headline number and builds
 * its graphic as it scrolls into view.
 */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});
  PL.views = PL.views || {};
  const { esc, fix, pct } = PL.ui;
  const C = PL.comp;
  const F = () => PL.fig;

  const count = (n, o) => {
    const opt = Object.assign({ dec: 0, suffix: '' }, o || {});
    return '<span class="countup" data-to="' + Number(n) + '" data-dec="' + opt.dec + '" data-suffix="' + esc(opt.suffix) + '">' + Number(n).toFixed(opt.dec) + esc(opt.suffix) + '</span>';
  };

  const pl = (n, one, many) => count(n) + ' ' + (Number(n) === 1 ? one : many);

  function chapter(id, kicker, headline, lede, body, cls) {
    return '<section class="chapter reveal' + (cls ? ' ' + cls : '') + '" id="ch-' + id + '" data-title="' + esc(kicker) + '">' +
      '<p class="kicker">' + esc(kicker) + '</p><h2 class="big">' + headline + '</h2>' + (lede ? '<p class="lede">' + lede + '</p>' : '') +
      '<div class="stage-art">' + body + '</div></section>';
  }

  function chapters(ctx) {
    const p = ctx.project; const D = PL.decision; const P = PL.planning;
    const out = [];
    const problem = (p.autopilot && p.autopilot.problem) || p.challenge || p.name;

    // 0. Opening
    out.push('<section class="chapter opening reveal" id="ch-open" data-title="The problem"><svg class="orbs" viewBox="0 0 600 600" aria-hidden="true">' +
      '<g class="o1">' + C.orb(330, 330, 230, 'build') + '</g><g class="o2">' + C.orb(150, 430, 110, 'soft') + '</g><g class="o3">' + C.orb(170, 170, 70, 'think') + '</g></svg>' +
      '<div class="opening-text"><p class="kicker">' + esc(p.domain || 'The problem') + '</p><h1 class="ask' + (problem.length > 90 && problem.length <= 150 ? ' long' : '') + '">' + esc(problem.length > 150 ? p.name : problem) + '</h1>' +
      (problem.length > 150 ? '<p class="lede problem">' + esc(problem.length > 320 ? problem.slice(0, 319).replace(/\s+\S*$/, '') + '\u2026' : problem) + '</p>' : '') +
      '<p class="lede">Scroll to see how ProductLab got from this problem to a plan you can build, and the evidence behind every step.</p><span class="scroll-cue" aria-hidden="true"></span></div></section>');

    // 1. Evidence
    if (p.findings.length) {
      out.push(chapter('evidence', 'Step 1, evidence', pl(p.findings.length, 'finding', 'findings') + ' from ' + pl(p.references.length, 'source', 'sources') + '.',
        'Every finding is a sentence taken from a paper, report or interview, never written from a model’s memory.', F().sourceMap(p)));
      const themes = PL.cluster.themes(p, ctx.index, { threshold: 0.12 });
      const multi = themes.filter((t) => t.members.length > 1);
      if (multi.length) out.push(chapter('themes', 'What the evidence keeps saying', 'It clusters into ' + pl(multi.length, 'theme', 'themes') + '.',
        'Findings that use the same language are grouped. Cyan themes have no need written for them yet.', F().themeBubbles(themes, p.findings)));
    }

    // 2. People and needs
    if (p.personas.length) {
      out.push(chapter('people', 'Step 2, people', (p.personas.length === 1 ? count(1) + ' kind of person this affects.' : count(p.personas.length) + ' kinds of people this affects.'), 'Proto-personas built from the evidence, to check with real users.',
        '<div class="cast">' + p.personas.map((ps, i) => '<div class="castmember mark" style="--i:' + i + '">' + C.avatar(ps.name) + '<b>' + esc(ps.name) + '</b><span>' + esc(ps.role || '') + '</span>' +
          ((ps.pains || [])[0] ? '<q>' + esc(ps.pains[0].text) + '</q>' : '') + '</div>').join('') + '</div>'));
    }
    if (p.needs.length) {
      const strong = p.needs.filter((n) => Number(n.severity) >= 4).length;
      out.push(chapter('needs', 'What hurts most', count(strong) + ' of ' + pl(p.needs.length, 'need', 'needs') + ' ' + (strong === 1 ? 'is' : 'are') + ' severe.', 'Higher means more severe, further right means better evidenced.', F().needsMap(p, ctx.index)));
    }

    // 3. Ideas
    if (p.concepts.length) {
      out.push(chapter('ideas', 'Step 3, ideas', (p.concepts.length === 1 ? count(1) + ' idea, tied to a need.' : count(p.concepts.length) + ' ideas, each tied to a need.'), 'The ring around each mark shows how much of the idea’s reasoning is backed by evidence.',
        '<div class="gallery">' + p.concepts.map((c, i) => '<div class="piece mark" style="--i:' + i + '">' + F().conceptMark(c.name, PL.evidence.conceptEvidenceScore(ctx.index, c)) + '<b>' + esc(c.name) + '</b><span>' + esc(c.tagline || '') + '</span></div>').join('') + '</div>' +
        F().coverage(p)));
    }

    // 4. Decision
    if (p.concepts.length && p.criteria.length) {
      const ranked = D.wdm(p.concepts, p.criteria, p.ratings);
      const top = ranked[0];
      out.push(chapter('decision', 'Step 4, decision', esc(top.name) + ' comes out on top, at ' + count(top.total, { dec: 2 }) + '.',
        'A weighted decision matrix: each idea is rated 1 to 5 on ' + p.criteria.length + ' criteria. Change any weight and the ranking follows.',
        '<div class="duo">' + F().fig(C.stackedBars(ranked.map((r) => ({ label: r.name, total: r.total, highlight: r.rank === 1, segments: r.breakdown.map((b, i) => ({ value: b.contribution, label: p.criteria[i].name })) })), p.criteria.map((c) => c.name), { max: 5 }), '', 'bars') +
        F().radar(p, ranked) + '</div>'));
      if (p.concepts.length > 1) {
        const sens = D.sensitivity(p.concepts, p.criteria, p.ratings);
        const flips = sens.filter((s) => s.flip).map((s) => Math.abs(Math.round(s.flip.delta * 100)));
        const minShift = flips.length ? Math.min(...flips) : null;
        out.push(chapter('robust', 'Would it still win?', minShift == null ? 'No single weight change flips it.' : 'It takes a ' + count(minShift) + '\u2011point shift to change the winner.',
          'Each bar shows how far one weight must move before another idea wins. Short pink bars are the fragile ones.', F().tornado(sens)));
      }
    }

    // 5. Build
    const sel = p.concepts.find((c) => c.id === p.selectedConcept);
    const rec = P.recommendStack(p.constraints || {});
    out.push(chapter('stack', 'Step 5, build', 'What it takes to build ' + esc(sel ? sel.name : 'it') + '.', 'Languages, frameworks and services, each picked from your constraints with the reason recorded.', F().stackDiagram(rec)));
    if (p.features.length) {
      const rows = P.prioritize(p, ctx.index);
      const sched = P.schedule(p, { priority: rows.map((r) => r.feature.id) });
      const mvp = sched.phases[0];
      out.push(chapter('features', 'What to build first', pl(rows.length, 'feature', 'features') + ', ranked by value, effort and evidence.', 'Features nobody can back with evidence drop down the list.', F().riceBubbles(rows)));
      if (sched.tasks.length) out.push(chapter('roadmap', 'When', 'A first release in about ' + pl(Math.ceil(mvp.weeks || sched.totalWeeks), 'week', 'weeks') + '.',
        'With a team of ' + sched.settings.teamSize + ', ' + sched.settings.sprintWeeks + '-week sprints and a ' + Math.round(sched.settings.buffer * 100) + '% risk buffer.', F().fig(C.gantt(sched), '<b>' + mvp.tasks.length + ' must-have features</b> in the first release, ' + fix(sched.totalEffort, 1) + ' person-weeks in total.', 'bars')));
    }

    // 6. Trust
    const audit = PL.evidence.audit(p, ctx.index);
    if (audit.summary.total) {
      out.push(chapter('trust', 'Step 6, can you trust it?', count(Math.round(audit.summary.traceability * 100), { suffix: '%' }) + ' of claims trace back to a source.',
        'Every claim above was checked against the evidence it cites. Made-up or mismatched citations are flagged, not hidden.', F().claimWaffle(audit)));
    }

    out.push('<section class="chapter finale reveal" id="ch-end" data-title="Next"><h2 class="big">Your call now.</h2><p class="lede">Change a rating, a weight or a constraint and everything you just scrolled through updates.</p>' +
      '<div class="row center"><button class="btn accent big" data-act="go" data-to="evaluate">Open the decision matrix</button><button class="btn big" data-act="go" data-to="report">Audit and report</button></div></section>');
    return out;
  }

  PL.views.story = {
    render(ctx) {
      const ch = chapters(ctx);
      const titles = ch.map((html) => (html.match(/data-title="([^"]*)"/) || [])[1] || '');
      return '<div class="story">' + ch.join('') + '</div>' +
        '<nav class="story-dots" aria-label="Chapters">' + titles.map((t, i) => '<button data-act="story-jump" data-i="' + i + '" aria-label="' + t + '"><span>' + t + '</span></button>').join('') + '</nav>';
    },
    actions: {
      'story-jump'(el) {
        const target = document.querySelectorAll('.chapter')[Number(el.dataset.i)];
        if (target) target.scrollIntoView({ behavior: root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
