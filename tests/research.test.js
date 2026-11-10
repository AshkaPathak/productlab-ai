const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/engine/research.js');

// Synthetic fixtures shaped like real API responses (content is invented for testing only).
function inverted(text) {
  const inv = {};
  text.split(' ').forEach((w, i) => { (inv[w] = inv[w] || []).push(i); });
  return inv;
}
const ABSTRACT = 'Background: saving content is common. We conducted an online survey of 412 students. ' +
  'Results showed that 68% of respondents rarely revisited posts they had saved on social media. ' +
  'Participants reported feeling overwhelmed by the number of saved items across apps. ' +
  'Saved posts were spread across an average of three platforms per participant. ' +
  'Copyright 2024 the authors.';
const OPENALEX_RESPONSE = {
  results: [
    { id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1234/test.1', display_name: 'Saving behaviour on social media: a survey', publication_year: 2024,
      authorships: [{ author: { display_name: 'A. Researcher' } }, { author: { display_name: 'B. Scholar' } }],
      primary_location: { source: { display_name: 'Journal of Testing' }, landing_page_url: 'https://example.org/1' },
      biblio: { volume: '12', issue: '3', first_page: '10', last_page: '20' }, cited_by_count: 5, type: 'article', abstract_inverted_index: inverted(ABSTRACT) },
    { id: 'https://openalex.org/W2', doi: null, display_name: 'A systematic review of digital hoarding', publication_year: 2023, authorships: [],
      primary_location: { source: { display_name: 'Review Journal' } }, biblio: {}, cited_by_count: 50, type: 'review',
      abstract_inverted_index: inverted('Digital hoarding is the excessive accumulation of digital files. Across 20 studies, hoarding was associated with stress and reduced productivity among users of social media and cloud storage services.') },
    { id: 'https://openalex.org/W3', display_name: 'Too short', abstract_inverted_index: inverted('Short abstract.') }
  ]
};

test('reconstructAbstract restores word order', () => {
  assert.equal(R.reconstructAbstract({ world: [1], hello: [0], '!': [2] }), 'hello world!');
  assert.equal(R.reconstructAbstract(null), '');
});

test('splitSentences keeps decimals intact', () => {
  assert.deepEqual(R.splitSentences('Rates were 12.1% overall. Women aged 18-40 took part.'), ['Rates were 12.1% overall.', 'Women aged 18-40 took part.']);
});

test('searchOpenAlex builds the request and normalises works', async () => {
  let url;
  const fake = async (u) => { url = u; return { ok: true, json: async () => OPENALEX_RESPONSE }; };
  const works = await R.searchOpenAlex('saved posts social media', { fetch: fake, perPage: 5 });
  assert.match(url, /^https:\/\/api\.openalex\.org\/works\?search=saved\+posts\+social\+media/);
  assert.match(url, /filter=has_abstract%3Atrue/);
  assert.equal(works.length, 2, 'drops works with very short abstracts');
  assert.equal(works[0].doi, '10.1234/test.1');
  assert.equal(works[0].pages, '10-20');
  assert.equal(works[0].strength, 2);
  assert.equal(works[1].strength, 3, 'systematic reviews are strength 3');
});

test('searchOpenAlex explains rate limits', async () => {
  const fake = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(R.searchOpenAlex('x', { fetch: fake }), /daily limit/);
});

test('extractFindings picks verbatim result sentences, not methods or copyright', async () => {
  const works = OPENALEX_RESPONSE.results.slice(0, 2).map(R.normalizeWork);
  const f = R.extractFindings(works, 'People save posts on social media but rarely revisit them and feel overwhelmed', { perWork: 2 });
  assert.ok(f.length >= 2);
  f.forEach((x) => assert.ok(works[x.refIndex].abstract.includes(x.text), 'verbatim'));
  assert.ok(f.some((x) => /68% of respondents/.test(x.text)));
  assert.ok(!f.some((x) => /We conducted|Copyright/.test(x.text)));
  assert.equal(f.find((x) => /68%/.test(x.text)).kind, 'statistic');
});

test('webResearch keeps only grounded segments with sources', async () => {
  const reply = {
    candidates: [{
      content: { parts: [{ text: '- Instagram lets users save posts into collections.\n- Ungrounded claim here with no source at all.' }] },
      groundingMetadata: {
        webSearchQueries: ['instagram saved posts collections'],
        groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/redirect/abc', title: 'help.instagram.com' } }],
        groundingSupports: [
          { segment: { startIndex: 0, endIndex: 52, text: '- Instagram lets users save posts into collections.' }, groundingChunkIndices: [0] },
          { segment: { text: 'Too short' }, groundingChunkIndices: [0] }
        ]
      }
    }]
  };
  let body;
  const fake = async (u, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => reply }; };
  const r = await R.webResearch('organising saved posts', { provider: 'gemini', apiKey: 'k', model: 'gemini-x' }, { fetch: fake });
  assert.deepEqual(body.tools, [{ google_search: {} }]);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].text, 'Instagram lets users save posts into collections.');
  assert.equal(r.sources[0].org, 'help.instagram.com');
  await assert.rejects(R.webResearch('x', { provider: 'openai', apiKey: 'k' }), /Gemini/);
});

test('aims, questions and method lines from the live run are not counted as findings', () => {
  const notFindings = [
    'We sought to understand what is known about the management of student mental health, and asked: (1) What proportion of students use mental health services when experiencing psychological distress?',
    '(2) Does use by students differ across health service types?',
    'The purpose of the present study was to better understand why Canadian students are not seeking on campus support for psychological issues.',
    'Conclusion: This 12-week randomized controlled trial systematically evaluated the effects of Tai Chi on stress and sleep quality in college students.',
    'Levels of stress, sleep functioning and sleep catastrophising were examined over a seven-day period in 48 Access to Higher Education students about to take an exam and 44 non-exam taking controls.'
  ];
  notFindings.forEach((s) => assert.equal(R.isFinding(s), false, s));
  const findings = [
    'Exam stress significantly impacts college students\' sleep patterns, dietary choices, and coping mechanisms.',
    'RESULTS: We found that perceived stress and mental distress increased from the time before the exams to the exam period.',
    'College students are experiencing substantially more mental health issues, although use of counselling services remains low.',
    'Participants were surveyed in 2024 and 62% reported poor sleep, which was significantly associated with exam anxiety.'
  ];
  findings.forEach((s) => assert.equal(R.isFinding(s), true, s));
});

test('the word-match check drops a paper on an unrelated topic', () => {
  const works = [
    { title: 'Exam stress and sleep quality in university students', abstract: 'Exam stress reduced sleep quality among university students during the exam period.' },
    { title: 'Use of campus counselling services by students', abstract: 'Students under exam stress rarely used campus counselling services for sleep or stress.' },
    { title: 'Digital sleep interventions for college students', abstract: 'Digital interventions improved sleep and reduced stress in college students.' },
    { title: 'Corrosion of steel reinforcement in coastal bridges', abstract: 'Chloride exposure accelerated corrosion of reinforcing steel in concrete bridge decks.' }
  ];
  const keep = R.screenWorks(works, 'College students struggle with exam stress and sleep and do not use campus counselling');
  assert.ok(keep.indexOf(3) < 0, 'the bridge paper is left out');
  assert.equal(keep.length, 3);
});
