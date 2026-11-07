const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/engine/text.js');

test('normalize keeps decimals and percentages, drops punctuation', () => {
  assert.equal(T.normalize('PCOS affects 12.1% of women.'), 'pcos affects 12.1% of women');
  assert.equal(T.normalize("Women's health, e.g. PCOS!"), 'womens health e g pcos');
});

test('stem folds common inflections to the same root', () => {
  assert.equal(T.stem('diagnosed'), T.stem('diagnosis'));
  assert.equal(T.stem('apps'), 'app');
  assert.equal(T.stem('studies'), 'study');
  assert.equal(T.stem('12.1%'), '12.1%');
});

test('tokenize removes stopwords and applies synonyms', () => {
  const syn = T.buildSynonymMap([['period', 'menstrual', 'cycle']]);
  const toks = T.tokenize('Irregular menstrual cycles are common', syn);
  assert.deepEqual(toks, ['irregular', 'period', 'period', 'common']);
});

test('cosine of identical texts is 1 and of disjoint texts is 0', () => {
  const c = new T.Corpus([
    { id: 'a', text: 'delayed diagnosis of PCOS' },
    { id: 'b', text: 'food waste in hostel mess' }
  ]);
  assert.ok(Math.abs(T.cosine(c.vector('a'), c.vectorize('delayed diagnosis of PCOS')) - 1) < 1e-9);
  assert.equal(T.cosine(c.vector('a'), c.vector('b')), 0);
});

test('search ranks the most relevant document first', () => {
  const c = new T.Corpus([
    { id: 'e1', text: 'Women waited more than two years for a PCOS diagnosis' },
    { id: 'e2', text: 'Lifestyle intervention may reduce weight and BMI' },
    { id: 'e3', text: 'Apps lack evidence-based information' }
  ]);
  const hits = c.search('how long does diagnosis take', 3);
  assert.equal(hits[0].id, 'e1');
});

test('topTerms returns the heaviest terms of a vector', () => {
  const c = new T.Corpus([{ id: 'x', text: 'privacy privacy consent data' }, { id: 'y', text: 'data' }]);
  assert.equal(T.topTerms(c.vector('x'), 1)[0], 'privacy');
});
