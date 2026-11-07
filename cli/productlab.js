#!/usr/bin/env node
/*
 * ProductLab AI - command-line interface
 * Runs the same engine as the web app on a project file, so results can be
 * reproduced and quoted in a paper.
 *
 *   node cli/productlab.js audit   <project.json | pcos | foodwaste>
 *   node cli/productlab.js rank    <project>
 *   node cli/productlab.js roadmap <project>
 *   node cli/productlab.js report  <project> [--out report.md]
 *   node cli/productlab.js sample  <pcos | foodwaste> <out.json>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../js/engine/evidence.js');
const D = require('../js/engine/decision.js');
const P = require('../js/engine/planning.js');
const R = require('../js/engine/report.js');

const SAMPLES = { pcos: '../js/data/pcos.js', foodwaste: '../js/data/foodwaste.js' };

function load(arg) {
  if (!arg) fail('Missing project: give a .json file exported from the app, or "pcos" / "foodwaste".');
  if (SAMPLES[arg]) return require(SAMPLES[arg])();
  const file = path.resolve(arg);
  if (!fs.existsSync(file)) fail('File not found: ' + file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data.projects) ? data.projects[0] : data;
}

function fail(msg) { console.error('Error: ' + msg); process.exit(1); }
const pct = (x) => (x * 100).toFixed(1) + '%';
const pad = (s, n) => String(s).padEnd(n);

function audit(p) {
  const a = E.audit(p);
  const s = a.summary;
  console.log('Traceability audit: ' + p.name);
  console.log('  claims checked        ' + s.total);
  console.log('  supported             ' + s.supported);
  console.log('  partially supported   ' + s.partial);
  console.log('  not supported         ' + s.unsupported);
  console.log('  cites missing evidence ' + s.invalid);
  console.log('  uncited               ' + s.uncited);
  console.log('  TRACEABILITY INDEX    ' + pct(s.traceability));
  console.log('  evidence coverage     ' + s.evidenceUsed + '/' + s.evidenceTotal);
  console.log('\nBy section:');
  Object.keys(s.byGroup).forEach((g) => console.log('  ' + pad(g, 14) + s.byGroup[g].traced + '/' + s.byGroup[g].total));
  const probs = a.items.filter((i) => !['supported', 'partial'].includes(i.result.status));
  if (probs.length) {
    console.log('\nClaims to review:');
    probs.forEach((i) => console.log('  [' + i.result.status + '] ' + i.group + ' / ' + i.label + ': ' + i.text.slice(0, 100)));
  }
}

function rank(p) {
  const r = D.wdm(p.concepts, p.criteria, p.ratings);
  const w = D.normalizeWeights(p.criteria);
  console.log('Weighted decision matrix (weights: ' + p.criteria.map((c, i) => c.name + ' ' + Math.round(w[i] * 100) + '%').join(', ') + ')');
  r.forEach((x) => console.log('  ' + x.rank + '. ' + pad(x.name, 30) + x.total.toFixed(2)));
  console.log('\nOne-at-a-time sensitivity:');
  D.sensitivity(p.concepts, p.criteria, p.ratings).forEach((s) => console.log('  ' + pad(s.name, 14) + (s.flip ? 'winner becomes ' + s.flip.newWinnerName + ' at ' + pct(s.flip.at) + ' (' + (s.flip.delta > 0 ? '+' : '') + (s.flip.delta * 100).toFixed(1) + ' pts)' : 'no change across 0-100%')));
  console.log('\nMonte Carlo (2000 runs, weights +/-30%, seed 42):');
  D.monteCarlo(p.concepts, p.criteria, p.ratings, { runs: 2000, spread: 0.3, seed: 42 }).forEach((m) => console.log('  ' + pad(m.name, 30) + 'wins ' + pct(m.winRate) + ', mean rank ' + m.meanRank.toFixed(2)));
}

function roadmap(p) {
  const idx = E.buildIndex(p);
  const pr = P.prioritize(p, idx);
  console.log('Evidence-adjusted RICE:');
  pr.forEach((r) => console.log('  ' + pad(r.rank + '.', 4) + pad(r.feature.name, 40) + pad(r.feature.moscow || r.suggestedMoscow, 8) + 'RICE ' + r.raw.toFixed(1).padStart(6) + '  adjusted ' + r.adjusted.toFixed(1).padStart(6) + '  evidence ' + pct(r.evidence)));
  const s = P.schedule(p, { priority: pr.map((r) => r.feature.id) });
  console.log('\nSchedule (team ' + s.settings.teamSize + ', focus ' + s.settings.focus + ', buffer ' + s.settings.buffer + ', ' + s.settings.sprintWeeks + '-week sprints):');
  s.tasks.forEach((t) => console.log('  ' + pad(t.name, 40) + 'weeks ' + t.start.toFixed(1).padStart(5) + ' - ' + t.end.toFixed(1).padStart(5) + '  (' + t.moscow + ')'));
  s.phases.forEach((ph) => console.log('  ' + pad(ph.name, 22) + ph.tasks.length + ' features, done by week ' + Math.ceil(ph.weeks)));
  if (s.cyclic.length) console.log('  WARNING dependency cycle: ' + s.cyclic.join(', '));
}

const [cmd, arg, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'audit': audit(load(arg)); break;
  case 'rank': rank(load(arg)); break;
  case 'roadmap': roadmap(load(arg)); break;
  case 'report': {
    const md = R.build(load(arg));
    const i = rest.indexOf('--out');
    if (i >= 0 && rest[i + 1]) { fs.writeFileSync(rest[i + 1], md); console.log('Report written to ' + rest[i + 1]); } else process.stdout.write(md);
    break;
  }
  case 'sample': {
    if (!SAMPLES[arg] || !rest[0]) fail('Usage: sample <pcos|foodwaste> <out.json>');
    fs.writeFileSync(rest[0], JSON.stringify(load(arg), null, 2));
    console.log('Wrote ' + rest[0]);
    break;
  }
  default:
    console.log('ProductLab AI CLI\n\nUsage:\n  node cli/productlab.js audit   <project.json|pcos|foodwaste>\n  node cli/productlab.js rank    <project>\n  node cli/productlab.js roadmap <project>\n  node cli/productlab.js report  <project> [--out report.md]\n  node cli/productlab.js sample  <pcos|foodwaste> <out.json>');
}
