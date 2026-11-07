/*
 * Case study 2: Food waste in university hostel messes (India).
 * A smaller starter case that shows the workflow is domain-independent.
 * Global figures come from UNEP; campus figures come from an institutional
 * report and a student-media estimate (weaker sources, marked strength 1).
 * Ratings and RICE inputs are illustrative and should be replaced by the team.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.PL = root.PL || {}; root.PL.cases = root.PL.cases || {}; root.PL.cases.foodwaste = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const references = [
    { id: 'R1', type: 'report', strength: 3, org: 'United Nations Environment Programme', title: 'Food Waste Index Report 2024. Think Eat Save: Tracking Progress to Halve Global Food Waste', venue: 'UNEP, Nairobi', year: 2024, url: 'https://wedocs.unep.org/bitstream/handle/20.500.11822/45275/Food-Waste-Index-2024-key-messages.pdf' },
    { id: 'R2', type: 'report', strength: 1, org: 'Amrita Vishwa Vidyapeetham', title: 'Campus food waste tracking at Amrita Vishwa Vidyapeetham', venue: 'Institutional sustainability report', year: 2025, url: 'https://webfiles.amrita.edu/2025/10/campus-food-waste-tracking-at-amrita-vishwa-vidyapeetham.pdf' },
    { id: 'R3', type: 'news', strength: 1, org: 'Insight, IIT Bombay student media', title: 'Insight Flagship Print Edition 18.2', venue: 'Insight IIT Bombay', accessed: '2026-11-07', url: 'https://issuu.com/insightiitbombay/docs/18.2/6' }
  ];

  const findings = [
    { id: 'E1', ref: 'R1', kind: 'statistic', locator: 'Key messages', tags: ['global', 'food waste'], text: 'In 2022 the world wasted 1.05 billion tonnes of food: 132 kg per person and almost one-fifth (19%) of all food available to consumers.' },
    { id: 'E2', ref: 'R1', kind: 'statistic', locator: 'Key messages', tags: ['households', 'food service', 'retail'], text: 'Households generated 631 million tonnes of food waste, food service 290 million tonnes and retail 131 million tonnes in 2022.' },
    { id: 'E3', ref: 'R1', kind: 'statistic', locator: 'Country estimates', tags: ['household', 'india', 'per capita'], text: 'Average household food waste is 79 kg per person per year; the estimate for India is 55 kg per person per year.' },
    { id: 'E4', ref: 'R1', kind: 'insight', locator: 'Key messages', tags: ['income', 'household'], text: 'Household food waste differs by only 7 kg per person between high, upper-middle and lower-middle income countries, so food waste is not only a rich-country problem.' },
    { id: 'E5', ref: 'R1', kind: 'insight', locator: 'Key messages', tags: ['temperature', 'cold chain', 'fresh food'], text: 'Hotter countries appear to have more household food waste per person, possibly due to fresh foods with inedible parts and a lack of robust cold chains.' },
    { id: 'E6', ref: 'R2', kind: 'statistic', locator: 'Quantitative results', tags: ['campus', 'mess', 'measurement', 'per capita'], text: 'At one Indian university campus, each of the two main messes generated about 120-135 kg of food waste per day (about 2,800-3,000 meals), or 40-48 grams per person per day.' },
    { id: 'E7', ref: 'R2', kind: 'insight', locator: 'Findings', tags: ['kitchen', 'over-cooking', 'attendance', 'forecast'], text: 'Kitchen staff prepared extra meals as a buffer for unexpected student turnout, which led to surplus food.' },
    { id: 'E8', ref: 'R2', kind: 'insight', locator: 'Recommendations', tags: ['portion size', 'plate waste', 'biogas', 'composting'], text: 'The campus report recommends portion size options (small, medium, large) to reduce plate waste and more biogas and composting capacity.' },
    { id: 'E9', ref: 'R3', kind: 'statistic', locator: 'Article', tags: ['hostel', 'plate waste', 'students', 'mess'], text: 'A student-media estimate at IIT Bombay put hostel mess food waste at 0.10-0.16 kg per student per day, with student plate waste exceeding caterers’ leftovers in almost every hostel.' }
  ];

  const needs = [
    { id: 'N1', severity: 5, statement: 'Mess managers need to know how many students will eat each meal so they stop cooking extra food as a buffer.', evidence: ['E7'] },
    { id: 'N2', severity: 4, statement: 'Students need portion choices that match their appetite to cut plate waste.', evidence: ['E8', 'E9'] },
    { id: 'N3', severity: 3, statement: 'Campuses need routine food waste measurement per meal and per person to track progress.', evidence: ['E6', 'E1'] },
    { id: 'N4', severity: 3, statement: 'Unavoidable food waste needs a productive use such as composting or biogas.', evidence: ['E8'] }
  ];

  const morph = {
    params: [
      { id: 'user', name: 'Primary user', options: [{ label: 'Students', hint: 'students plate portion appetite' }, { label: 'Mess managers', hint: 'mess kitchen staff cooking attendance' }, { label: 'Sustainability office', hint: 'campus measurement waste tracking' }] },
      { id: 'when', name: 'Intervention point', options: [{ label: 'Before cooking (forecast)', hint: 'forecast attendance before cooking buffer surplus' }, { label: 'At serving (portion)', hint: 'portion size serving plate' }, { label: 'After the meal (measure)', hint: 'measure food waste per meal per person composting biogas' }] },
      { id: 'tech', name: 'Technology', options: [{ label: 'Mobile app', hint: 'students app opt-in meal' }, { label: 'Smart scale / kiosk', hint: 'scale weight measurement plate waste' }, { label: 'Web dashboard', hint: 'dashboard tracking progress campus' }] },
      { id: 'incentive', name: 'Incentive', options: [{ label: 'Feedback only', hint: 'feedback awareness' }, { label: 'Rewards / leaderboard', hint: 'rewards hostel competition students' }, { label: 'Mess bill rebate', hint: 'rebate skipped meals opt-out' }] }
    ],
    rules: [
      { a: ['when', 'Before cooking (forecast)'], b: ['tech', 'Smart scale / kiosk'], reason: 'Forecasting needs attendance intent; a scale only measures after food is served.' }
    ]
  };

  const concepts = [
    { id: 'C1', name: 'MessMate', tagline: 'Meal opt-in and attendance forecasting', origin: 'team', description: 'Students confirm or skip meals in an app; the kitchen gets a headcount forecast before cooking.', morph: { user: 'Mess managers', when: 'Before cooking (forecast)', tech: 'Mobile app', incentive: 'Mess bill rebate' }, needs: ['N1'],
      claims: [{ text: 'Kitchens cook extra meals as a buffer for unexpected turnout, which creates surplus food.', evidence: ['E7'] }] },
    { id: 'C2', name: 'PlateWise', tagline: 'Portion choice with plate-waste feedback', origin: 'team', description: 'Small/medium/large serving options plus a weighing station that shows plate waste per meal.', morph: { user: 'Students', when: 'At serving (portion)', tech: 'Smart scale / kiosk', incentive: 'Rewards / leaderboard' }, needs: ['N2', 'N3'],
      claims: [{ text: 'Portion size options are recommended to reduce plate waste.', evidence: ['E8'] }, { text: 'Student plate waste exceeds caterers’ leftovers in almost every hostel.', evidence: ['E9'] }] },
    { id: 'C3', name: 'WasteLoop', tagline: 'Measure, report and route mess waste to biogas', origin: 'team', description: 'Daily waste logging dashboard that tracks grams per person and routes unavoidable waste to composting or biogas.', morph: { user: 'Sustainability office', when: 'After the meal (measure)', tech: 'Web dashboard', incentive: 'Feedback only' }, needs: ['N3', 'N4'],
      claims: [{ text: 'Campus messes generate about 40-48 grams of food waste per person per day, which can be tracked.', evidence: ['E6'] }, { text: 'More biogas and composting capacity is recommended for unavoidable waste.', evidence: ['E8'] }] }
  ];

  const criteria = [
    { id: 'desirability', name: 'Desirability', weight: 30 },
    { id: 'feasibility', name: 'Feasibility', weight: 25 },
    { id: 'viability', name: 'Viability', weight: 15 },
    { id: 'impact', name: 'Impact', weight: 20 },
    { id: 'novelty', name: 'Novelty', weight: 10 }
  ];
  const r = (value) => ({ value, note: '', evidence: [] });
  const ratings = {
    C1: { desirability: r(4), feasibility: r(4), viability: r(4), impact: r(4), novelty: r(3) },
    C2: { desirability: r(3), feasibility: r(3), viability: r(3), impact: r(4), novelty: r(4) },
    C3: { desirability: r(3), feasibility: r(4), viability: r(3), impact: r(3), novelty: r(2) }
  };

  return function build() {
    return {
      id: 'foodwaste',
      name: 'Campus Sustainability: Hostel Mess Food Waste',
      domain: 'Sustainability',
      team: ['Ashka Pathak', 'Farzan Bhalara', 'Dhruvika Rathod'],
      caveats: 'Ratings and RICE inputs in this starter case are illustrative. Replace them with your team\u2019s own judgements.',
      challenge: 'University hostel messes cook to uncertain headcounts and serve fixed portions, producing avoidable food waste every day.',
      hmw: 'How might we help campus messes cook and serve closer to what students actually eat?',
      glossary: [['waste', 'wastage', 'leftover', 'surplus'], ['mess', 'canteen', 'kitchen', 'dining'], ['student', 'students', 'resident'], ['portion', 'serving', 'plate']],
      references,
      findings,
      needs,
      personas: [
        { id: 'P1', name: 'The mess manager', role: 'Runs a hostel kitchen', note: 'proto-persona', goals: ['Cook the right amount'], pains: [{ text: 'Cooks extra food as a buffer because turnout is unpredictable.', evidence: ['E7'] }] },
        { id: 'P2', name: 'The hostel student', role: 'Undergraduate eating in the mess', note: 'proto-persona', goals: ['Eat what they like without waste'], pains: [{ text: 'Fixed portions lead to plate waste.', evidence: ['E8', 'E9'] }] }
      ],
      morph,
      concepts,
      criteria,
      ratings,
      competitors: [],
      selectedConcept: 'C1',
      features: [
        { id: 'F1', name: 'Meal opt-in / opt-out', description: 'Students confirm or skip the next meal.', rationale: 'Kitchens cook extra as a buffer for unexpected turnout.', reach: 80, impact: 2, confidence: 70, effort: 2, moscow: 'Must', evidence: ['E7'], dependsOn: [] },
        { id: 'F2', name: 'Headcount forecast for the kitchen', description: 'Forecast per meal from opt-ins and history.', rationale: 'Surplus food comes from cooking to an unknown headcount.', reach: 100, impact: 3, confidence: 60, effort: 3, moscow: 'Must', evidence: ['E7'], dependsOn: ['F1'] },
        { id: 'F3', name: 'Daily waste log (grams per person)', description: 'Record waste per meal and show the trend.', rationale: 'Messes generate a measurable amount of waste per person per day.', reach: 100, impact: 1, confidence: 80, effort: 1.5, moscow: 'Should', evidence: ['E6'], dependsOn: [] },
        { id: 'F4', name: 'Hostel leaderboard', description: 'Compare hostels on grams per person.', rationale: 'Team hypothesis: friendly competition may reduce plate waste.', reach: 60, impact: 1, confidence: 40, effort: 2, moscow: 'Could', evidence: [], dependsOn: ['F3'] }
      ],
      plan: { teamSize: 3, sprintWeeks: 2, focus: 0.6, buffer: 0.2 },
      constraints: { platform: 'both', offline: false, sensitiveData: false, ai: 'rules', wearables: false, realtime: false, budget: 'low', skills: ['javascript'], expectedUsers: 3000, region: 'India' },
      bmc: { customerSegments: 'Hostel mess contractors and university administrations.', valuePropositions: 'Lower food cost and waste through headcount forecasts.', revenueStreams: 'Per-hostel subscription funded from food cost savings.' },
      risks: [{ id: 'X1', failure: 'Students do not bother to opt in or out', cause: 'Team assessment: habit and low incentive.', likelihood: 4, impact: 4, mitigation: 'Default to last week’s pattern; rebate for skipped meals.', evidence: [] }],
      ideas: [],
      experiment: { entries: [], ratings: [], key: [], seed: 2026 }
    };
  };
});
