# ScaleMe — Evidence-discovery differentiation plan

**SunHacks 2026 · proposed hackathon implementation scope · not yet shipped**

ScaleMe should be presented as an **auditable evidence-discovery workflow**, not as the first AI resume optimizer or adaptive interview coach. Related Devpost projects already explore resume matching, conversational achievement discovery, and truthful rewriting. Our defensible contribution is a working integration that **makes changes in documented evidence visible** and refuses to turn unsupported assumptions into resume claims.

> **Pitch:** ScaleMe identifies what a target role requires, asks targeted questions to uncover experience missing from a resume, links candidate-reported answers to the relevant requirements, and shows precisely why a suggested resume improvement is supported.

## Originality context

These public projects demonstrate overlap; this is **not** a comprehensive novelty or intellectual-property clearance search:

- [Hotseat](https://devpost.com/software/hotseat) — evidence-oriented job matching, adaptive interviewing and resume rewriting.
- [MagicResume](https://devpost.com/software/magicresume) — career evidence, job matching, questions and grounded applications.
- [ResumAI](https://devpost.com/software/resumai-dz9av2) — conversational discovery and quantification of achievements.
- [AI Interview and Resume Review](https://devpost.com/software/ai-interview-and-resume-review) — MLH/Devpost resume-review and interview overlap.

**Do not claim:** “the first ever,” “the only evidence-based career coach,” “uniquely verifies experience,” or “proven to improve hiring chances.” The candidate can **confirm** a claim, but ScaleMe cannot independently verify employment history or metrics without a separate trusted source.

## MVP: the auditable discovery loop (P0)

1. **Baseline requirement inventory.** Extract a stable ID and importance (`required`/`preferred`/`unspecified`) for each target-job requirement. Assess whether the **resume shows evidence**, using `supported`, `unclear`, or `not_evidenced`, and show the exact candidate-source quote for supported claims. `not_evidenced` does not mean unqualified.
2. **Targeted interview.** Prefer one unresolved *required* requirement, explain what is unclear, and ask a question designed to elicit concrete facts. A vague answer should trigger a narrower follow-up rather than a generic script.
3. **Candidate evidence ledger.** Capture the exact resume excerpt or interview answer and its source/turn ID; attach it to the requirement it supports. Distinguish `candidate_reported` from `candidate_confirmed` (explicitly reviewed by the candidate). **Neither label means independently verified.** Job-description excerpts explain requirements; they do not prove candidate capability.
4. **Before/after documented coverage.** Reassess after the answer and show a comparison such as **2 of 4 required requirements supported by provided evidence → 3 of 4**. Derive counts deterministically from validated requirement assessments and stable IDs. A change in writing alone must not increase coverage; do not call the count a hireability probability.
5. **Guarded impact suggestion.** Show original bullet → proposed bullet → exact evidence citations and a review state. When source facts are missing, ask instead of inventing. Block or remove ungrounded employers, technologies, dates, percentages, counts, and achievements.

### Synthetic demo story

- **Job requirement:** “Experience testing web applications.”
- **Initial resume:** “Built an internal employee portal.”
- **Initial assessment:** `not_evidenced` for testing; the resume does not mention it.
- **Question:** “How did you test the portal before colleagues started using it?”
- **Candidate answer:** “I tested login, navigation, and the mobile layout with coworkers before rollout.”
- **Reassessment:** `supported` for testing, linked to that interview turn; display **candidate-reported**.
- **Grounded bullet:** “Built an internal employee portal and tested login, navigation, and mobile usability with coworkers before rollout.”
- **Blocked embellishment:** “Improved performance by 40%” is **not** generated without source evidence.

The judge should be able to click the changed requirement to see **old status → new candidate answer → revised status → revised bullet**.

## Acceptance tests for the P0 vertical slice

| Case | Expected outcome |
| --- | --- |
| Candidate supplies no relevant answer | Unresolved requirement stays `not_evidenced` or `unclear`; coverage does not rise |
| Candidate supplies relevant testing details | Matching requirement can change to `supported` with a specific interview evidence reference |
| Candidate answer is vague or irrelevant | Ask a targeted follow-up; do not manufacture supporting evidence |
| AI invents “40%,” a date, or a tool | Proposed claim is removed, blocked or returned for confirmation; never silently accepted |
| Quote does not occur in candidate input | Reject the citation; do not label it as source-supported |
| Only job-description text mentions a skill | That **does not** count as candidate evidence |
| Requirement IDs change between snapshots | Treat as invalid for comparison; don't display misleading progress |
| User asks for a hireability score | Explain that supported-requirement coverage is not hiring probability |
| Malicious instructions in a resume or job posting | Handle as untrusted document text, not system instructions |
| Offline/mock mode | Clearly identify demo/sample output; never imply live Bedrock results |

The **coverage measure is about available evidence, not a change in actual ability**. It must preserve the same denominator across initial/final snapshots or explain any deliberate requirement-list change.

## Priorities and ownership: extend existing issues

| Priority | Existing issue | Concrete deliverable |
| --- | --- | --- |
| P0 | [#2 Contracts](https://github.com/charlierichards13/ScaleMe/issues/2) | Agree on candidate evidence IDs, status labels, snapshot semantics and review states **before parallel integration** |
| P0 | [#6 Bedrock analysis](https://github.com/charlierichards13/ScaleMe/issues/6) | Requirement-specific, quote-grounded assessments and a safe reassessment pathway |
| P0 | [#7 Interview](https://github.com/charlierichards13/ScaleMe/issues/7) | Ask a requirement-targeted question; return stable target requirement ID; use previous answer |
| P0 | [#8 Impact](https://github.com/charlierichards13/ScaleMe/issues/8) | Before/after supported-evidence counts, original/proposed bullets and traceability |
| P0 | [#3 Frontend](https://github.com/charlierichards13/ScaleMe/issues/3) | Visible requirement transitions and click-to-inspect evidence in the existing five-stage flow |
| P0 | [#10 Tests](https://github.com/charlierichards13/ScaleMe/issues/10) | Synthetic no-answer, relevant-answer and fabricated-metric tests |
| P1 | [#12 Rust matcher](https://github.com/charlierichards13/ScaleMe/issues/12) | First ship real deterministic requirement-matching signals; stretch: flag unsupported numerical claims using a tested JSON boundary |
| P1 | [#11 Submission](https://github.com/charlierichards13/ScaleMe/issues/11) | Demo provenance and the evidence-coverage transition, with accurate “built vs planned” statements |

**Architecture:** Reuse the existing Next.js → server routes → Bedrock/Rust boundaries. Do **not** add authentication, persistence or a second backend just to support the ledger. Use ephemeral request/session data for the hackathon; avoid logging personal resume/interview text. Keep Rust claim guarding supplemental: simple text matching does not prove a candidate's statement true.

**Change management:** `docs/api-contract.md` records **proposed additive extensions**; it does not pretend they exist in deployed code. Owners must agree on the final schema, update consumers and runtime validation together, and test any change before calling it done.

## Three-minute judge demo

1. **0:00–0:35** — Show synthetic resume + a target role. One required skill is not evidenced.
2. **0:35–1:20** — Ask a focused question to uncover a real but undocumented task.
3. **1:20–2:05** — Reassess. Show the changed requirement and its new exact candidate-answer source; reveal coverage before/after.
4. **2:05–2:40** — Display a stronger factual bullet and the corresponding ledger record. Show how unsupported metrics are excluded.
5. **2:40–3:00** — Point to the live AWS pathway and tested Rust matching boundary **only if actually integrated**; label every fallback honestly.

**Submission language:** “ScaleMe combines requirement-level evidence tracking, targeted experience discovery, reassessment and source-grounded writing in one inspectable workflow. Existing career-coaching ideas inspired the category; our submission demonstrates our implementation of a transparent, testable evidence loop.”

## Explicitly deferred

Voice, accounts and long-term profiles, job aggregation, authorization/immigration advice, extensive scraping, native mobile apps and speculative hiring scores. Finish the working P0 vertical slice first.
