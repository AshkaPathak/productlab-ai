'use strict';
// Story themes: picked from the project's subject, overridable, and complete.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../js/app/theme.js');

test('themes match the project subject', () => {
  assert.equal(T.pick(require('../js/data/pcos.js')()), 'bloom');
  assert.equal(T.pick(require('../js/data/foodwaste.js')()), 'harvest');
  assert.equal(T.pick({ domain: 'Digital wellbeing', name: 'Saved Posts Organiser' }), 'signal');
  assert.equal(T.pick({ name: 'Exam stress on campus', challenge: 'College students struggle to sleep' }), 'campus');
  assert.equal(T.pick({ name: 'Untitled' }), 'lab');
  assert.equal(T.pick(null), 'lab');
});

test('a chosen theme overrides the automatic match', () => {
  assert.equal(T.pick({ domain: 'Women’s health', theme: 'ocean' }), 'ocean');
  assert.equal(T.pick({ domain: 'Women’s health', theme: 'auto' }), 'bloom');
  assert.equal(T.pick({ domain: 'Women’s health', theme: 'nonsense' }), 'bloom');
});

test('every theme sets the same colour slots', () => {
  const ids = Object.keys(T.THEMES).filter((id) => id !== 'lab');
  const keys = Object.keys(T.THEMES[ids[0]].vars).sort().join();
  ids.forEach((id) => {
    const t = T.THEMES[id];
    assert.equal(Object.keys(t.vars).sort().join(), keys, id + ' sets every page colour');
    ['think', 'build', 'deep', 'soft', 'spark'].forEach((k) => assert.equal(t.tones[k].length, 3, id + ' tone ' + k));
    ['think', 'build'].forEach((k) => assert.equal(t.liquid[k].length, 2, id + ' liquid ' + k));
  });
});
