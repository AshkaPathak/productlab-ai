# Case study: PCOS (now PMOS) and metabolic health

This is the sample project shipped with ProductLab AI. It applies the full workflow to the challenge the team chose for DE 401: **evidence-based digital products for early detection and long-term management of PCOS and metabolic health in young women.**

On 12 May 2026 an international consortium announced in *The Lancet* that polycystic ovary syndrome is renamed **polyendocrine metabolic ovarian syndrome (PMOS)**. The name will be phased in over about three years. The case study uses "PCOS (PMOS)" because most of the cited literature uses the old name.

## What is fact and what is judgement

| Content | Status |
|---|---|
| Evidence findings E1-E29 and references R1-R17 | **Verified.** Each number was checked against the source (abstract, key points or results) and is quoted as reported. |
| Need statements, persona pain points, concept claims | Written by the team; each cites the findings it rests on. The citation guard checks the wording against those findings. |
| Personas | **Proto-personas** built from published evidence. Validate them with interviews before relying on them. |
| Decision-matrix ratings | **Team judgements** from the concept-selection workshop (1-5). Totals are computed, not typed. |
| RICE inputs, competitor positions | **Team estimates**. Statements marked "Team assessment" or "Team hypothesis" deliberately carry no citation, so the audit flags them. |

### Correction to the presentation deck

The concept-selection slide showed weighted scores of 4.42 / 3.95 / 3.97 / 3.82 / 3.80. With the slide's own weights (30/20/20/20/10) and ratings, the correct totals are:

| Concept | Total | Rank |
|---|---|---|
| CycleSync AI | **4.47** | 1 |
| PCOS Risk Radar | 4.03 | 2 |
| NutriBalance | 3.96 | 3 |
| Clinician Insight Dashboard | 3.86 | 4 |
| Hormone Harmony | 3.82 | 5 |

CycleSync AI still wins. Clinician Insight Dashboard and Hormone Harmony swap places. The unit test `tests/decision.test.js` locks these numbers in.

The deck's "1 in 5 women" is correct **for India**: 19.6% under the Rotterdam criteria in the national ICMR study (E3). Globally the figure is about 12% (E1). Both are cited with their scope.

## Results on this case (reproduce with `npm run audit -- pcos`)

| Measure | Value |
|---|---|
| Claims checked | 58 |
| Supported / partial | 48 / 4 |
| Flagged (team assessments without citations) | 6 |
| Traceability index | 89.7% |
| Evidence coverage | 28 / 29 findings |
| Winner | CycleSync AI (4.47). It stays first in 100% of 2,000 Monte Carlo runs with ±30% weight noise. Only a Novelty weight of about 84% (+74 points) would change it. |
| MVP | 5 Must features, about 9 weeks for a team of 3 at 60% focus with a 20% buffer |

## Evidence table

| ID | Finding (as reported) | Source | Strength | Location |
|---|---|---|---|---|
| E1 | Global PCOS prevalence among adult women is 12.1% (95% CI 9.8-14.8) using Rotterdam criteria and 7.9% using the original NIH criteria. | R1 | 3 | Abstract |
| E2 | Using Rotterdam criteria, PCOS prevalence is highest in the Eastern Mediterranean (15.1%) and South-East Asian (14.3%) WHO regions. | R1 | 3 | Abstract |
| E3 | In a nationwide study of 9,824 Indian women aged 18-40, PCOS prevalence was 19.6% by Rotterdam 2003 criteria (about one in five) and 7.2% by NIH 1990 criteria. | R2 | 3 | Key points |
| E4 | In India, PCOS prevalence was higher in urban than rural areas, and most women with PCOS had one or more metabolic diseases. | R2 | 3 | Results |
| E5 | WHO estimates that up to 70% of women with PCOS may be undiagnosed. | R12 | 3 | Fact sheet |
| E6 | PCOS can start in adolescence but is most commonly detected or diagnosed when women struggle to become pregnant. | R12 | 3 | Overview |
| E7 | In an international survey of 1,385 women with PCOS, 33.6% reported more than two years before their diagnosis was established. | R3 | 2 | Results |
| E8 | 47.1% of women saw three or more health professionals before a PCOS diagnosis was established. | R3 | 2 | Results |
| E9 | Only 35.2% of women were satisfied with their PCOS diagnosis experience and only 15.6% with the information they received. | R3 | 2 | Results |
| E10 | Women’s most common PCOS concerns were difficulty losing weight (53.6%), irregular menstrual cycles (50.8%) and infertility (44.5%). | R3 | 2 | Results |
| E11 | The 2023 International PCOS Guideline (254 recommendations and practice points) states that diagnosis is still delayed and the needs of those with PCOS are not adequately met. | R4 | 3 | Abstract |
| E12 | The 2023 guideline adds anti-Mullerian hormone (AMH) blood levels as an alternative to ultrasound for identifying polycystic ovarian morphology in adults. | R4 | 3 | Key updates |
| E13 | The 2023 guideline emphasises healthy lifestyle, emotional wellbeing and quality of life, with awareness and consideration of weight stigma. | R4 | 3 | Key updates |
| E14 | Healthy eating and physical activity are recommended for everyone with PCOS, with benefits even without weight loss, and screening for depression and anxiety is recommended. | R4 | 3 | Recommendations |
| E15 | Women with PCOS have increased odds of anxiety symptoms (OR 5.62, 95% CI 3.22-9.80) and of moderate and severe depressive and anxiety symptoms, independent of obesity. | R5 | 3 | Results |
| E16 | In quality studies, women with PCOS had a higher prevalence of impaired glucose tolerance (OR 3.26) and type 2 diabetes (OR 2.87), with differences by ethnicity (about five-fold higher odds of impaired glucose tolerance in Asia). | R6 | 3 | Outcomes |
| E17 | PCOS remained a strong predictor of type 2 diabetes after adjusting for BMI (hazard ratio 3.23), and guidelines suggest type 2 diabetes screening every 1-3 years in all women with PCOS. | R7 | 2 | Results; Conclusions |
| E18 | A Cochrane review of 15 trials (498 participants) found lifestyle intervention may reduce weight (-1.68 kg) and BMI and improve the free androgen index, but the evidence is low quality. | R8 | 3 | Main results |
| E19 | In a survey of 264 women with PCOS, 98% had a smartphone, 72% had used a health app and 91% would use a PCOS-specific app. | R9 | 2 | Results |
| E20 | The most important app feature for women with PCOS was current, evidence-based information; existing PCOS apps lacked quality information. | R9 | 2 | Results |
| E21 | Of 199 PCOS-related apps screened, 15 met inclusion; mean app quality was 3.6/5 on the Mobile App Rating Scale, with engagement and information quality scoring lowest. | R11 | 2 | Results |
| E22 | Most PCOS apps were commercially affiliated without academic or clinical oversight, which limited evidence-based content. | R11 | 2 | Results |
| E23 | AskPCOS is a not-for-profit, evidence-based app built from the international guideline, offering health information, a self-assessment function, a question prompt list for doctor visits and multilingual content. | R10 | 2 | Abstract |
| E24 | Veera Health, founded in India in 2020, runs a digital PCOS clinic offering medical care, nutrition therapy, lifestyle coaching and doctor support. | R14 | 1 | Article |
| E25 | Allara, based in the United States, offers a virtual care programme for women with PCOS. | R15 | 1 | Company profile |
| E26 | India’s Digital Personal Data Protection Act 2023 and Rules notified in November 2025 require consent notices that itemise the personal data collected and its purpose, with an 18-month phased compliance timeline. | R13 | 3 | Act and Rules |
| E27 | Prevalence estimates depend on the diagnostic criteria used: pooled prevalence was 7% with NIH criteria versus 12% with Rotterdam criteria. | R16 | 3 | Abstract |
| E28 | PCOS can substantially affect quality of life; women with PCOS may experience anxiety, depression, eating disorders and negative body image. | R12 | 3 | Symptoms |
| E29 | In May 2026 a global consortium announced in The Lancet that PCOS is renamed polyendocrine metabolic ovarian syndrome (PMOS), to be phased in over about three years. | R17 | 1 | Article |

- **R1** A. C. H. Neven et al., “Prevalence of polycystic ovary syndrome: a global and regional systematic review and meta-analysis,” Hum. Reprod. Update, vol. 32, no. 3, pp. 277–312, 2026, doi: 10.1093/humupd/dmaf030.
- **R2** M. A. Ganie et al., “Prevalence, phenotypes, and comorbidities of polycystic ovary syndrome among Indian women,” JAMA Netw. Open, vol. 7, no. 10, Art. no. e2440583, 2024, doi: 10.1001/jamanetworkopen.2024.40583.
- **R3** M. Gibson-Helm, H. Teede, A. Dunaif, and A. Dokras, “Delayed diagnosis and a lack of information associated with dissatisfaction in women with polycystic ovary syndrome,” J. Clin. Endocrinol. Metab., vol. 102, no. 2, pp. 604–612, 2017, doi: 10.1210/jc.2016-2963.
- **R4** H. J. Teede et al., “Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome,” Hum. Reprod., 2023, doi: 10.1093/humrep/dead156.
- **R5** L. G. Cooney, I. Lee, M. D. Sammel, and A. Dokras, “High prevalence of moderate and severe depressive and anxiety symptoms in polycystic ovary syndrome: a systematic review and meta-analysis,” Hum. Reprod., vol. 32, no. 5, pp. 1075–1091, 2017.
- **R6** N. S. Kakoly et al., “Ethnicity, obesity and the prevalence of impaired glucose tolerance and type 2 diabetes in PCOS: a systematic review and meta-regression,” Hum. Reprod. Update, vol. 24, no. 4, pp. 455–467, 2018, doi: 10.1093/humupd/dmy007.
- **R7** N. S. Kakoly, A. Earnest, H. J. Teede, L. J. Moran, and A. E. Joham, “The impact of obesity on the incidence of type 2 diabetes among women with polycystic ovary syndrome,” Diabetes Care, vol. 42, no. 4, pp. 560–567, 2019, doi: 10.2337/dc18-1738.
- **R8** S. S. Lim, S. K. Hutchison, E. Van Ryswyk, R. J. Norman, H. J. Teede, and L. J. Moran, “Lifestyle changes in women with polycystic ovary syndrome,” Cochrane Database Syst. Rev., no. 3, Art. no. CD007506, 2019, doi: 10.1002/14651858.CD007506.pub4.
- **R9** J. A. Boyle et al., “Ask PCOS: identifying need to inform evidence-based app development for polycystic ovary syndrome,” Semin. Reprod. Med., vol. 36, no. 1, pp. 59–65, 2018, doi: 10.1055/s-0038-1667187.
- **R10** J. Xie, F. Burstein, R. Garad, H. J. Teede, and J. A. Boyle, “Personalized mobile tool AskPCOS delivering evidence-based quality information about polycystic ovary syndrome,” Semin. Reprod. Med., vol. 36, no. 1, pp. 66–72, 2018, doi: 10.1055/s-0038-1667156.
- **R11** Z. Arabkermani, S. Barzegari, A. Rouhani, N. Nahavandi, O. Gibreel, and I. Arpaci, “Mobile apps designed for patients with polycystic ovary syndrome: content analysis using the Mobile App Rating Scale,” J. Med. Internet Res., vol. 27, Art. no. e71118, 2025, doi: 10.2196/71118.
- **R12** World Health Organization, “Polycystic ovary syndrome (fact sheet),” World Health Organization. Accessed: Nov. 7, 2026. [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome
- **R13** Government of India, “The Digital Personal Data Protection Act, 2023, and Digital Personal Data Protection Rules, 2025 (notified 13 Nov. 2025),” Ministry of Electronics and Information Technology, 2025. Accessed: Nov. 7, 2026. [Online]. Available: https://www.meity.gov.in/
- **R14** Business Insider India, “Healthcare startup Veera raises $3 million to reach more PCOS patients,” Business Insider India, 2021. [Online]. Available: https://www.businessinsider.in/science/health/news/healthcare-startup-veera-raises-3-million-to-reach-more-pcos-patients/articleshow/84749847.cms
- **R15** CB Insights, “Compare Allara vs Veera Health,” CB Insights. Accessed: Nov. 7, 2026. [Online]. Available: https://www.cbinsights.com/compare/allara-vs-veera-health
- **R16** M. A. Skiba, R. M. Islam, R. J. Bell, and S. R. Davis, “Understanding variation in prevalence estimates of polycystic ovary syndrome: a systematic review and meta-analysis,” Hum. Reprod. Update, vol. 24, no. 6, pp. 694–709, 2018, doi: 10.1093/humupd/dmy022.
- **R17** Medical News Today, “From PCOS to PMOS: How the name change is set to improve diagnosis and care,” Medical News Today, 2026. [Online]. Available: https://www.medicalnewstoday.com/articles/pcos-to-pmos-how-name-change-set-to-improve-care
