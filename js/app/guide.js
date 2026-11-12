/*
 * ProductLab AI - step guide
 * Plain-language names for the six steps, and a short summary for each step
 * screen: one headline, up to three points and the obvious next move. The
 * summary is what a newcomer reads; the full tools sit in a folded section below it.
 */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});

  const STEPS = [
    { id: 'evidence', n: 1, name: 'Research', question: 'What do we already know?', what: 'Facts quoted from research papers and reports, each linked to its source.' },
    { id: 'discover', n: 2, name: 'People', question: 'Who does this affect, and what do they need?', what: 'The groups of people the problem hurts, and the needs the evidence points to.' },
    { id: 'ideate', n: 3, name: 'Ideas', question: 'How could we solve it?', what: 'Product ideas, each tied to a need and to the evidence for its claims.' },
    { id: 'evaluate', n: 4, name: 'Decide', question: 'Which idea should we build?', what: 'Every idea scored on the same criteria, so the choice is fair and easy to explain.' },
    { id: 'build', n: 5, name: 'Build', question: 'What will it take to build?', what: 'The features, the order to build them in, and the tools to build them with.' },
    { id: 'report', n: 6, name: 'Check', question: 'Can we trust it?', what: 'Every claim checked against its source, and a report you can share.' }
  ];
  const byId = (id) => STEPS.find((s) => s.id === id) || null;

  const plural = (n, one, many) => n + ' ' + (Number(n) === 1 ? one : (many || one + 's'));
  const clip = (s, n) => { const t = String(s || '').replace(/\s*\(E\d+(?:,\s*E\d+)*\)\.?$/, '').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const list = (xs) => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const fix2 = (x) => Number(x).toFixed(2);

  function evidence(p, ctx) {
    if (!p.findings.length) return { headline: 'No evidence yet.', points: ['Describe your problem on the Home page and ProductLab searches research papers for you.', 'Or add findings by hand in the details below.'], next: null };
    const strong = p.references.filter((r) => Number(r.strength) >= 3).length;
    const audit = PL.evidence.audit(p, ctx.index);
    const best = p.references.slice().sort((x, y) => (Number(y.strength) || 0) - (Number(x.strength) || 0) || (Number(y.year) || 0) - (Number(x.year) || 0))[0];
    const pts = [
      strong ? plural(strong, 'source is a review or guideline', 'sources are reviews or guidelines') + ', the strongest kind of evidence.' : 'Most sources are single studies. A review would make the case stronger.',
      best ? 'Strongest source: \u201c' + clip(best.title, 110).replace(/[.\s]+$/, '') + '\u201d' + (best.year ? ' (' + best.year + ')' : '') + '.' : null,
      audit.summary.evidenceTotal ? audit.summary.evidenceUsed + ' of ' + audit.summary.evidenceTotal + ' findings already back up a claim later in the project.' : null
    ].filter(Boolean);
    return { headline: plural(p.findings.length, 'fact', 'facts') + ' from ' + plural(p.references.length, 'source') + '.', points: pts, next: 'discover' };
  }

  function discover(p) {
    if (!p.needs.length) return { headline: 'No needs written yet.', points: ['Open the details below and use the opportunity miner: it groups the research into themes you can turn into needs.'], next: null };
    const top = p.needs.slice().sort((a, b) => Number(b.severity) - Number(a.severity)).slice(0, 2);
    const pts = top.map((n) => clip(String(n.statement).split(/\s+because\s+|;\s+/i)[0].replace(/[.\s]+$/, ''), 150) + '.');
    if (p.personas.length) pts.push('People: ' + list(p.personas.map((x) => x.name)) + '.');
    const who = p.personas.length ? ', felt by ' + plural(p.personas.length, 'kind of person', 'kinds of people') : '';
    return { headline: plural(p.needs.length, 'need') + who + '.', points: pts, next: 'ideate' };
  }

  function ideate(p) {
    if (!p.concepts.length) return { headline: 'No ideas yet.', points: ['Open the details below: ask the AI assistant, combine options in the idea box, or add your own.'], next: null };
    const pts = p.concepts.slice(0, 3).map((c) => c.name + (c.tagline ? ': ' + clip(c.tagline, 90) : ''));
    const covered = new Set(p.concepts.flatMap((c) => c.needs || []));
    const open = p.needs.filter((n) => !covered.has(n.id)).length;
    if (p.needs.length) pts.push(open ? plural(open, 'need has', 'needs have') + ' no idea yet.' : 'Every need has at least one idea.');
    return { headline: plural(p.concepts.length, 'idea') + ', each answering a need.', points: pts.slice(0, 4), next: 'evaluate' };
  }

  function evaluate(p) {
    const D = PL.decision;
    if (!p.concepts.length) return { headline: 'Nothing to decide yet.', points: ['Add ideas first, then score them here.'], next: 'ideate' };
    const full = (c) => p.criteria.every((k) => p.ratings[c.id] && p.ratings[c.id][k.id] && p.ratings[c.id][k.id].value !== '' && p.ratings[c.id][k.id].value != null);
    const unrated = p.concepts.filter((c) => !full(c));
    if (unrated.length === p.concepts.length) return { headline: 'Score each idea to find the winner.', points: ['Open the details below and give every idea a score from 1 to 5 on each criterion.', 'Add a short reason with each score so others can follow it.'], next: null };
    if (unrated.length) {
      const scored = p.concepts.filter(full);
      const lead = D.wdm(scored, p.criteria, p.ratings)[0];
      return {
        headline: plural(unrated.length, 'idea still needs', 'ideas still need') + ' scores.',
        points: ['Not scored yet: ' + unrated.slice(0, 3).map((c) => c.name).join(', ') + (unrated.length > 3 ? ' and ' + (unrated.length - 3) + ' more' : '') + '.',
          'Among the ideas already scored, ' + lead.name + ' leads at ' + fix2(lead.total) + ' out of 5.',
          'Open the details below and score the new ideas so the ranking covers all of them.'],
        next: null
      };
    }
    const ranked = D.wdm(p.concepts, p.criteria, p.ratings);
    const top = ranked[0]; const second = ranked[1];
    const pts = [];
    if (second) pts.push(fix2(top.total - second.total) + ' points ahead of ' + second.name + ' (' + fix2(second.total) + ').');
    if (ranked.length > 1) {
      const flips = D.sensitivity(p.concepts, p.criteria, p.ratings).filter((s) => s.flip).map((s) => Math.abs(Math.round(s.flip.delta * 100)));
      pts.push(flips.length ? 'A ' + Math.min(...flips) + '-point change in one weight would change the winner, so check the weights you care about.' : 'No single change of weight changes the winner. The choice is robust.');
    }
    const risk = (p.risks || []).slice().sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)[0];
    const end = (t) => t.replace(/[.\s]+$/, '') + '.';
    if (risk) pts.push(end('Biggest risk: ' + end(clip(risk.failure, 80).toLowerCase()) + ' Plan: ' + clip(risk.mitigation, 110).replace(/^./, (c) => c.toLowerCase())));
    return { headline: top.name + ' comes out on top, at ' + fix2(top.total) + ' out of 5.', points: pts, next: 'build' };
  }

  function build(p, ctx) {
    const P = PL.planning;
    const sel = p.concepts.find((c) => c.id === p.selectedConcept);
    if (!sel) return { headline: 'Choose an idea to plan.', points: ['Pick the winning idea in Decide, then come back here.'], next: 'evaluate' };
    if (!p.features.length) return { headline: 'No features planned for ' + sel.name + ' yet.', points: ['Open the details below and press Re-plan, or add features by hand.'], next: null };
    const rows = P.prioritize(p, ctx.index);
    const sched = P.schedule(p, { priority: rows.map((r) => r.feature.id) });
    const must = (sched.phases[0] && sched.phases[0].tasks.length) || 0;
    const weeks = Math.ceil(sched.mvpWeeks || sched.totalWeeks || 0);
    const stack = P.recommendStack(p.constraints || {});
    const pick = (layer) => ((stack.find((s) => s.layer === layer) || {}).choice || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const tools = [pick('Client'), pick('Backend')].filter(Boolean);
    const pts = ['Build first: ' + list(rows.slice(0, 3).map((r) => r.feature.name)) + '.'];
    if (tools.length) pts.push('Built with ' + list(tools) + ', chosen to suit your team and budget.');
    pts.push('Planned for a team of ' + sched.settings.teamSize + ' working in ' + sched.settings.sprintWeeks + '-week sprints.');
    return { headline: 'A first version of ' + sel.name + ': ' + plural(must, 'must-have feature') + (weeks ? ' in about ' + plural(weeks, 'week') : '') + '.', points: pts, next: 'report' };
  }

  function report(p, ctx) {
    const a = PL.evidence.audit(p, ctx.index);
    if (!a.summary.total) return { headline: 'Nothing to check yet.', points: ['Claims appear here once needs, ideas and scores cite evidence.'], next: null };
    const s = a.items.reduce((m, i) => { const k = (i.result && i.result.status) || 'missing'; m[k] = (m[k] || 0) + 1; return m; }, {});
    const weak = Object.entries(a.summary.byGroup || {}).filter(([, g]) => g.total).map(([k, g]) => [k, g.traced / g.total]).sort((x, y) => x[1] - y[1])[0];
    const flagged = a.summary.total - (s.supported || 0) - (s.partial || 0);
    const pts = [(s.supported || 0) + ' fully backed, ' + (s.partial || 0) + ' partly backed, ' + flagged + ' worth a second look.'];
    if (weak && weak[1] < 1) pts.push('Weakest part: ' + weak[0].toLowerCase() + ' (' + Math.round(weak[1] * 100) + '% backed). Start your review there.');
    pts.push('A full report with IEEE references is ready to print or download.');
    return { headline: Math.round(a.summary.traceability * 100) + '% of claims are backed by the source they cite.', points: pts, next: 'story' };
  }

  const SUMMARY = { evidence, discover, ideate, evaluate, build, report };

  function summary(route, ctx) {
    const f = SUMMARY[route];
    if (!f || !ctx.project) return null;
    try { return f(ctx.project, ctx); } catch (e) { console.error(e); return null; }
  }

  PL.guide = { STEPS, byId, summary, clip };
  if (typeof module === 'object' && module.exports) module.exports = PL.guide;
})(typeof globalThis !== 'undefined' ? globalThis : this);
