/*
 * Mock OpenAlex + Gemini endpoints for offline tests of the autopilot.
 * All content here is synthetic test data, not real research.
 */
'use strict';

function inverted(text) {
  const inv = {};
  text.split(' ').forEach((w, i) => { (inv[w] = inv[w] || []).push(i); });
  return inv;
}

const PAPERS = [
  { title: 'Save now, read never? A survey of social media saving', abstract: 'We conducted a survey of 500 university students. Results showed that 70% of respondents rarely revisited posts they saved on social media. Most participants saved posts on three or more platforms and could not remember where an item was saved. Respondents reported stress when their saved lists grew large.' },
  { title: 'Personal information management of bookmarks: a systematic review', abstract: 'This review covers 30 studies of bookmarking. Users filed bookmarks inconsistently and folders became hard to navigate over time. Search was the most common way people found saved items again, but keyword search failed when users forgot the title.' },
  { title: 'Digital hoarding and wellbeing in young adults', abstract: 'Digital hoarding was associated with anxiety and difficulty deleting saved content among 300 young adults. Participants feared losing something they might need later, which made them keep saved posts indefinitely.' }
];

function openAlexResponse() {
  return {
    results: PAPERS.map((p, i) => ({
      id: 'https://openalex.org/W9' + i, doi: 'https://doi.org/10.9999/mock.' + i, display_name: p.title, publication_year: 2023 + (i % 2),
      authorships: [{ author: { display_name: 'Test Author ' + (i + 1) } }], primary_location: { source: { display_name: 'Mock Journal' } },
      biblio: { volume: '1', issue: String(i + 1), first_page: '1', last_page: '9' }, cited_by_count: 3, type: i === 1 ? 'review' : 'article',
      abstract_inverted_index: inverted(p.abstract)
    }))
  };
}

function grounded() {
  const text = '- Instagram lets users organise saved posts into private collections.\n- YouTube offers a Watch Later playlist for saved videos.';
  return {
    candidates: [{
      content: { parts: [{ text }] },
      groundingMetadata: {
        webSearchQueries: ['instagram saved posts collections'],
        groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/a', title: 'help.instagram.com' } }, { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/b', title: 'support.google.com' } }],
        groundingSupports: [
          { segment: { text: '- Instagram lets users organise saved posts into private collections.' }, groundingChunkIndices: [0] },
          { segment: { text: '- YouTube offers a Watch Later playlist for saved videos.' }, groundingChunkIndices: [1] }
        ]
      }
    }]
  };
}

function jsonFor(prompt) {
  if (/"queries": 3 or 4/.test(prompt)) return { name: 'Saved Posts Organiser', domain: 'Digital wellbeing', challenge: 'People save posts across apps and cannot find them later.', hmw: 'How might we help people find and use what they save?', queries: ['social media saving behaviour', 'bookmark retrieval', 'digital hoarding young adults'] };
  if (/"needs": 4-7/.test(prompt)) return {
    needs: [
      { statement: 'Users need to find a saved post again without remembering where they saved it.', severity: 5, evidence: ['E2', 'E3'] },
      { statement: 'Users need to revisit saved posts instead of letting them pile up.', severity: 4, evidence: ['E1'] },
      { statement: 'Users need help deleting saved content without anxiety.', severity: 4, evidence: ['E5', 'E6'] }
    ],
    personas: [{ name: 'The serial saver', role: 'Student who saves posts daily', goals: ['Use what she saves'], pains: [{ text: 'Rarely revisits the posts she saves', evidence: ['E1'] }] }],
    glossary: [['save', 'saved', 'bookmark'], ['find', 'revisit', 'retrieve']],
    competitors: [{ name: 'Instagram collections', category: 'In-app saving', x: 2, y: 3, strengths: 'Built in', gaps: 'Only works inside Instagram', evidence: ['E7'] }]
  };
  if (/Zwicky box/.test(prompt)) return { params: [
    { name: 'Capture', options: [{ label: 'Share sheet', hint: 'save from any app' }, { label: 'Account sync', hint: 'sync platforms' }, { label: 'Screenshot', hint: 'image text' }] },
    { name: 'Find', options: [{ label: 'Folders', hint: 'folders' }, { label: 'Search', hint: 'search find saved' }, { label: 'Auto topics', hint: 'automatic topics' }] }
  ], rules: [{ a: [0, 2], b: [1, 0], reason: 'Screenshots cannot be filed into folders automatically' }] };
  if (/Generate 4 distinct product concepts/.test(prompt)) return { concepts: [
    { name: 'SaveHub', tagline: 'One inbox for saves', description: 'Collect saves from every app in one searchable place.', needs: ['N1'], claims: [{ text: 'Users save posts on three or more platforms and cannot remember where an item was saved', evidence: ['E2'] }, { text: '90% of users want badges', evidence: ['E99'] }] },
    { name: 'Revisit', tagline: 'Weekly digest', description: 'A weekly digest of saved posts.', needs: ['N2'], claims: [{ text: '70% of respondents rarely revisited posts they saved', evidence: ['E1'] }] }
  ] };
  if (/Score each concept/.test(prompt)) return { ratings: {
    C1: { desirability: { value: 4.6, note: 'Saves are scattered across platforms', evidence: ['E2'] }, feasibility: 3.5, viability: 3.8, impact: 4.2, novelty: 3.6 },
    C2: { desirability: { value: 4.0, note: 'People rarely revisit saves', evidence: ['E1'] }, feasibility: 4.4, viability: 3.4, impact: 3.8, novelty: 3.5 }
  }, risks: [{ failure: 'Platforms block access to saved posts', cause: 'No public API', likelihood: 4, impact: 5, mitigation: 'Use the share sheet', evidence: [] }] };
  if (/minimum viable product/.test(prompt)) return {
    features: [
      { name: 'Share-sheet capture', description: 'Save from any app', rationale: 'Saves are spread over three or more platforms', evidence: ['E2'], needs: ['N1'], reach: 100, impact: 3, confidence: 80, effort: 3, moscow: 'Must', dependsOn: [] },
      { name: 'Search across saves', description: 'Find by keyword', rationale: 'Search is the most common way people find saved items again', evidence: ['E4'], needs: ['N1'], reach: 90, impact: 2, confidence: 70, effort: 3, moscow: 'Must', dependsOn: ['Share-sheet capture'] },
      { name: 'Weekly digest', description: 'Resurface saves', rationale: 'Most saved posts are rarely revisited', evidence: ['E1'], needs: ['N2'], reach: 70, impact: 2, confidence: 60, effort: 2, moscow: 'Should', dependsOn: ['Share-sheet capture'] }
    ],
    constraints: { platform: 'mobile', offline: true, sensitiveData: false, ai: 'rules', wearables: false, realtime: false, budget: 'low', expectedUsers: 5000, region: 'India' },
    bmc: { customerSegments: 'Students and young professionals', valuePropositions: 'Find what you saved' }
  };
  return {};
}

/** A fetch() replacement that routes to the right mock. calls[] records every URL. */
function makeFetch(options) {
  const o = Object.assign({ failOpenAlex: false }, options || {});
  const calls = [];
  const f = async (url, init) => {
    calls.push(url);
    if (url.startsWith('https://api.openalex.org/')) {
      if (o.failOpenAlex) return { ok: false, status: 429, json: async () => ({}) };
      return { ok: true, json: async () => openAlexResponse() };
    }
    if (/generateContent$/.test(url)) {
      const body = JSON.parse(init.body);
      if (body.tools) return { ok: true, json: async () => grounded() };
      const prompt = body.contents.map((c) => c.parts.map((p) => p.text).join('')).join('\n');
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(jsonFor(prompt)) }] } }] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  f.calls = calls;
  return f;
}

module.exports = { makeFetch, PAPERS };
