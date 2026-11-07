# Evaluation protocol

**Research question.** Can an evidence-linked AI product strategy workflow help teams generate higher-quality, more defensible product concepts than ordinary AI brainstorming?

**Hypotheses.**
- H1: Concepts produced with ProductLab AI (condition B) have higher traceability than concepts from ordinary AI brainstorming (condition A).
- H2: Blind raters score B concepts higher on explainability and decision quality.
- H3: B concepts are not rated lower on novelty. This is checked because evidence grounding could make ideas more conservative.

## Design

Within-subjects, two conditions, counterbalanced order.

| | Condition A: baseline | Condition B: ProductLab AI |
|---|---|---|
| Tool | Any general AI chatbot, or the **Baseline** mode of the in-app AI assistant | ProductLab workflow: evidence library, needs, morphological analysis / random association / grounded AI assistant, citation guard |
| Input | Challenge statement only | Challenge statement plus the project's evidence library |
| Output | 1-3 concepts, each with 3-5 claims | 1-3 concepts, each with 3-5 claims and citations |
| Time | 25 minutes | 25 minutes |

**Participants.** Aim for at least 8 participants or small teams. Engineering students who have not seen the case study are suitable. With fewer than 6 complete pairs, report the study as a pilot.

**Counterbalancing.** Odd-numbered participants do A first; even-numbered participants do B first. To limit carry-over, use a different but comparable challenge for the second session. For example, PCOS/PMOS for one session and campus food waste for the other, with the challenge-to-condition mapping alternated.

## Procedure

1. Brief participants with the same one-paragraph challenge (5 min).
2. Run session 1 (25 min) and session 2 (25 min) in the counterbalanced order.
3. Record every concept in **Evaluation study → Add concept**. Concepts made in the app can be added with **Add project concepts (B)**. AI assistant output can be sent directly with **Add to evaluation study**.
4. Generate the **blind rating sheet** with at least two raters. Raters should not have been participants. The key file stays with the study lead.
5. Raters score each coded concept from 1 to 5 on each metric:
   - **Novelty**: originality compared with existing solutions.
   - **Feasibility**: could a small team build an MVP with available technology and data?
   - **Explainability**: are the reasons clear and traceable to sources?
   - **User confidence**: how much would you trust this recommendation?
   - **Decision quality**: how defensible is it in front of a review panel?
6. Import the filled sheets. **Traceability** is computed automatically by the citation guard for every concept.
7. Download the results CSV for the paper.

## Analysis

- Descriptive statistics per condition: mean ± sd.
- Paired Wilcoxon signed-rank test on per-participant differences (B − A) for each metric, with exact p for up to 15 pairs.
- Effect sizes: r = |z|/√n and Cohen's d_z.
- Rater agreement: % of rating pairs within ±1 point.
- Report all metrics, including any where B is not better.

## Threats to validity

- **Learning effects.** Mitigated by counterbalancing and using different challenges.
- **Rater bias.** Mitigated by the blind, shuffled sheet. Raters should not know the hypotheses.
- **Lexical traceability.** The guard measures word-level support, not truth. Report its thresholds and spot-check a sample of claims manually.
- **Small sample.** Treat p-values as indicative and emphasise effect sizes and confidence in the direction of effects.

## Ethics

Collect only concept text and anonymous participant codes. Do not collect health information from participants. Obtain informed consent for using their outputs in the paper.
