# Evidence ledger, reassessment and Impact Lab (Issue #8)

Implemented on `feat/evidence-reassessment`, based on `main` at
`ffc072be0943525727a40fdc667ee1a151498c57`. This replaces the fixed-only Impact Lab
with an actual local input → assessment → answer → reassessment → review/copy flow.
It does **not** connect the unmerged Fit Explorer/interview API work or implement
an evidence HTTP endpoint. `docs/api-contract.md` and the v0.1 routes are unchanged.

## What works

Visit `/impact-lab`. Paste resume text and a job description, review the extracted
requirement lines, and explicitly choose required/preferred/unspecified importance.
Assess the resume locally; that inventory and baseline then freeze. Choose a target
requirement and original experience, enter a candidate answer, and reassess. Inspect
any requirement to see before/after status, exact citations, source/turn IDs, UTF-16
offsets and full source text. Relevant specific answers may add support; unresolved
answers remain inspectable without automatically adding support. Explicit relevant
negations downgrade support to `unclear`; recorded contradictions block later positive
turns until a future explicit clarification workflow exists.

The required count is computed from the same validated IDs in both snapshots.
Preferred/unspecified requirements never enter that denominator. A zero-required
inventory displays 0 of 0 without a percentage. Rewriting or confirming a statement
cannot change coverage. Clear/reload discards the session; there is no authentication,
persistence, storage, telemetry, upload, AWS access or model/network call in this flow.

A proposal combines exact reviewed resume and interview sentences for the explicitly
selected original experience. This is conservative extractive writing, not a fluent
AI rewrite. It never inserts factual words, numbers, dates, employers or tools. A
proposed arbitrary/model wording must exactly match the authoritative extractive
proposal (`ledger.isGroundedWording`); unsupported paraphrases are rejected as well.
The caller cannot authorize new wording by modifying a returned proposal. Both source
statements must be candidate-confirmed before `copyableImpact` returns text. Undoing a
confirmation locks copying. A subsequent contradiction removes the proposal. Confirmation
is a review action, **not independent verification**, and never creates missing facts.
Unknown outcomes/metrics become questions. Strengths, gaps and conditional next actions
come from the computed assessments.

## Domain modules

All new logic is in `web/src/lib/evidence-ledger/` and imports the existing v0.1
Zod requirement/status/fit types rather than changing their definitions.

- `types.ts`: strict internal schemas; only resume and candidate-interview sources.
- `ledger.ts`: immutable ledger, provenance validation, fixed-inventory comparison,
  reassessment, candidate review and guarded proposals/copying. Returned views are
  copies; each transition produces a new ledger and retains the initial snapshot.
- `review.ts`: conservative general English lexical reviewer, independent of fixtures.
  Requires all normalized requirement terms, a past action, and concrete details beyond
  the requirement. Negations, hypotheticals and known instruction patterns block support.
- `adapters.ts`: existing FitAnalysis/InterviewTurn handoff boundaries and local assessment.
- `synthetic.ts`: optional repeatable sample, **not the application decision policy**.
- `ledger.test.ts`: general and synthetic tests, including hostile and malformed input.

Sources, evidence and assessment IDs must be unique and resolve within the same ledger.
Every quote must equal its exact source slice. Candidate answers are captured **whole**,
including qualifications/negations; positive fragments cannot be cherry-picked. Job or
coach text cannot become candidate evidence. All evidence has
`independentlyVerified: false`; no independent verification channel is implemented.

Limits: 30 requirements; resume 30,000 characters; job 20,000; each requirement 1,000;
20 answer turns of 4,000 characters each; 170 source records and 200 evidence records.
Fit import respects the existing 500-character citation limit. Local baseline assessment
splits exact resume sentences/lines and skips spans longer than 500 characters; it does
not truncate a long sentence into a misleading partial claim. Duplicate matching resume
quotes are rejected as ambiguous until an offset-bearing integration is agreed.

## Repeatable synthetic journey

1. Click **Load fictional sample**, **Review requirements**, then **Assess resume locally**.
   The baseline is **2 of 4** required requirements supported.
2. Target `r2` (testing), select the portal original, and answer:
   `I made sure it worked well.` Coverage stays **2 of 4**.
3. Submit:
   `I tested login, navigation, and the mobile layout with coworkers before rollout.`
   Testing becomes `supported`, with the exact candidate turn; coverage is **3 of 4**.
4. Inspect the evidence, confirm both source statements and copy the proposed wording.
5. Target `r4`, select the CSV original, and submit:
   `I validated CSV imports by checking missing fields and duplicate rows before saving records.`
   Coverage becomes **4 of 4** and a second grounded proposal is available.
6. A later testing answer `I did not test web applications before rollout.` returns
   that requirement to `unclear` and blocks its former proposal.

The optional `runSyntheticExample()` also produces two proposals and a structured
before/after result. Tests cover distinct portal, CSV and Python-service inputs with the
same general reviewer. Current screenshots: [desktop](screenshots/evidence-ledger/desktop.png),
[mobile](screenshots/evidence-ledger/mobile.png).

## Fit Explorer PR #46 handoff (not connected)

No files owned by #46, the interview backend, PDF parser, homepage or shared contracts
were edited. Dashboard already links to `/impact-lab`; its existing empty/demo view
model and Fit Explorer remain untouched.

The implemented adapter is:

```ts
const ledger = fromFitAnalysis(originalFitRequest, returnedFitAnalysis);
const view = ledger.view();
// The existing ImpactLab component also accepts:
<ImpactLab initialFit={{ request: originalFitRequest, analysis: returnedFitAnalysis }} />
```

The request MUST include `job.requirements` with the exact original IDs, descriptions
and importance. Assessments alone do not contain enough information to reconstruct the
inventory. #46's demo request intentionally sends no body, and its draft/live pathway
is disabled; it must not pair unrelated pasted drafts with a fixed demo response.
Pass matching original input/inventory and analysis together after owner-reviewed wiring.
When the backend extracted requirements but did not return their descriptions/importance,
stop and agree an additive inventory handoff rather than inferring it from the scores.

The adapter validates the complete assessment ID set, rejects nonexistent/ambiguous
resume quotes and interview citations in an initial fit response, discards job evidence
from candidate support, and downgrades `supported` to `unclear` when the conservative
reviewer cannot establish relevant support. Consequently its validated baseline may be
stricter than Fit Explorer's original display; communicate that revalidation explicitly.
Full original resume text is retained even when the existing schema trims its input.

## Interview #7 handoff and proposed additive interface (not an HTTP contract)

The existing `InterviewTurn` has only role/content and `InterviewResponse` has no stable
target ID. The existing mock interview uses fixed question IDs, not job requirement IDs.
Do not guess requirement IDs from a history position or the coach's prose. The typed
adapter requires application-owned metadata selected when asking the question:

```ts
const source = fromCandidateTurn({
  id: stableCandidateTurnId,
  role: "candidate",
  content: exactCandidateAnswer,
  targetRequirementId: originalRequirementId,
  subjectId: selectedOriginalSource.subjectId,
});
const after = ledger.reassess(source);
const proposal = after.proposeImpact(originalEvidenceId, `answer:${stableCandidateTurnId}`);
```

`subjectId` binds an answer to the explicitly selected original experience. The caller
must carry that association from question context; neither a model nor job text may
assign an unrelated employer/project. The ledger validates that the subject and target
exist. No global singleton, storage or cross-route browser transfer is introduced.

For future wire adoption, propose an **additive** response containing a stable candidate
turn ID and target requirement ID, with original requirement inventory and candidate
source references available in the same ephemeral session. Resolve with #2/#7/#46 owners
whether reassessment uses an optional `/api/fit/analyze` context or a separate
`/api/fit/reassess`. This PR deliberately implements neither incompatible route. Server
handlers must reconstruct/validate sources and baseline from trusted session context,
never accept client support counts or serialized ledger state as authoritative, and
reuse the existing `ApiError`, body limits and approved AI cost controls. If model
inference is later used for relevance/rewriting, reuse the approved server-only Bedrock
infrastructure, keep live off by default, and validate all output against the exact
source registry and fixed inventory before accepting it. The trusted synchronous
`EvidenceReviewer` boundary can consume an already validated server decision; it must
never be supplied by request JSON. No model gateway/client was added in this change.

## Verification and limits

Run from `web/`:

```sh
npm ci
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm run test
npm run build
npm audit --audit-level=high
# In another terminal, after starting npm run start -- --hostname 127.0.0.1:
node scripts/evidence-ledger-smoke.mjs
```

The UI smoke script uses Node 22+ built-ins and installed Chromium, with no new npm
dependency. Set `CHROMIUM_PATH` if necessary. It asserts sample and arbitrary-input
workflows, vague/relevant/contradictory answers, review/copy gating, clipboard contents,
390px overflow, no API requests/storage, and clearing on reload. Optional
`SCALEME_SCREENSHOT_DIR` saves synthetic screenshots. The actual production smoke run
and all unit tests use synthetic text only. They do not verify real-model behavior.

The local reviewer is intentionally conservative English lexical matching, not a
semantic entailment model or fact checker. It can miss legitimate synonyms and complex
compound requirements, and cannot reliably resolve every mixed-polarity statement,
attribution, sarcasm, quotation or prompt-injection variant. Passing a lexical rule is
only candidate-reported evidence, never independently verified truth. Extractive output
preserves even candidate errors; the candidate must review them. This is a usable local
workflow, **not a fully connected live resume → Fit Explorer → interview API pipeline**.
No public-launch security claim or independent audit is implied.
