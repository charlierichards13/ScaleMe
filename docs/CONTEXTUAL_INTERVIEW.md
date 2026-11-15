# Contextual interview private preview

Entry: `/interview/contextual`, inside the existing workspace shell. Refs #7.

The user pastes resume text, a job description/title and explicit required requirements (one per line). The client assigns fixed `req-1`… IDs for this immutable context, explicitly calls `/api/fit/analyze`, renders each requirement/status/exact quote, then explicitly calls `/api/interview/next` to begin. Each subsequent submission sends the same resume/job, status-only fit context and complete alternating history, including returned coach target IDs. It renders the actual `coachMessage` as escaped text. No production question bank or synthetic response substitutes for failed AI output.

Questions, answers, drafts and the private access code live only in React memory. No local/session storage, cookies, telemetry, database, PDF upload, job retrieval or automatic requests/retries are added. The user can cancel, retry manually (honoring Retry-After), end early, finish after the server permits finishing, or continue through the backend's closing message. Submitted answers survive retry without duplication. Clear/new session, navigation and refresh discard local context. Cancellation invalidates late UI responses; it cannot undo an already admitted server call.

## Review and ownership

- This feature branch includes PR #49, head `389285adfaea8ee6713b7c00fa050b2f414ca975`, unchanged. Its API contract and implementation were inspected, including plan/history validation, 12-history-turn cap and output checks. **There are no submitted reviews on #49. Human review and merge coordination remain required.** The draft PR targets main so existing main-only pull-request CI runs. Review this feature's isolated diff against `feat/interview-next-api`; do not merge before #49 is approved and integration is coordinated. No other agent's branch is changed.
- PR #38 is merged at main `ffc072be`. This client uses its fit schemas, grounding, mode header and shared cost guard.
- PR #46 (`6095dcda`) remains draft, owns the Fit Evidence Explorer and currently prohibits live browser calls. Its files are preserved; no rebasing, replacement or silent live enablement. A future entry/handoff can use this component once the owners agree. Context entry and analysis work independently in this workspace now.
- Existing `/interview` implementation remains the unmistakably labeled fictional scripted practice. Its files and question banks are preserved. The contextual workspace links to it, inherits the existing navigation shell and active interview navigation. Adding its entry link in `/interview` and changing the sidebar's `Soon` label require frontend-owner coordination; a request was made to the human during implementation. Use the direct entry route in the meantime.
- PR #50 and Madi's standalone Rust parser are untouched. Pasted text is the working ingestion path. Main advanced to `1be2fd4` during implementation, merging the parser and adding branding. A pre-existing #49/#50 threat-model conflict was avoided by moving the interview persistence clarification into its own section on this feature branch, preserving the parser's open decisions. `git merge-tree` then verifies clean integration with current main and #46; no branch was merged or overwritten here. GitHub's resulting merge revision must pass CI before human review.
- No existing API handler, AI prompt, dependency manifest/lockfile, CI workflow, shared UI component or root layout is overwritten. New `src/proxy.ts` adds access control around both paid endpoints and must be reconciled with any future auth/proxy work before merging.

## Future authorized private setup

Do not activate or call paid AI without owner approval. Defaults in `web/.env.example` keep `FIT_LIVE_AI_ENABLED=false` and the private access code unset. After approval, in an HTTPS private environment with Next.js proxy support:

1. The owner configures a high-entropy private access code in server-only `SCALEME_PRIVATE_AI_TOKEN` (32–256 URL-safe characters), distributes it privately to authorized testers, and sets the already reviewed server-side Bedrock configuration and limited role. Never use AWS credentials as the app access code; never use `NEXT_PUBLIC_`.
2. The owner deliberately enables `FIT_LIVE_AI_ENABLED=true`. Both settings are required. Restart with the switch off or rotate/remove the access code to revoke subsequent requests. Already admitted calls may finish.
3. A tester opens the workspace, enters the code and explicitly checks access (free; no AWS readiness check). After entering context, they approve sending it to Bedrock and click the analysis button. Starting the interview and each answer/follow-up are explicit paid actions. No page load or unlock triggers AI.
4. Review provider retention/logging policy before real applicant data, coordinate server/client timeouts if changing the default 45 seconds, and retain cost limits. This shared credential has no individual identity, per-user fairness, session binding or brute-force budget. It is for a controlled private preview only. Public launch still needs the repository's existing auth/distributed-abuse/privacy gates.

## Evidence handoff

`collectEvidence(context, initialAnalysis, history)` produces an in-memory `EvidenceHandoff`, delivered to optional `ContextualInterview({ onComplete })` on finish and displayed for review. It contains original context/analysis, the transcript, and exact submitted answers with stable session-local IDs, source references, original coach question, optional target requirement, and `candidate_reported` review. A target records what was asked; it is **not** a verified relevance link. General/reflection answers have no invented target. Unsent drafts are not silently collected/discarded: send or clear one before finishing.

This is a local adapter, **not adoption of the proposed v0.2 wire contract** and not a reassessment API. No support count, fit status, confirmation or generated achievement changes. The forthcoming engine must validate source/relevance on the server, establish its reviewed contract, preserve unmeasured results, and obtain authorization for any further paid call. It can consume the optional completion callback; no persistence or new database is required here.

## Verification

The committed tests exercise browser adapter → access proxy → actual fit/interview handlers → mocked AWS SDK for three distinct fictional profiles/jobs (software, product design, operations). Each profile receives five answers and a closing message; tests check full prompt/history context, echoed server targets, exact evidence, unknown metrics, no cross-profile leakage, no raw text/access code in logs, manual retry, no anonymous paid access and free demos. Mocked wording verifies plumbing, **not live model relevance or injection resistance**.

Standard checks: `npm ci --ignore-scripts`, `npm run lint`, `npm exec -- next typegen`, `npm exec -- tsc --noEmit`, `npm test`, `FIT_LIVE_AI_ENABLED=false npm run build`, `npm audit --audit-level=high`. Browser and production-boundary results are recorded in the draft PR. No Bedrock invocation, AWS change, merge or deployment is authorized by these tests.

Implementation verification: all standard checks passed; **291 tests / 18 files** (39 new), no high/critical audit findings (nine existing moderate development-tool advisories). Production Chromium exercised all three profiles with five answers at **320/390/768/1440 px**, one manual 429 retry, plus escaped text, cancellation, early finish, stale responses, and navigation/back/refresh clearing. Zero cookies, browser storage, external requests, page exceptions or horizontal overflow in these flows. Production HTTP probes verified default-off 503, live-enabled anonymous/wrong-code 401, cross-origin 403, middleware-header spoof denial and free demos. Authorized probes stopped at missing AWS configuration; no model was invoked. Browser happy-path responses were intercepted; actual server handlers/SDK are exercised by the mocked integration tests. No manual screen-reader or live-model evaluation is claimed.

## P0 completion integration (supersedes “forthcoming engine” above)

`/interview` now links to the contextual workspace while retaining the separately
labeled scripted practice. Finishing `/interview/contextual` opens experience
association and the existing Impact Lab **in the same React tree**. There is no
navigation handoff, global singleton, browser storage or new endpoint. Leaving or
refreshing still clears the entire session; entering the report does not.

`collectEvidence()` retains the original request, initial analysis and full transcript.
The completion adapter reconstructs candidate answer IDs/quotations/targets from that
transcript, resolves uniquely matching normalized fit quotations to exact resume
spans, drops missing/ambiguous citations, then uses `fromFitAnalysis()` and the
ledger's relevance/provenance validation. The original AI response stays inspectable;
the revalidated baseline can be stricter. It cannot become more supported from
normalization alone. Every answer requires an explicit selection of an exact original
resume excerpt (`subjectId`); no experience is preselected. Resume lines and original
citations are selectable with exact offsets. Unlinked answers stay in the transcript
and cannot affect coverage. General/reflection answers additionally require the
candidate to select a requirement; targeted answers retain the server target.

`fromCandidateTurn()` supplies only exact candidate content. The ledger registers
selected resume spans without increasing baseline support, reassesses whole answers,
and computes counts against the unchanged requirement inventory. Job/coach prose,
client counts and serialized ledger state cannot become supporting evidence. This is
a local coaching report, **not a server-authoritative or externally verified record**.
No new HTTP contract is adopted. Existing paid routes, access proxy and budgets remain
unchanged; reassessment makes zero additional model calls.

The embedded existing Impact Lab displays gained/lost/retained/unresolved requirements,
exact source IDs and UTF-16 offsets, full source text, grounded extractive proposals,
and candidate-confirmation/copy controls. Returning to associations rebuilds from the
original baseline and resets confirmations. A relevant contradiction revokes support
and blocks prior proposals. Only supported original citations and supported answers
on the same explicitly selected subject can produce a proposal. An uncited resume
experience can receive answer evidence, but cannot produce a fabricated original
citation or a proposal. No metric, tool or result is added by the extractive writer.

Known limits: the reused reviewer is English lexical matching, not semantic entailment.
Synonyms/compound requirements and mixed-polarity answers can remain unresolved; a
concrete action qualified with “not measured” may conservatively remain unresolved.
Unknown metrics alone never establish support. The backend still assigns two questions
per requirement; the model words follow-ups using history but cannot change that plan.
Real-model quality, injection resistance, retention and private hosting need owner
review/authorized live validation. This integration does not activate #46's live UI,
connect the standalone PDF parser, or solve public launch gates.

Repeatable mocked browser validation: with `FIT_LIVE_AI_ENABLED=false`, build and run
`npm run start -- --hostname 127.0.0.1`, then
`node scripts/contextual-impact-smoke.mjs`. It intercepts browser API responses;
actual access proxy → route → mocked AWS SDK → ledger integration is separately
covered by Vitest for three fictional jobs/conversations. No live-model result is
claimed by either test.
