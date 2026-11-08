'use strict';
// Every figure renders for both seed projects and for a sparse project, without throwing.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const load = (f) => require(path.join(__dirname, '..', f));
const PL = (globalThis.PL = globalThis.PL || {});
Object.assign(PL, {
  text: load('js/engine/text.js'), evidence: load('js/engine/evidence.js'), cluster: load('js/engine/cluster.js'),
  ideation: load('js/engine/ideation.js'), decision: load('js/engine/decision.js'), planning: load('js/engine/planning.js')
});
PL.seeds = { pcos: load('js/data/pcos.js')(), foodwaste: load('js/data/foodwaste.js')() };
['js/app/util.js', 'js/app/components.js', 'js/app/figures.js'].forEach(load);

function figuresFor(p) {
  p = Object.assign({ references: [], findings: [], needs: [], personas: [], concepts: [], criteria: [], ratings: {}, features: [], risks: [], competitors: [], morph: { params: [], rules: [] }, constraints: {} }, p);
  const index = PL.evidence.buildIndex(p);
  const F = PL.fig; const D = PL.decision; const P = PL.planning;
  const ranked = p.concepts.length ? D.wdm(p.concepts, p.criteria, p.ratings) : [];
  const rows = P.prioritize(p, index);
  return [
    F.sourceMap(p), F.evidenceUse(p), F.needsMap(p, index), F.themeBubbles(PL.cluster.themes(p, index, { threshold: 0.12 }), p.findings),
    F.coverage(p), F.morphPath(p.morph.params, {}, PL.ideation.optLabel), F.radar(p, ranked),
    p.concepts.length > 1 ? F.tornado(D.sensitivity(p.concepts, p.criteria, p.ratings)) : '',
    F.riceBubbles(rows), F.stackDiagram(P.recommendStack(p.constraints || {})), F.claimWaffle(PL.evidence.audit(p, index))
  ];
}

test('figures render for the seed projects', () => {
  const seeds = Object.values(PL.seeds || {}).filter((s) => s && s.findings);
  assert.equal(seeds.length, 2, 'both seed projects available');
  seeds.forEach((s) => {
    const out = figuresFor(JSON.parse(JSON.stringify(s)));
    out.forEach((html) => { assert.equal(typeof html, 'string'); assert.ok(!/undefined|NaN/.test(html), 'no undefined or NaN in markup'); });
    assert.ok(out.filter(Boolean).length >= 6, 'most figures have content');
  });
});

test('concept marks never fail, whatever the name', () => {
  ['CycleSync AI', '', 'x', 'Ünïcødé ✓', 'A'.repeat(200)].concat(Array.from({ length: 300 }, (_, i) => 'Idea ' + i * 7919)).forEach((n) => {
    const svg = PL.fig.conceptMark(n, 0.5);
    assert.ok(svg.startsWith('<svg') && !/undefined|NaN/.test(svg));
  });
});

test('figures stay empty rather than failing on an empty project', () => {
  figuresFor({}).forEach((html) => assert.ok(typeof html === 'string' && !/undefined|NaN/.test(html)));
});
