# ProductLab AI

**Product Strategy & Innovation Intelligence Platform. From problems to products, with evidence at every step.**

ProductLab AI is a working proof-of-concept that turns an engineering or societal problem into a defensible product strategy. A team collects evidence with sources, mines user needs, generates concepts, chooses one with a weighted decision matrix, and plans the features, MVP roadmap, technology stack and business model.

Throughout, a **citation guard** checks every claim against the evidence it cites and flags claims that are unsupported, uncited or citing evidence that does not exist.

Built for **DE 401 Creative Intelligence for Engineers** (Group Innovation Project) by Ashka Pathak, Farzan Bhalara and Dhruvika Rathod.

---

## Quick start

No installation and no build step: the app is plain HTML, CSS and JavaScript.

**Option 1: open the file.** Download or clone the repository and double-click `index.html`. It opens in Chrome, Edge, Firefox or Safari.

**Option 2: run a local server.** This needs Node.js 18 or later.

```bash
node cli/serve.js        # then open http://localhost:8080
```

The app opens with two sample projects:

- **Women's Health: PCOS (PMOS) & Metabolic Health.** The team's main case study: 29 verified findings from 17 sources.
- **Campus Sustainability: Hostel Mess Food Waste.** A smaller case that shows the workflow works in any domain.

Projects are saved in the browser. Use **Export JSON** on the Projects page to back them up or share them with teammates, who can **Import** the file.

---

## What it does

| Step | Module | Creative-intelligence technique | What you get |
|---|---|---|---|
| 1 | **Evidence**: Research Synthesizer, Evidence Graph | Design Thinking: empathise | Source library with IEEE references and strength ratings; atomic findings; semantic search; import of interview notes or CSV; graph linking sources → evidence → needs → concepts → features |
| 2 | **Discover**: Opportunity Miner, Persona Studio | Design Thinking: define | Automatic clustering of evidence into themes, flags for themes no need covers, need statements with severity, proto-personas whose pain points cite evidence, How Might We |
| 3 | **Ideate** | Random Association, Morphological Analysis, optional AI | Seeded random-stimulus prompts. A zwicky box that enumerates every option combination, removes incompatible ones and ranks the rest by how well they cover the needs, then drafts concepts with evidence-linked claims. An optional language model in grounded or baseline mode. |
| 4 | **Evaluate** | Weighted Decision Matrix, Inverse Thinking | Editable criteria and weights, ratings with rationale and evidence, what-if weight sliders, one-at-a-time sensitivity (where the winner flips), Monte Carlo robustness, competitor positioning map, 5 × 5 risk register |
| 5 | **Build plan**: Feature Prioritizer, Tech Stack Recommender, MVP Planner | Business Model Canvas | Evidence-adjusted RICE, MoSCoW, dependency-aware sprint roadmap (Gantt), explainable stack recommendations, Business Model Canvas |
| 6 | **Report** | | Traceability audit of every claim; full strategy report with numbered IEEE references, exported as Markdown, PDF (print) or JSON |
| ★ | **Evaluation study** | | Tools to answer the research question: blind rating sheets, rating import, Wilcoxon signed-rank test, effect sizes, rater agreement |

### The citation guard

Every statement that should rest on evidence counts as a claim: need statements, persona pain points, concept claims, rating rationales, competitor gaps, feature rationales and risks. For each claim:

1. Cited IDs that do not exist are flagged. This is how hallucinated AI citations are caught.
2. The claim is compared with each cited finding using TF-IDF cosine similarity, with domain synonyms folded together.
3. The claim is marked **Supported**, **Partial**, **Not supported**, **Missing evidence** or **Uncited**, and better-matching findings are suggested.

The **traceability index** is the share of claims that are supported or partially supported. On the PCOS case study it is 89.7%. The remaining claims are deliberately labelled team assessments.

Details and formulas are in [`docs/methodology.md`](docs/methodology.md).

### Is it AI?

ProductLab uses AI in two layers:

1. **Built in, offline, explainable.** Information retrieval (TF-IDF vector space model), unsupervised clustering of evidence into themes, retrieval-grounded concept drafting, combinatorial search over the morphological space, Monte Carlo simulation, and rule-based recommendation. None of it needs an internet connection or an API key, and every output can be traced to its inputs.
2. **Optional language model.** Connect Google Gemini (a free key works), OpenAI, Groq, OpenRouter, or a local Ollama model in **Settings**. Generated concepts must cite evidence IDs, and the citation guard audits them before they can be used.

The model is used for divergent thinking (generating options). Convergent steps (verification, scoring, ranking) stay transparent and deterministic.

---

## Research question and evaluation

> Can an evidence-linked AI product strategy workflow help teams generate higher-quality, more defensible product concepts than ordinary AI brainstorming?

The **Evaluation study** page runs this comparison:

- Condition A is ordinary AI brainstorming, or the assistant's Baseline mode.
- Condition B is the ProductLab workflow.
- Concepts from both are rated blind on novelty, feasibility, explainability, user confidence and decision quality.
- Traceability is measured automatically.

The protocol is in [`docs/evaluation-protocol.md`](docs/evaluation-protocol.md).

---

## Command-line tool

The same engine runs from the terminal, so results in a paper can be reproduced exactly:

```bash
npm run audit -- pcos                      # traceability audit
node cli/productlab.js rank pcos           # decision matrix, sensitivity, Monte Carlo
node cli/productlab.js roadmap pcos        # evidence-adjusted RICE and schedule
node cli/productlab.js report pcos --out strategy.md
node cli/productlab.js audit my-project.productlab.json   # any exported project
```

## Tests

```bash
npm test        # 42 unit tests, Node's built-in test runner, no dependencies
```

The tests reproduce the course's decision-matrix exemplar (390 / 425 / 370) and the corrected PCOS matrix. They also cover an analytically derived sensitivity flip point, the exact Wilcoxon p-value, CSV round-trips, dependency scheduling and detection of hallucinated citations.

---

## Project structure

```
index.html            app entry point
css/styles.css        styles, including print styles for the report
js/engine/            framework-free engine, shared by app, CLI and tests
  text.js             tokeniser, stemmer, synonyms, TF-IDF
  evidence.js         retrieval, citation guard, audit, IEEE formatter
  cluster.js          opportunity mining (agglomerative clustering)
  ideation.js         random association, morphological analysis, concept synthesis
  decision.js         weighted decision matrix, sensitivity, Monte Carlo
  planning.js         RICE, scheduling, tech stack rules
  report.js           strategy report generator
  llm.js              optional language-model client (Gemini / OpenAI-compatible)
  experiment.js       blind rating sheets and statistics
js/data/              sample case studies (verified evidence)
js/app/               store, router, shared UI components and charts
js/views/             one file per workflow step
cli/                  command-line tool and static server
tests/                unit tests
docs/                 methodology, evaluation protocol, case-study evidence
```

## Using it for your own problem

1. **Projects → New project.** Describe the challenge and your How Might We question.
2. **Evidence.** Add sources (papers, reports, laws, your own interviews) and break them into one-fact findings. Paste interview notes to turn each line into evidence.
3. **Overview → Domain vocabulary.** Add synonym groups for your field. This noticeably improves matching.
4. Work through **Discover → Ideate → Evaluate → Build plan**. Cite evidence wherever the badge says *Uncited*.
5. **Report.** Fix flagged claims, then print or download the strategy report.

## Limitations

- The citation guard measures **lexical** support, not truth. A flag is a prompt for human review. Thresholds are adjustable in Settings.
- Ratings, RICE inputs and competitor positions are team judgements. The tool makes them explicit and testable (sensitivity, Monte Carlo) but cannot make them objective.
- Data is stored in the browser's local storage. Export regularly. There is no multi-user server: teams share project files.
- The sample case study is not medical advice. Product ideas involving health data must be reviewed by clinicians and against data-protection law (in India, the DPDP Act 2023 and DPDP Rules 2025).

## Credits

The evidence in the sample case studies comes from the sources listed in each project's **Sources** tab and in [`docs/case-study-pcos.md`](docs/case-study-pcos.md).

The creative-thinking techniques (Design Thinking, Random Association, Morphological Analysis, Weighted Decision Matrix, Inverse Thinking, Business Model Canvas) follow the DE 401 course material by Dr Brajesh Dhiman.

RICE prioritisation is the framework popularised by Intercom.

© 2026 Ashka Pathak, Farzan Bhalara, Dhruvika Rathod. All rights reserved.
