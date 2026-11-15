# Fit Evidence Explorer: frontend integration

`/fit-insights` provides local resume/job draft preparation, an explicitly selected fictional
API demonstration, and a separate offline interview walkthrough. Live analysis is disabled.
This change does not make the application ready for public real-data use.

## Functional today

The existing `/fit` workspace entry links to `/fit-insights` and explains preview versus
live availability. Shared sidebar/route definitions remain unchanged for PR #45.

- Responsive input/results panels with route-local styles, existing palette/font,
  workspace/Impact Lab links, skip link, visible focus, associated field help/errors,
  focus on the first invalid field and result feedback, status announcements and native controls.
- Resume text, job title and job-description drafts in React memory. Local checks validate
  nonempty fields, character limits (30,000 / 200 / 20,000), and the existing 200,000-byte
  JSON limit including escaping/UTF-8. `toFitRequest` prepares the v0.1 shape. No analysis runs.
- Editing invalidates the readiness message; Clear drafts removes all fields and feedback.
  No browser storage, logging, telemetry, uploads or URL retrieval was added. Browser/Next.js
  back navigation can retain component memory; use Clear drafts or reload to discard it.
  Changing the demo query retains drafts but cancels/discards API state.
- Select **Fictional API demo** to navigate to `/fit-insights?demo=true`, then press
  **Load fictional sample**. The URL alone never starts a request. Only exact `demo=true`
  selects this mode. No failure automatically selects a demo or fabricates a result.
- A bodyless `POST /api/fit/analyze?demo=true` loads the existing fixed server fixture.
  Draft content is never submitted; the handler makes no AWS call. The browser sends no
  cookies, follows no redirects, uses no cache and makes no automatic retries.
- Validated results display all three statuses, exact quotes/source labels, explanations,
  strengths, overall questions and suggestions. Missing quotes and empty status filters
  have explicit states. Job quotes describe requirements, not candidate capability.
  React escapes all output. Counts describe returned assessments, not hiring probability.
- **Open offline walkthrough** reveals the original hand-written interview scenario. It has
  separate fixtures and approved evidence links; it does not consume drafts or API results.
  See [offline walkthrough](FIT_INSIGHTS_DEMO.md).

The fixed API fixture currently returns one supported and one not-evidenced assessment;
its unclear count is zero. Mocked tests cover unclear assessments too. The UI does not
invent an extra assessment to fill that category.

## Reusable client and failure handling

`web/src/lib/fit/client.ts` exports `analyzeFit`, `FitResult`, `FitClientError` and existing
request/analysis types. It imports the existing browser-safe Zod schemas from
`lib/ai/schemas.ts`, without moving backend-owned files or duplicating contracts. It never
imports the AWS SDK, server configuration or AI orchestrator.

```ts
const result = await analyzeFit({ mode: "demo" }, { signal });
// analyzeFit({ mode: "live", input }) rejects LIVE_DISABLED before fetch.
```

Only demo results can be returned. Live mode is rejected regardless of valid inputs,
query strings, environment configuration or backend availability. There is no runtime
switch to enable it. No draft is passed to the demo call.

The adapter validates `{ analysis: FitAnalysis }` and field bounds, `X-ScaleMe-Mode: demo`,
existing DEMO summary/disclaimer markers, unique requirement IDs and endpoint-compatible
source/status combinations. It rejects interview evidence and supported claims without a
resume quote. These are consistency checks, not semantic or independent verification.
The fixed server sample is not checked against unrelated local drafts.

The contract does not return extracted requirement descriptions, importance categories,
source IDs, snapshots or question-to-requirement links. Results show IDs and overall
questions; counts cover returned assessments, not a required-skill denominator. Richer
offline fixture types are never treated as wire types.

Failures have safe fixed messages: invalid request/resume/job, network rejection, a
15-second timeout, cancellation, malformed JSON/schema/mode/source inconsistencies,
unavailable AI, invalid AI output and generic HTTP failures. Raw server prose/diagnostics
are not displayed. HTTP 429 uses Retry-After seconds/date or a 30-second fallback, with
a disabled retry countdown. There is no automatic retry or sample substitution. Nonretryable
errors disable retry; clear/exit remain available. Cooldown is UX, not backend abuse
protection, and resets on exit/reentry. Pending results are ignored after cancel/mode change.

## Planned and separately gated

Live analysis, PDF parsing, job ingestion, extracted descriptions/importance, interview
submission/reassessment, the v0.2 evidence ledger, live before/after coverage, persistent
profiles and cross-page handoff remain unimplemented here.

Before enabling live calls: merge/review the backend security work, then obtain separate
explicit authorization for a client change. Revisit disclosure/consent, provider processing
and retention, abuse/cost controls, server-side quote/requirement provenance and live failure
behavior (#23 / #24). No configuration is needed for this fictional demo. The browser lock
does not secure direct backend requests. Backend handlers, AI code, AWS settings and
credentials are unchanged. No live AWS/model behavior was tested; nothing was deployed.

PR #45's file set, including shared navigation, homepage/dashboard/onboarding, README and
central security docs, is untouched. The focused [security addendum](security/FIT_INSIGHTS_CLIENT_REVIEW.md)
records the threat/checklist delta without colliding with that developer's work.

## Verification

From `web/`, using Node 24.22.1 / npm 11.9.0 (CI uses Node 22):

```sh
npm ci --cache /workspace/work/npm-cache
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm test
npm run build
npm audit --audit-level=high --cache /workspace/work/npm-cache
```

The cache argument is only for a writable managed-workspace cache, not application configuration.
All checks passed: 101 tests across 10 files, including 42 new client, draft and presentation
cases. New mocked-network tests cover blocked live invocation, bodyless demo requests,
invalid/mislabeled/duplicate/provenance-inconsistent responses, safe HTTP errors, 429 headers,
network rejection, cancellation and timeout. Draft/presentation tests cover required fields,
character/encoded-byte limits, v0.1 compatibility, all statuses, empty sections and escaped
hostile prose. Existing backend tests remain mocked.

Production Chromium checks (Playwright outside the repo; system Chromium): widths
320 / 390 / 768 / 1440, no horizontal overflow, validation/focus, locked live button,
explicit load and real **no-AWS demo** endpoint, filtering/empty recovery, offline comparison,
loading/cancel, stale results after mode exit, mocked network/429/unavailable AI/wrong-mode
failures, hostile markup, reload clearing, no browser storage or exceptions, and reduced
motion preference. Keyboard checks cover the skip link, first invalid field and filter recovery. Every observed UI API request was a bodyless demo POST. This is not a
manual screen-reader audit. Axe WCAG A/AA checks found no violations in the explorer
(preparation, API results, offline before/after) or the route-owned `/fit` main content.
A full `/fit` scan flags existing contrast in shared sidebar status badges and the Account
label; those PR #45-owned styles were left unchanged. Two low-contrast colors in the
route-owned offline walkthrough were corrected. Current captures contain only fictional content:

- [Preparation, desktop](screenshots/fit-insights/integration-preparation.png)
- [API demo, desktop](screenshots/fit-insights/integration-api-desktop.png)
- [API demo, mobile](screenshots/fit-insights/integration-api-mobile.png)

Dependency manifests/lockfile are unchanged. Audit passes the high/critical threshold;
nine existing moderate minimatch/ESLint development-tree advisories remain. No Rust crate
exists on starting main, so Rust checks do not apply. Human review is required before merge.
