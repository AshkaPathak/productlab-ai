/*
 * Case study 1: Women's health - PCOS (now PMOS) and metabolic health.
 * Every finding below was checked against its source. Numbers are quoted as
 * reported; team judgements (ratings, RICE inputs, competitor positions) are
 * labelled as such and are meant to be revised by the team.
 * Source strength: 3 = systematic review / guideline / national survey,
 * 2 = peer-reviewed primary study, 1 = news, industry or grey literature.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.PL = root.PL || {}; root.PL.cases = root.PL.cases || {}; root.PL.cases.pcos = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const references = [
    { id: 'R1', type: 'journal', strength: 3, authors: ['A. C. H. Neven', 'M. Forslund', 'S. Ranasinha', 'P. Sethi', 'R. R. Dhungana', 'A. Mousa', 'C. T. Tay', 'H. Teede', 'J. A. Boyle'], title: 'Prevalence of polycystic ovary syndrome: a global and regional systematic review and meta-analysis', venue: 'Hum. Reprod. Update', volume: '32', issue: '3', pages: '277-312', year: 2026, doi: '10.1093/humupd/dmaf030' },
    { id: 'R2', type: 'journal', strength: 3, authors: ['M. A. Ganie', 'S. Chowdhury', 'N. Malhotra', 'R. Sahay', 'P. K. Bhattacharya', 'S. Agrawal', 'ICMR-PCOS Study Group'], title: 'Prevalence, phenotypes, and comorbidities of polycystic ovary syndrome among Indian women', venue: 'JAMA Netw. Open', volume: '7', issue: '10', pages: 'e2440583', year: 2024, doi: '10.1001/jamanetworkopen.2024.40583' },
    { id: 'R3', type: 'journal', strength: 2, authors: ['M. Gibson-Helm', 'H. Teede', 'A. Dunaif', 'A. Dokras'], title: 'Delayed diagnosis and a lack of information associated with dissatisfaction in women with polycystic ovary syndrome', venue: 'J. Clin. Endocrinol. Metab.', volume: '102', issue: '2', pages: '604-612', year: 2017, doi: '10.1210/jc.2016-2963' },
    { id: 'R4', type: 'guideline', strength: 3, authors: ['H. J. Teede', 'C. T. Tay', 'J. Laven', 'A. Dokras', 'L. J. Moran', 'T. T. Piltonen', 'International PCOS Network'], title: 'Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome', venue: 'Hum. Reprod.', year: 2023, doi: '10.1093/humrep/dead156' },
    { id: 'R5', type: 'journal', strength: 3, authors: ['L. G. Cooney', 'I. Lee', 'M. D. Sammel', 'A. Dokras'], title: 'High prevalence of moderate and severe depressive and anxiety symptoms in polycystic ovary syndrome: a systematic review and meta-analysis', venue: 'Hum. Reprod.', volume: '32', issue: '5', pages: '1075-1091', year: 2017, url: 'https://pubmed.ncbi.nlm.nih.gov/28333286/' },
    { id: 'R6', type: 'journal', strength: 3, authors: ['N. S. Kakoly', 'M. B. Khomami', 'A. E. Joham', 'S. D. Cooray', 'M. L. Misso', 'R. J. Norman', 'C. L. Harrison', 'S. Ranasinha', 'H. J. Teede', 'L. J. Moran'], title: 'Ethnicity, obesity and the prevalence of impaired glucose tolerance and type 2 diabetes in PCOS: a systematic review and meta-regression', venue: 'Hum. Reprod. Update', volume: '24', issue: '4', pages: '455-467', year: 2018, doi: '10.1093/humupd/dmy007' },
    { id: 'R7', type: 'journal', strength: 2, authors: ['N. S. Kakoly', 'A. Earnest', 'H. J. Teede', 'L. J. Moran', 'A. E. Joham'], title: 'The impact of obesity on the incidence of type 2 diabetes among women with polycystic ovary syndrome', venue: 'Diabetes Care', volume: '42', issue: '4', pages: '560-567', year: 2019, doi: '10.2337/dc18-1738' },
    { id: 'R8', type: 'review', strength: 3, authors: ['S. S. Lim', 'S. K. Hutchison', 'E. Van Ryswyk', 'R. J. Norman', 'H. J. Teede', 'L. J. Moran'], title: 'Lifestyle changes in women with polycystic ovary syndrome', venue: 'Cochrane Database Syst. Rev.', issue: '3', pages: 'CD007506', year: 2019, doi: '10.1002/14651858.CD007506.pub4' },
    { id: 'R9', type: 'journal', strength: 2, authors: ['J. A. Boyle', 'R. Xu', 'E. Gilbert', 'M. Kuczynska-Burggraf', 'B. Tan', 'H. Teede', 'A. Vincent', 'M. Gibson-Helm'], title: 'Ask PCOS: identifying need to inform evidence-based app development for polycystic ovary syndrome', venue: 'Semin. Reprod. Med.', volume: '36', issue: '1', pages: '59-65', year: 2018, doi: '10.1055/s-0038-1667187' },
    { id: 'R10', type: 'journal', strength: 2, authors: ['J. Xie', 'F. Burstein', 'R. Garad', 'H. J. Teede', 'J. A. Boyle'], title: 'Personalized mobile tool AskPCOS delivering evidence-based quality information about polycystic ovary syndrome', venue: 'Semin. Reprod. Med.', volume: '36', issue: '1', pages: '66-72', year: 2018, doi: '10.1055/s-0038-1667156' },
    { id: 'R11', type: 'journal', strength: 2, authors: ['Z. Arabkermani', 'S. Barzegari', 'A. Rouhani', 'N. Nahavandi', 'O. Gibreel', 'I. Arpaci'], title: 'Mobile apps designed for patients with polycystic ovary syndrome: content analysis using the Mobile App Rating Scale', venue: 'J. Med. Internet Res.', volume: '27', pages: 'e71118', year: 2025, doi: '10.2196/71118' },
    { id: 'R12', type: 'web', strength: 3, org: 'World Health Organization', title: 'Polycystic ovary syndrome (fact sheet)', venue: 'World Health Organization', accessed: '2026-11-07', url: 'https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome' },
    { id: 'R13', type: 'law', strength: 3, org: 'Government of India', title: 'The Digital Personal Data Protection Act, 2023, and Digital Personal Data Protection Rules, 2025 (notified 13 Nov. 2025)', venue: 'Ministry of Electronics and Information Technology', year: 2025, accessed: '2026-11-07', url: 'https://www.meity.gov.in/' },
    { id: 'R14', type: 'news', strength: 1, org: 'Business Insider India', title: 'Healthcare startup Veera raises $3 million to reach more PCOS patients', venue: 'Business Insider India', year: 2021, url: 'https://www.businessinsider.in/science/health/news/healthcare-startup-veera-raises-3-million-to-reach-more-pcos-patients/articleshow/84749847.cms' },
    { id: 'R15', type: 'web', strength: 1, org: 'CB Insights', title: 'Compare Allara vs Veera Health', venue: 'CB Insights', accessed: '2026-11-07', url: 'https://www.cbinsights.com/compare/allara-vs-veera-health' },
    { id: 'R16', type: 'journal', strength: 3, authors: ['M. A. Skiba', 'R. M. Islam', 'R. J. Bell', 'S. R. Davis'], title: 'Understanding variation in prevalence estimates of polycystic ovary syndrome: a systematic review and meta-analysis', venue: 'Hum. Reprod. Update', volume: '24', issue: '6', pages: '694-709', year: 2018, doi: '10.1093/humupd/dmy022' },
    { id: 'R17', type: 'news', strength: 1, org: 'Medical News Today', title: 'From PCOS to PMOS: How the name change is set to improve diagnosis and care', venue: 'Medical News Today', year: 2026, url: 'https://www.medicalnewstoday.com/articles/pcos-to-pmos-how-name-change-set-to-improve-care' }
  ];

  const findings = [
    { id: 'E1', ref: 'R1', kind: 'statistic', locator: 'Abstract', tags: ['prevalence', 'global'], text: 'Global PCOS prevalence among adult women is 12.1% (95% CI 9.8-14.8) using Rotterdam criteria and 7.9% using the original NIH criteria.' },
    { id: 'E2', ref: 'R1', kind: 'statistic', locator: 'Abstract', tags: ['prevalence', 'region', 'south-east asia'], text: 'Using Rotterdam criteria, PCOS prevalence is highest in the Eastern Mediterranean (15.1%) and South-East Asian (14.3%) WHO regions.' },
    { id: 'E3', ref: 'R2', kind: 'statistic', locator: 'Key points', tags: ['prevalence', 'india'], text: 'In a nationwide study of 9,824 Indian women aged 18-40, PCOS prevalence was 19.6% by Rotterdam 2003 criteria (about one in five) and 7.2% by NIH 1990 criteria.' },
    { id: 'E4', ref: 'R2', kind: 'statistic', locator: 'Results', tags: ['india', 'metabolic', 'urban'], text: 'In India, PCOS prevalence was higher in urban than rural areas, and most women with PCOS had one or more metabolic diseases.' },
    { id: 'E5', ref: 'R12', kind: 'statistic', locator: 'Fact sheet', tags: ['undiagnosed', 'diagnosis', 'awareness'], text: 'WHO estimates that up to 70% of women with PCOS may be undiagnosed.' },
    { id: 'E6', ref: 'R12', kind: 'insight', locator: 'Overview', tags: ['diagnosis', 'adolescence', 'fertility'], text: 'PCOS can start in adolescence but is most commonly detected or diagnosed when women struggle to become pregnant.' },
    { id: 'E7', ref: 'R3', kind: 'statistic', locator: 'Results', tags: ['diagnosis', 'delay'], text: 'In an international survey of 1,385 women with PCOS, 33.6% reported more than two years before their diagnosis was established.' },
    { id: 'E8', ref: 'R3', kind: 'statistic', locator: 'Results', tags: ['diagnosis', 'doctors', 'health professionals'], text: '47.1% of women saw three or more health professionals before a PCOS diagnosis was established.' },
    { id: 'E9', ref: 'R3', kind: 'statistic', locator: 'Results', tags: ['information', 'satisfaction', 'diagnosis'], text: 'Only 35.2% of women were satisfied with their PCOS diagnosis experience and only 15.6% with the information they received.' },
    { id: 'E10', ref: 'R3', kind: 'statistic', locator: 'Results', tags: ['concerns', 'weight', 'cycles', 'infertility'], text: 'Women’s most common PCOS concerns were difficulty losing weight (53.6%), irregular menstrual cycles (50.8%) and infertility (44.5%).' },
    { id: 'E11', ref: 'R4', kind: 'guideline', locator: 'Abstract', tags: ['diagnosis', 'unmet needs', 'guideline'], text: 'The 2023 International PCOS Guideline (254 recommendations and practice points) states that diagnosis is still delayed and the needs of those with PCOS are not adequately met.' },
    { id: 'E12', ref: 'R4', kind: 'guideline', locator: 'Key updates', tags: ['diagnosis', 'amh', 'ultrasound', 'screening'], text: 'The 2023 guideline adds anti-Mullerian hormone (AMH) blood levels as an alternative to ultrasound for identifying polycystic ovarian morphology in adults.' },
    { id: 'E13', ref: 'R4', kind: 'guideline', locator: 'Key updates', tags: ['lifestyle', 'emotional wellbeing', 'weight stigma'], text: 'The 2023 guideline emphasises healthy lifestyle, emotional wellbeing and quality of life, with awareness and consideration of weight stigma.' },
    { id: 'E14', ref: 'R4', kind: 'guideline', locator: 'Recommendations', tags: ['lifestyle', 'diet', 'exercise', 'depression', 'anxiety', 'screening'], text: 'Healthy eating and physical activity are recommended for everyone with PCOS, with benefits even without weight loss, and screening for depression and anxiety is recommended.' },
    { id: 'E15', ref: 'R5', kind: 'statistic', locator: 'Results', tags: ['anxiety', 'depression', 'mental health'], text: 'Women with PCOS have increased odds of anxiety symptoms (OR 5.62, 95% CI 3.22-9.80) and of moderate and severe depressive and anxiety symptoms, independent of obesity.' },
    { id: 'E16', ref: 'R6', kind: 'statistic', locator: 'Outcomes', tags: ['diabetes', 'glucose', 'metabolic', 'ethnicity', 'asia'], text: 'In quality studies, women with PCOS had a higher prevalence of impaired glucose tolerance (OR 3.26) and type 2 diabetes (OR 2.87), with differences by ethnicity (about five-fold higher odds of impaired glucose tolerance in Asia).' },
    { id: 'E17', ref: 'R7', kind: 'statistic', locator: 'Results; Conclusions', tags: ['diabetes', 'screening', 'bmi'], text: 'PCOS remained a strong predictor of type 2 diabetes after adjusting for BMI (hazard ratio 3.23), and guidelines suggest type 2 diabetes screening every 1-3 years in all women with PCOS.' },
    { id: 'E18', ref: 'R8', kind: 'statistic', locator: 'Main results', tags: ['lifestyle', 'weight', 'bmi', 'diet', 'exercise'], text: 'A Cochrane review of 15 trials (498 participants) found lifestyle intervention may reduce weight (-1.68 kg) and BMI and improve the free androgen index, but the evidence is low quality.' },
    { id: 'E19', ref: 'R9', kind: 'statistic', locator: 'Results', tags: ['app', 'smartphone', 'adoption'], text: 'In a survey of 264 women with PCOS, 98% had a smartphone, 72% had used a health app and 91% would use a PCOS-specific app.' },
    { id: 'E20', ref: 'R9', kind: 'insight', locator: 'Results', tags: ['app', 'information', 'evidence-based'], text: 'The most important app feature for women with PCOS was current, evidence-based information; existing PCOS apps lacked quality information.' },
    { id: 'E21', ref: 'R11', kind: 'statistic', locator: 'Results', tags: ['app', 'quality', 'engagement', 'mars'], text: 'Of 199 PCOS-related apps screened, 15 met inclusion; mean app quality was 3.6/5 on the Mobile App Rating Scale, with engagement and information quality scoring lowest.' },
    { id: 'E22', ref: 'R11', kind: 'market', locator: 'Results', tags: ['app', 'commercial', 'clinical oversight'], text: 'Most PCOS apps were commercially affiliated without academic or clinical oversight, which limited evidence-based content.' },
    { id: 'E23', ref: 'R10', kind: 'market', locator: 'Abstract', tags: ['askpcos', 'competitor', 'app', 'question prompt list', 'multilingual'], text: 'AskPCOS is a not-for-profit, evidence-based app built from the international guideline, offering health information, a self-assessment function, a question prompt list for doctor visits and multilingual content.' },
    { id: 'E24', ref: 'R14', kind: 'market', locator: 'Article', tags: ['veera health', 'competitor', 'india', 'digital clinic'], text: 'Veera Health, founded in India in 2020, runs a digital PCOS clinic offering medical care, nutrition therapy, lifestyle coaching and doctor support.' },
    { id: 'E25', ref: 'R15', kind: 'market', locator: 'Company profile', tags: ['allara', 'competitor', 'telehealth', 'united states'], text: 'Allara, based in the United States, offers a virtual care programme for women with PCOS.' },
    { id: 'E26', ref: 'R13', kind: 'regulation', locator: 'Act and Rules', tags: ['privacy', 'consent', 'dpdp', 'india', 'data protection'], text: 'India’s Digital Personal Data Protection Act 2023 and Rules notified in November 2025 require consent notices that itemise the personal data collected and its purpose, with an 18-month phased compliance timeline.' },
    { id: 'E27', ref: 'R16', kind: 'statistic', locator: 'Abstract', tags: ['prevalence', 'criteria', 'diagnosis'], text: 'Prevalence estimates depend on the diagnostic criteria used: pooled prevalence was 7% with NIH criteria versus 12% with Rotterdam criteria.' },
    { id: 'E28', ref: 'R12', kind: 'insight', locator: 'Symptoms', tags: ['anxiety', 'depression', 'body image', 'eating disorders', 'quality of life'], text: 'PCOS can substantially affect quality of life; women with PCOS may experience anxiety, depression, eating disorders and negative body image.' },
    { id: 'E29', ref: 'R17', kind: 'insight', locator: 'Article', tags: ['pmos', 'name change', 'terminology'], text: 'In May 2026 a global consortium announced in The Lancet that PCOS is renamed polyendocrine metabolic ovarian syndrome (PMOS), to be phased in over about three years.' }
  ];

  const glossary = [
    ['diagnosis', 'diagnose', 'diagnosed', 'diagnostic', 'undiagnosed', 'detect', 'detection'],
    ['period', 'menstrual', 'menstruation', 'cycle', 'cycles', 'ovulation'],
    ['anxiety', 'depression', 'depressive', 'mental', 'mood', 'emotional', 'wellbeing', 'stress'],
    ['diabetes', 'glucose', 'insulin', 'metabolic', 'dysglycaemia'],
    ['app', 'apps', 'mobile', 'smartphone', 'mhealth', 'phone'],
    ['information', 'education', 'knowledge', 'evidence-based', 'trustworthy'],
    ['lifestyle', 'diet', 'nutrition', 'eating', 'exercise', 'physical activity', 'habit'],
    ['privacy', 'consent', 'personal data', 'dpdp'],
    ['doctor', 'doctors', 'clinician', 'clinicians', 'health professionals', 'gynecologist', 'gynaecologist', 'endocrinologist', 'physician'],
    ['pcos', 'pmos', 'polycystic'],
    ['wearable', 'sensor', 'smartwatch'],
    ['screening', 'screen', 'check', 'test'],
    ['delay', 'delayed', 'long', 'wait', 'waited', 'late']
  ];

  const needs = [
    { id: 'N1', severity: 5, statement: 'Women with symptoms need a faster, clearer path to a PCOS diagnosis with fewer doctor visits.', evidence: ['E7', 'E8', 'E5', 'E11'] },
    { id: 'N2', severity: 5, statement: 'Women need trustworthy, evidence-based information about PCOS at and after diagnosis.', evidence: ['E9', 'E20', 'E22'] },
    { id: 'N3', severity: 4, statement: 'Women with PCOS need support for anxiety, depression and emotional wellbeing.', evidence: ['E15', 'E14', 'E28'] },
    { id: 'N4', severity: 4, statement: 'Women need sustainable lifestyle support (eating, activity) that works without weight stigma.', evidence: ['E10', 'E13', 'E14', 'E18'] },
    { id: 'N5', severity: 4, statement: 'Women need awareness of long-term metabolic risk and reminders for diabetes screening.', evidence: ['E16', 'E17', 'E4'] },
    { id: 'N6', severity: 3, statement: 'Women need an engaging app they keep using, not one they abandon after a few days.', evidence: ['E21', 'E19'] },
    { id: 'N7', severity: 4, statement: 'Women need control and privacy over sensitive menstrual and health data.', evidence: ['E26'] }
  ];

  const personas = [
    { id: 'P1', name: 'The undiagnosed student', role: 'Young woman, 18-30, irregular cycles, not yet diagnosed', note: 'proto-persona built from published evidence - validate with interviews', goals: ['Understand what is happening to her body', 'Get a clear answer without visiting many doctors'],
      pains: [
        { text: 'Waits years and sees several doctors before getting a PCOS diagnosis.', evidence: ['E7', 'E8'] },
        { text: 'Struggles with irregular menstrual cycles and difficulty losing weight.', evidence: ['E10'] },
        { text: 'Feels anxious and finds little trustworthy information online.', evidence: ['E15', 'E9'] }
      ] },
    { id: 'P2', name: 'The time-pressed gynaecologist', role: 'Gynaecologist / endocrinologist', note: 'proto-persona - validate with clinician interviews', goals: ['Diagnose accurately and early', 'Keep patients engaged in long-term care'],
      pains: [
        { text: 'Applies changing diagnostic criteria, including AMH as an alternative to ultrasound in adults.', evidence: ['E12', 'E27'] },
        { text: 'Must screen for diabetes regularly and for depression and anxiety.', evidence: ['E17', 'E14'] }
      ] },
    { id: 'P3', name: 'The nutritionist', role: 'Nutritionist / wellness coach', note: 'proto-persona', goals: ['Give practical, sustainable lifestyle plans'],
      pains: [
        { text: 'Lifestyle evidence for PCOS is low quality, so advice must be careful.', evidence: ['E18'] },
        { text: 'Needs to avoid weight stigma while supporting healthy eating and activity.', evidence: ['E13', 'E14'] }
      ] },
    { id: 'P4', name: 'The caregiver parent', role: 'Parent or family member', note: 'proto-persona', goals: ['Support a daughter through diagnosis'],
      pains: [{ text: 'PCOS often starts in adolescence but is detected late, when pregnancy is difficult.', evidence: ['E6'] }] }
  ];

  const morph = {
    params: [
      { id: 'user', name: 'Target user', options: [
        { label: 'Women with PCOS', hint: 'women diagnosed living with PCOS self-management lifestyle' },
        { label: 'At-risk individuals', hint: 'undiagnosed women irregular cycles early detection diagnosis delay' },
        { label: 'Clinicians', hint: 'doctors gynaecologist health professionals screening diagnosis' }] },
      { id: 'ui', name: 'Interface', options: [
        { label: 'Mobile app', hint: 'smartphone app information tracking engagement' },
        { label: 'Wearable device', hint: 'wearable sensor continuous sleep activity' },
        { label: 'Web dashboard', hint: 'web dashboard clinician summary review' }] },
      { id: 'ai', name: 'AI mode', options: [
        { label: 'Personalization', hint: 'personalised lifestyle goals eating activity emotional wellbeing' },
        { label: 'Prediction', hint: 'risk prediction screening diabetes metabolic undiagnosed' },
        { label: 'Recommendation', hint: 'recommend evidence-based information next steps doctor' }] },
      { id: 'data', name: 'Data source', options: [
        { label: 'Self-reported data', hint: 'self-reported menstrual cycles symptoms mood weight log' },
        { label: 'Sensor / wearable data', hint: 'sensor wearable sleep activity' },
        { label: 'Clinical literature', hint: 'guideline evidence research information' }] },
      { id: 'feedback', name: 'Feedback style', options: [
        { label: 'Real-time alerts', hint: 'alerts reminders screening diabetes check' },
        { label: 'Personalized insights', hint: 'personal patterns insights engagement anxiety mood' },
        { label: 'Evidence summaries', hint: 'evidence summaries trustworthy information doctor visit diagnosis' }] }
    ],
    rules: [
      { a: ['user', 'Clinicians'], b: ['ui', 'Wearable device'], reason: 'Clinicians do not wear the patient’s sensor; a wearable cannot be their interface.' },
      { a: ['ai', 'Prediction'], b: ['data', 'Clinical literature'], reason: 'Individual risk prediction needs personal data, not literature alone.' },
      { a: ['ui', 'Wearable device'], b: ['feedback', 'Evidence summaries'], reason: 'A wearable screen is too small for evidence summaries.' }
    ]
  };

  const concepts = [
    { id: 'C1', name: 'CycleSync AI', tagline: 'Personalised PCOS & metabolic health companion', origin: 'team',
      description: 'A mobile companion that combines cycle and symptom tracking, an evidence-based PCOS library, doctor-visit preparation, mood check-ins and metabolic screening reminders.',
      morph: { user: 'At-risk individuals', ui: 'Mobile app', ai: 'Recommendation', data: 'Self-reported data', feedback: 'Evidence summaries' },
      needs: ['N1', 'N2', 'N5', 'N6'],
      claims: [
        { text: '91% of surveyed women with PCOS would use a PCOS-specific app, and evidence-based information is the feature they want most.', evidence: ['E19', 'E20'] },
        { text: 'Only 15.6% of women were satisfied with the information received at diagnosis, so an evidence-based library fills a clear gap.', evidence: ['E9'] },
        { text: 'A symptom log with a doctor-visit summary targets the diagnostic delay of more than two years and three or more health professionals.', evidence: ['E7', 'E8'] },
        { text: 'Diabetes screening reminders respond to the higher type 2 diabetes risk and the 1-3 year screening advice.', evidence: ['E16', 'E17'] }
      ] },
    { id: 'C2', name: 'NutriBalance', tagline: 'AI-powered nutrition plans for hormone balance', origin: 'team',
      description: 'Personalised meal and activity plans for women with PCOS.',
      morph: { user: 'Women with PCOS', ui: 'Mobile app', ai: 'Personalization', data: 'Self-reported data', feedback: 'Personalized insights' },
      needs: ['N4'],
      claims: [
        { text: 'Difficulty losing weight is the most common concern of women with PCOS.', evidence: ['E10'] },
        { text: 'Lifestyle intervention may reduce weight and BMI in PCOS, although the evidence is low quality.', evidence: ['E18'] },
        { text: 'Healthy eating and physical activity are recommended for everyone with PCOS, even without weight loss.', evidence: ['E14'] }
      ] },
    { id: 'C3', name: 'PCOS Risk Radar', tagline: 'Early risk screening and triage', origin: 'team',
      description: 'A screening questionnaire that estimates PCOS risk and directs users to appropriate testing.',
      morph: { user: 'At-risk individuals', ui: 'Mobile app', ai: 'Prediction', data: 'Self-reported data', feedback: 'Real-time alerts' },
      needs: ['N1'],
      claims: [
        { text: 'Up to 70% of women with PCOS may be undiagnosed.', evidence: ['E5'] },
        { text: 'About one in five Indian women aged 18-40 meet Rotterdam criteria for PCOS.', evidence: ['E3'] },
        { text: 'AMH blood levels can replace ultrasound for polycystic ovarian morphology in adults, which may simplify screening pathways.', evidence: ['E12'] }
      ] },
    { id: 'C4', name: 'Hormone Harmony', tagline: 'Mind-body wellness for hormonal balance', origin: 'team',
      description: 'Stress, sleep and mood coaching for women with PCOS.',
      morph: { user: 'Women with PCOS', ui: 'Mobile app', ai: 'Personalization', data: 'Self-reported data', feedback: 'Personalized insights' },
      needs: ['N3'],
      claims: [
        { text: 'Women with PCOS have higher odds of anxiety and depressive symptoms, independent of obesity.', evidence: ['E15'] },
        { text: 'The guideline emphasises emotional wellbeing and recommends screening for depression and anxiety.', evidence: ['E13', 'E14'] }
      ] },
    { id: 'C5', name: 'Clinician Insight Dashboard', tagline: 'Clinical decision support for PCOS & metabolic health', origin: 'team',
      description: 'A web dashboard summarising patient-reported history and guideline checklists for clinicians.',
      morph: { user: 'Clinicians', ui: 'Web dashboard', ai: 'Recommendation', data: 'Clinical literature', feedback: 'Evidence summaries' },
      needs: ['N1', 'N5'],
      claims: [
        { text: 'Nearly half of women saw three or more health professionals before diagnosis.', evidence: ['E8'] },
        { text: 'The 2023 guideline states that diagnosis is still delayed and needs are not adequately met.', evidence: ['E11'] },
        { text: 'Guidelines suggest type 2 diabetes screening every 1-3 years for all women with PCOS.', evidence: ['E17'] }
      ] }
  ];

  const criteria = [
    { id: 'desirability', name: 'Desirability', weight: 30, description: 'Do target users want it? (user need fit)' },
    { id: 'feasibility', name: 'Feasibility', weight: 20, description: 'Can a small team build it with available technology and data?' },
    { id: 'viability', name: 'Viability', weight: 20, description: 'Can it sustain itself (business model, regulation)?' },
    { id: 'impact', name: 'Impact', weight: 20, description: 'Size of the health and social benefit' },
    { id: 'novelty', name: 'Novelty', weight: 10, description: 'Differentiation from existing solutions' }
  ];

  // Team ratings (1-5) from the concept-selection workshop. Notes cite evidence where it exists.
  const r = (value, note, evidence) => ({ value, note: note || '', evidence: evidence || [] });
  const ratings = {
    C1: { desirability: r(4.7, '91% of women with PCOS would use a PCOS-specific app; evidence-based information is the most wanted feature.', ['E19', 'E20']), feasibility: r(4.2), viability: r(4.3), impact: r(4.8, 'Addresses diagnostic delay, information gaps and metabolic screening together.', ['E7', 'E9', 'E17']), novelty: r(4.0) },
    C2: { desirability: r(4.0, 'Difficulty losing weight is the top concern of women with PCOS.', ['E10']), feasibility: r(4.0), viability: r(3.9), impact: r(4.1, 'Lifestyle evidence for PCOS is low quality.', ['E18']), novelty: r(3.6) },
    C3: { desirability: r(4.2), feasibility: r(3.8), viability: r(3.7), impact: r(4.3, 'Up to 70% of women with PCOS may be undiagnosed.', ['E5']), novelty: r(4.1) },
    C4: { desirability: r(3.8), feasibility: r(3.9), viability: r(3.6), impact: r(4.0, 'Higher odds of anxiety and depressive symptoms in PCOS.', ['E15']), novelty: r(3.8) },
    C5: { desirability: r(3.9), feasibility: r(3.6), viability: r(4.0), impact: r(4.1), novelty: r(3.5) }
  };

  const competitors = [
    { id: 'K1', name: 'AskPCOS', category: 'Evidence-based information app (not-for-profit)', x: 4, y: 6, strengths: 'Guideline-based content, question prompt list, multilingual', gaps: 'Team assessment: information-first; limited ongoing personal tracking.', evidence: ['E23'] },
    { id: 'K2', name: 'Veera Health', category: 'Digital PCOS clinic (India)', x: 7, y: 7, strengths: 'Medical care, nutrition therapy, lifestyle coaching, doctor support', gaps: 'Team assessment: paid care programme; less suited to pre-diagnosis self-tracking.', evidence: ['E24'] },
    { id: 'K3', name: 'Allara', category: 'Virtual PCOS care (United States)', x: 7, y: 6, strengths: 'Virtual care programme for PCOS', gaps: 'Team assessment: US market only.', evidence: ['E25'] },
    { id: 'K4', name: 'PCOS apps on app stores', category: 'Commercial self-help apps', x: 3, y: 3, strengths: 'Good functionality and visual design', gaps: 'Engagement and information quality score lowest; little clinical oversight.', evidence: ['E21', 'E22'] },
    { id: 'K5', name: 'General period trackers', category: 'Cycle tracking apps', x: 2, y: 3, strengths: 'Large user base, simple logging', gaps: 'Team assessment: not PCOS-specific; no metabolic or diagnostic pathway.', evidence: [] }
  ];

  const features = [
    { id: 'F1', name: 'Privacy & consent centre', description: 'Itemised consent per data type, export and delete.', rationale: 'Consent notices must itemise the personal data collected and its purpose under India’s data protection law.', reach: 100, impact: 1, confidence: 90, effort: 2, moscow: 'Must', needs: ['N7'], evidence: ['E26'], dependsOn: [] },
    { id: 'F2', name: 'Cycle & symptom log', description: 'Quick daily logging of cycles, symptoms and mood.', rationale: 'Irregular menstrual cycles are among the most common PCOS concerns; almost all women have a smartphone.', reach: 90, impact: 2, confidence: 80, effort: 3, moscow: 'Must', needs: ['N1', 'N6'], evidence: ['E10', 'E19'], dependsOn: ['F1'] },
    { id: 'F3', name: 'Evidence-based PCOS/PMOS library', description: 'Guideline-derived articles in plain language, updated for the PMOS name change.', rationale: 'Women want current evidence-based information and few were satisfied with the information received at diagnosis.', reach: 80, impact: 2, confidence: 80, effort: 3, moscow: 'Must', needs: ['N2'], evidence: ['E20', 'E9', 'E29'], dependsOn: [] },
    { id: 'F4', name: 'Doctor-visit summary & question list', description: 'One-page symptom history and a question prompt list to take to appointments.', rationale: 'Diagnosis is delayed beyond two years for a third of women, who see three or more health professionals; a question prompt list supports doctor visits.', reach: 60, impact: 3, confidence: 70, effort: 3, moscow: 'Must', needs: ['N1'], evidence: ['E7', 'E8', 'E23'], dependsOn: ['F2'] },
    { id: 'F5', name: 'Diabetes screening reminders', description: 'Reminders and explanations for periodic glucose screening.', rationale: 'PCOS raises type 2 diabetes risk and guidelines suggest screening every 1-3 years.', reach: 60, impact: 2, confidence: 80, effort: 1.5, moscow: 'Must', needs: ['N5'], evidence: ['E17', 'E16'], dependsOn: ['F1'] },
    { id: 'F6', name: 'Mood check-in & screening prompts', description: 'Weekly mood check-in with prompts to discuss depression and anxiety screening with a clinician.', rationale: 'Women with PCOS have higher odds of anxiety and depressive symptoms; screening for depression and anxiety is recommended.', reach: 50, impact: 2, confidence: 60, effort: 3, moscow: 'Should', needs: ['N3'], evidence: ['E15', 'E14'], dependsOn: ['F2'] },
    { id: 'F7', name: 'Weight-neutral lifestyle micro-goals', description: 'Small eating and activity goals framed around health, not weight.', rationale: 'Healthy eating and physical activity help even without weight loss; the guideline asks for awareness of weight stigma.', reach: 70, impact: 1, confidence: 60, effort: 4, moscow: 'Should', needs: ['N4'], evidence: ['E14', 'E13', 'E18'], dependsOn: ['F1'] },
    { id: 'F8', name: 'Personal pattern insights', description: 'Shows links between logged cycles, symptoms and mood over time.', rationale: 'Engagement is the weakest dimension of existing PCOS apps.', reach: 60, impact: 2, confidence: 50, effort: 5, moscow: 'Should', needs: ['N6'], evidence: ['E21'], dependsOn: ['F2'] },
    { id: 'F9', name: 'Regional-language content', description: 'Library and prompts in Hindi and other Indian languages.', rationale: 'About one in five Indian women meet Rotterdam criteria; multilingual content widens reach.', reach: 50, impact: 1, confidence: 60, effort: 3, moscow: 'Should', needs: ['N2'], evidence: ['E3', 'E23'], dependsOn: ['F3'] },
    { id: 'F10', name: 'Wearable sync (sleep & activity)', description: 'Optional import from Health Connect / HealthKit.', rationale: 'Team hypothesis: passive data could enrich insights; no direct evidence yet.', reach: 30, impact: 1, confidence: 40, effort: 4, moscow: 'Could', needs: ['N6'], evidence: [], dependsOn: ['F8'] },
    { id: 'F11', name: 'Moderated peer community', description: 'Moderated discussion spaces.', rationale: 'Team hypothesis: peer support may help engagement; needs validation.', reach: 40, impact: 1, confidence: 40, effort: 6, moscow: 'Could', needs: ['N3', 'N6'], evidence: [], dependsOn: ['F1'] }
  ];

  const risks = [
    { id: 'X1', failure: 'Users treat the doctor-visit summary as a diagnosis', cause: 'Team assessment: unclear positioning could make the app look like a diagnostic device and cause harm.', likelihood: 3, impact: 5, mitigation: 'Position as preparation for a clinician visit; clinician review of content; no diagnostic output.', evidence: [] },
    { id: 'X2', failure: 'Users stop using the app after a few weeks', cause: 'Engagement is the weakest dimension of existing PCOS apps.', likelihood: 4, impact: 4, mitigation: 'Personal insights, short check-ins, measure retention from the first pilot.', evidence: ['E21'] },
    { id: 'X3', failure: 'Sensitive menstrual and health data is breached or misused', cause: 'Consent and data protection obligations apply to personal data.', likelihood: 2, impact: 5, mitigation: 'Itemised consent, encryption, data minimisation, export and delete.', evidence: ['E26'] },
    { id: 'X4', failure: 'Weight-focused messaging increases stigma and disengagement', cause: 'The guideline asks for awareness of weight stigma.', likelihood: 3, impact: 3, mitigation: 'Weight-neutral language reviewed with users.', evidence: ['E13'] },
    { id: 'X5', failure: 'Content becomes outdated as terminology moves from PCOS to PMOS', cause: 'The PMOS name change is phased in over about three years.', likelihood: 3, impact: 2, mitigation: 'Versioned content with a review date on every article.', evidence: ['E29'] },
    { id: 'X6', failure: 'Insights do not generalise across ethnic groups', cause: 'Glucose intolerance risk differs by ethnicity and prevalence differs by region.', likelihood: 2, impact: 3, mitigation: 'Report results by subgroup in pilots; avoid one-size thresholds.', evidence: ['E16', 'E2'] }
  ];

  return function build() {
    return {
      id: 'pcos',
      name: 'Women’s Health: PCOS (PMOS) & Metabolic Health',
      domain: 'Women’s health',
      team: ['Ashka Pathak', 'Farzan Bhalara', 'Dhruvika Rathod'],
      challenge: 'Young women with PCOS (renamed PMOS in 2026) face delayed diagnosis, scattered and low-quality information, emotional distress and long-term metabolic risk, while existing apps score poorly on engagement and evidence quality.',
      hmw: 'How might we help teams discover and develop evidence-based digital product opportunities that improve early detection and long-term management of PCOS and metabolic health for young women?',
      glossary,
      references,
      findings,
      needs,
      personas,
      morph,
      concepts,
      criteria,
      ratings,
      competitors,
      selectedConcept: 'C1',
      features,
      plan: { teamSize: 3, sprintWeeks: 2, focus: 0.6, buffer: 0.2 },
      constraints: { platform: 'mobile', offline: true, sensitiveData: true, ai: 'rules', wearables: false, realtime: false, budget: 'low', skills: ['javascript', 'typescript'], expectedUsers: 10000, region: 'India' },
      bmc: {
        customerSegments: 'Women aged 18-30 with symptoms or a PCOS/PMOS diagnosis (primary); gynaecologists and nutritionists (secondary).',
        valuePropositions: 'One trustworthy place to track symptoms, prepare for doctor visits, learn from guideline-based content and stay on top of metabolic screening.',
        channels: 'Play Store / App Store, college health centres, gynaecology clinics, women’s health communities.',
        customerRelationships: 'Self-service app with clinician-reviewed content; optional community.',
        revenueStreams: 'Free core app; B2B licences for clinics and corporate wellness; grants for public-health pilots.',
        keyResources: 'Curated evidence library, clinical advisors, privacy-first platform.',
        keyActivities: 'Content curation and review, app development, user research, pilot studies.',
        keyPartners: 'Hospitals and gynaecology clinics, universities, PCOS patient groups, diagnostic labs.',
        costStructure: 'Development, clinical content review, cloud hosting in India, compliance, outreach.'
      },
      risks,
      ideas: [],
      experiment: { entries: [], ratings: [], key: [], seed: 2026 }
    };
  };
});
