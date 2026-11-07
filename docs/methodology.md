# Methodology

This document describes every algorithm in ProductLab AI precisely enough to reproduce it. Section numbers match the six workflow steps in the app. All code lives in `js/engine/` and runs identically in the browser and in Node.js.

## 0. Data model

A project contains:

| Object | Fields that matter for the algorithms |
|---|---|
| Reference `R#` | bibliographic data, `strength` ∈ {1, 2, 3} |
| Evidence finding `E#` | `text`, `kind`, `ref` (one reference), `tags` |
| Need `N#` | `statement`, `severity` ∈ 1..5, `evidence` (finding IDs) |
| Concept `C#` | `claims[]` = {`text`, `evidence`}, `needs`, morphological selection |
| Rating | `ratings[concept][criterion]` = {`value` ∈ 1..5, `note`, `evidence`} |
| Feature `F#` | RICE inputs, `moscow`, `dependsOn`, `evidence`, `rationale` |
| Risk `X#` | `likelihood`, `impact` ∈ 1..5, `evidence` |

Source strength: **3** systematic review, guideline or national survey; **2** peer-reviewed primary study or the team's own structured research; **1** news, industry or grey literature.

## 1. Evidence representation (`text.js`, `evidence.js`)

**Tokenisation.** Text is lower-cased, punctuation removed (decimals and `%` kept), stop-words dropped, and each token reduced by a small suffix-stripping stemmer (e.g. *diagnosed*, *diagnosis* → `diagnos`). A per-project vocabulary (synonym groups) maps every member of a group to one canonical stem, so *menstrual*, *period* and *cycle* count as the same term.

**Vectors.** Each finding *d* is represented by TF-IDF weights over its text and tags:

w(t, d) = (1 + ln tf(t, d)) × idf(t),  idf(t) = ln((N + 1) / (df(t) + 1)) + 1

where *N* is the number of findings. Vectors are L2-normalised. A claim is vectorised with the same idf statistics.

**Similarity.** cos(a, b) = Σ a_t b_t (vectors are unit length).

**Semantic search** ranks all findings by cosine similarity to the query.

## 2. Citation guard and traceability

For a claim *c* citing findings *E_c*:

1. IDs in *E_c* that do not exist are reported as **missing** (typical of hallucinated citations).
2. s* = max over existing cited findings of cos(c, e).
3. Status:
   - **supported** if s* ≥ θ_strong (default 0.20)
   - **partial** if θ_weak ≤ s* < θ_strong (default θ_weak = 0.08)
   - **unsupported** if s* < θ_weak
   - **invalid** if every cited ID is missing
   - **uncited** if *E_c* is empty
4. The guard also suggests up to three uncited findings with similarity ≥ θ_weak.

**Audit.** The guard runs over every claim-bearing statement in a project: need statements, persona pain points, concept claims, rating rationales, competitor gaps, feature rationales and risks.

- **Traceability index** = (supported + partial) / total claims.
- **Evidence coverage** = findings cited at least once / all findings.

**Evidence score** of a set of claims (used for concepts and features):

score = (1/|C|) Σ_c weight(status_c) × strength(best_c) / 3,  weight: supported 1, partial 0.5, otherwise 0.

The thresholds were set from the score distribution on the PCOS case study:

| Pairs measured | Count | Similarity distribution |
|---|---|---|
| Claim vs. its best cited finding | 54 claim-evidence pairs | median 0.45 (10th-90th percentile 0.18-0.68) |
| Claim vs. every finding it does not cite | 1,475 pairs | median 0.015 (95th percentile 0.17) |

Only 3% of non-cited pairs reach 0.20, and some of those are genuinely related findings on the same topic. θ_strong = 0.20 therefore separates real support from coincidental overlap, and θ_weak = 0.08 catches paraphrases with little shared vocabulary. Both thresholds can be changed in Settings. Lexical similarity cannot verify meaning, so a flag is a prompt for human review, not a verdict.

## 3. Opportunity mining (`cluster.js`)

Findings are grouped by **average-linkage agglomerative clustering**. Starting with every finding as its own cluster, the algorithm repeatedly merges the two clusters with the highest mean pairwise cosine similarity, while that mean is ≥ τ (user-adjustable, default 0.12). Each theme is labelled with the top four terms of its centroid and linked to the need statement whose vector is most similar to the centroid (if similarity > 0.05). Themes with no linked need are flagged as candidate opportunities. Findings cited by no need are listed as unexplored evidence.

## 4. Ideation (`ideation.js`)

**Random Association.** A seeded PRNG (mulberry32) draws a stimulus word, one of its attributes, and a need, producing the prompt *"What if a solution for ⟨need⟩ worked like a ⟨stimulus⟩ — ⟨attribute⟩?"*. The seed is shown so sessions can be reproduced.

**Morphological Analysis.** With parameters P₁…P_k having n₁…n_k options, the solution space has Π nᵢ combinations (243 in the PCOS case). Compatibility rules (pairs of options that cannot co-occur) remove impossible combinations. Each remaining combination *s* is scored against the needs:

fit(s) = Σ_n severity_n × cos(v_s, v_n) / Σ_n severity_n

where v_s is the vector of the selected options' descriptions and v_n the vector of the need statement plus the text of its cited evidence. The top-k list is diversified greedily: a combination is skipped if it shares more than k−2 options with one already chosen.

**Concept synthesis.** For a selected combination the engine drafts claims only from retrieval: one claim per strongly matched need (citing that need's evidence) and one per option whose best-matching finding passes θ_weak (citing that finding). Every drafted claim is then checked by the same citation guard as human or AI claims.

**AI assistant (optional, `llm.js`).** Two prompt modes:
- *Grounded*: the model receives the challenge, need statements and the numbered evidence list, and must cite evidence IDs for every claim.
- *Baseline*: the model receives only the challenge, which reproduces ordinary AI brainstorming.

Replies are parsed defensively (code fences and surrounding text removed, IDs sanitised) and then audited. The exact prompt is shown in the app for reporting.

## 5. Evaluation (`decision.js`)

**Weighted Decision Matrix.** Weights are normalised to sum to 1. For alternative *a*:

Total(a) = Σ_j w_j × r_aj

Ranks are dense with ties sharing a rank.

**One-at-a-time sensitivity.** For each criterion *k*, its weight is swept from 0 to 1 in steps of 0.005 while the other weights keep their relative proportions:

w'_j = w_j × (1 − v) / Σ_{i≠k} w_i  for j ≠ k

The reported flip point is the weight closest to the current one at which the top-ranked alternative changes.

**Monte Carlo robustness.** In each of 2,000 seeded runs, every weight is multiplied by a factor drawn uniformly from [1 − σ, 1 + σ] and renormalised. Optionally every rating is perturbed by U(−ε, ε). The output is each alternative's win rate and mean rank.

**Risk register (inverse thinking).** Each failure mode is scored likelihood × impact on a 5 × 5 matrix: ≥ 15 high, 8-14 medium, otherwise low.

## 6. Build planning (`planning.js`)

**RICE.** RICE = Reach × Impact × Confidence / Effort, with reach in % of target users, impact ∈ {0.25, 0.5, 1, 2, 3}, confidence in %, and effort in person-weeks.

**Evidence-adjusted RICE.** Confidence is multiplied by (0.5 + 0.5 × evidence score of the feature rationale). A feature with no supporting evidence keeps half of its stated confidence, which makes untested assumptions visible in the ranking. A MoSCoW category is suggested by rank quantile (top 40 % Must, next 30 % Should, next 20 % Could, last 10 % Won't). The team can override it.

**Effort.** When optimistic and pessimistic estimates exist, PERT expected effort is used: E = (o + 4m + p) / 6. A risk buffer (default 20 %) is added.

**Scheduling.** Features (excluding Won't) are topologically sorted on `dependsOn` (Kahn's algorithm), ties broken by MoSCoW and then by evidence-adjusted RICE. They are list-scheduled on the team, treated as one pooled resource with capacity team size × focus person-weeks per week. A feature starts only after all its dependencies finish. Cycles are detected and reported instead of scheduled.

**Technology stack.** A transparent rule base maps constraints (platform, sensitive data, AI type, wearables, offline use, budget, team skills, region, scale) to a recommendation per layer. Each pick carries the constraint that triggered it and alternatives.

## 7. Evaluation study statistics (`experiment.js`)

- **Blinding.** Study concepts are shuffled with a seeded Fisher-Yates shuffle and given codes S01, S02, and so on. The rating sheet omits the condition, and the code-to-entry key is stored separately.
- **Aggregation.** Ratings are averaged across raters per concept, then per participant within each condition.
- **Test.** The paired Wilcoxon signed-rank test is applied to the per-participant differences B − A, with zero differences dropped and tied ranks averaged. For n ≤ 15 the two-sided p is exact: all 2ⁿ sign assignments over the observed ranks are enumerated. For larger n, a normal approximation with tie and continuity correction is used.
- **Effect sizes.** r = |z| / √n, and Cohen's d_z = mean(diff) / sd(diff).
- **Rater agreement.** The share of rating pairs (same concept, same metric, different raters) within ±1 point, and the share that are identical.
- **Traceability.** Computed automatically for each concept with the citation guard and analysed in the same way.

## Validation

`npm test` runs 42 unit tests, including:
- reproduction of the course's exemplar decision matrix (390 / 425 / 370)
- the hand-calculated PCOS matrix (4.47 / 4.03 / 3.96 / 3.86 / 3.82)
- an analytically derived flip point (0.556)
- the exact Wilcoxon p-value for n = 6 (2/64)
- CSV round-trips
- dependency-aware scheduling
- detection of hallucinated citation IDs
