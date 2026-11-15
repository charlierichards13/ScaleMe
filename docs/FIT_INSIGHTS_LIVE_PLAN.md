# Fit Evidence Explorer: future live analysis PR

Investigation for PR #46, after integrating backend PR #38 (`ffc072be`), 2026-11-15.
This is a plan, not an activation. `/fit-insights` still prepares local drafts and loads
only an explicitly requested fictional demo. No runtime setting unlocks live browser calls.

## What is available

The existing backend accepts `{ resume: Resume, job: JobPosting }` at
`POST /api/fit/analyze` and returns `{ analysis: FitAnalysis }`. Its v0.1 wire schemas and
limits are unchanged by PR #38. `toFitRequest` in `web/src/lib/fit/draft.ts` already makes
a compatible request from the existing resume, job-title and job-description fields.
Pasted text can therefore support a first live slice without PDF parsing or URL fetching.

PR #38 adds an off-by-default server switch, per-process shared minute/day/concurrency
limits, generic non-retryable 503 failures, 429 plus `Retry-After`, bounded SDK attempts,
numeric usage logs and advice-grounding heuristics. The owner reports one independently
reviewed, successful synthetic Nova Lite end-to-end request; this integration reruns no
paid call. See [backend setup and prior evidence](aws-bedrock-plan.md).

The current browser adapter reuses `FitAnalysisSchema`, accepts empty advice arrays and
handles these error envelopes. Its **live request is rejected before fetch**. `FitResult`
permits only `mode: "demo"`; response validation requires the demo header and DEMO prose.
`ApiResults` labels every result and resume quote as fictional. Enabling only the server
switch or only the disabled button would not produce a working, correctly labeled flow.

## Proposed scope and file changes

1. **Explicit live submit, local state only.** In
   `web/src/app/fit-insights/fit-explorer.tsx`, connect the existing Analyze control to
   validated drafts only in a deliberately authorized private live setup. Show what is
   sent to Amazon Bedrock, the processing region, retention/logging limitations and an
   informed-consent action before submission. Keep draft checking local. Never submit on
   mount, query selection, typing or mode changes. Preserve the separate bodyless fictional
   demo and offline walkthrough; no automatic sample fallback.
2. **Typed transport and response mode.** Extend `web/src/lib/fit/client.ts` with a
   discriminated demo/live result. Live posts JSON from `toFitRequest` to the existing
   endpoint **without** `?demo=true`, with `Content-Type: application/json`. Keep same-origin
   transport, rejected redirects and no storage. Require `X-ScaleMe-Mode: live` for live
   success; retain DEMO header/prose checks for demo success only. Never relabel a demo as
   a personal analysis. Do not import server configuration, AWS SDK or credentials into
   the browser. Any future session/auth transport requires a separate reviewed design.
3. **Honest result presentation.** Update
   `web/src/app/fit-insights/api-results.tsx` to derive provenance text, source labels,
   headings and counts from the validated result mode. Live evidence is candidate-reported,
   not independently verified. Keep escaped rendering, source/status checks, duplicate-ID
   rejection, empty-list states and hiring-probability disclaimers. Bind results to the
   submitted snapshot; edits, clear, cancel or mode changes must discard stale results.
4. **Coordinate timeouts and failures.** The client currently times out at 15 seconds;
   the backend defaults to 45 seconds. Agree on a bounded server deadline and longer
   client deadline, and explain that browser cancellation does not guarantee cancellation
   of already admitted/billable model work. Preserve manual retries only; wait at least
   `Retry-After` on 429. Distinguish non-retryable disabled/misconfigured 503 from retryable
   transient 503/504, malformed 502, validation 400/413 and network failures. Do not retry
   automatically or treat server availability as consent to invoke a paid model.
5. **Regression coverage and documentation.** Extend the client, draft, result and
   handler/client integration tests, plus production-browser flows. Prove one explicit
   submit sends exactly the checked snapshot; demo never sends it; disabled configuration
   never reaches the provider; wrong modes, duplicate IDs, unsupported/interview-only
   evidence and hostile prose fail safely. Cover empty advice, 429 cooldown, 503/504/502,
   cancellation and stale responses. Update the API consumer notes, integration guide and
   threat/review addendum with the new personal-data boundary. Run CI with mocked AWS.

The relevant files are owned by this fit integration. Coordinate any necessary backend
guarantees with its owner instead of silently changing handlers or AI code. Existing
onboarding, dashboard, interview and PDF-parser implementations are outside this slice.
Cross-page handoff, PDF extraction and job-URL ingestion remain separate integrations.

## Gates before activation

- **Private synthetic milestone:** obtain explicit authorization for the live client PR
  and any paid verification; bind the server to loopback or use reviewed private access.
  Preserve the server's off default. An operator configures the existing approved model,
  region and restricted identity independently; this plan requires no IAM or credential
  changes. Do not expose the unauthenticated paid endpoint publicly.
- **Real applicant data:** first resolve provider disclosure, consent, regional processing,
  vendor/request logging, retention/deletion and session isolation. The backend sends full
  resume text plus job title/company/text to Bedrock; local draft privacy language must
  change for that action. Browser ephemeral state alone is not a provider-retention policy.
- **Cost and abuse:** per-process anonymous budgets reset on restart, are not distributed
  and provide no per-user fairness or hard account-spend ceiling. Public availability
  requires the human-owned authorization/access, shared quota and budget/alert decisions
  tracked in [#23](https://github.com/charlierichards13/ScaleMe/issues/23) and SECURITY.md.
  A client flag is not access control. Keep these decisions outside this integration PR.
- **Model quality:** the single prior synthetic success does not verify varied or
  adversarial inputs. Any new live benchmark needs separate cost-bounded authorization
  and synthetic fixtures ([#24](https://github.com/charlierichards13/ScaleMe/issues/24)).
  Quote substring matching and numeric/verb heuristics do not prove semantic support or
  catch every invented claim; schema-valid prose remains untrusted.

## Contract limits to preserve

v0.1 returns requirement IDs, statuses, evidence and analysis-wide questions. It does not
return extracted requirement descriptions/importance or per-requirement question links.
If `job.requirements` is omitted, the backend extracts IDs, but no inventory accompanies
the response. Continue displaying returned-assessment counts, not an invented required-skill
denominator. If a richer inventory is needed, agree an additive contract with the backend
owner first; request-supplied IDs can label only an inventory the caller actually has.

Interview reassessment, stable before/after snapshots, a general evidence ledger and impact
rewrites require separate agreed APIs. Do not feed the fictional offline interview state
into real results or imply these planned v0.2 capabilities exist.

No live client implementation, activation, AWS invocation, deployment or other developers'
implementation changes are included in this investigation.
