# Private conversational Career Coach — Issue #64 deliverable B

This draft is stacked on the separately verified UI hub (#66). `/coach` links to `/coach/conversation`; the existing contextual interview → evidence report remains the main path. Free-form chat uses a **new** `/api/coach/message` endpoint. It never repurposes fit/interview APIs and never substitutes scripted responses when AI fails. The initial empty state contains no fake assistant answer.

## Data and modes

Only explicitly entered messages and optional resume/job text are sent. Each send re-sends the current bounded conversation and frozen optional context to the server and Amazon Bedrock. Code travels only as Authorization, never as prompt/query/storage. Consent is explicit, applies to each deliberate send and can be revoked. A successful strict response with live-mode header establishes the “Private live AI” state; errors clear it. Access is not assumed from opening the page or from the existing practice access check. Default-off servers show unavailable after an attempted send, retaining the unsent draft without fabricating a reply.

React memory only; no browser storage, cookies, database, telemetry or automatic cross-tool import. Clear, navigation, pagehide and reload remove active code/context/consent/history. Generation checks plus abort reject late results and duplicate submission. Retry requires a click and honors numeric Retry-After. The six-send bound never silently drops history. Context locks after the first accepted reply; clear to change it. Cancellation does not refund admitted server work.

Advice is plain escaped text, labeled **unverified** beside every Bedrock reply. It is not an evidence record, FitAnalysis, verified resume bullet or hiring prediction. The model is instructed to ask about problem, ownership, choices, tests and evidenced outcome, accepting unknown metrics. To produce a reviewed report use the existing contextual interview/Impact Lab; no transcript transfer is claimed.

## Default-off setup — names only

No settings were activated and no AWS calls made. After human approval only:

- Existing `FIT_LIVE_AI_ENABLED=true` and valid server-only `SCALEME_PRIVATE_AI_TOKEN` remain required by `requirePrivateAi`.
- New `COACH_LIVE_AI_ENABLED=true` is additionally required. Unset/false/typo means unavailable. Existing fit/interview activation alone never enables chat.
- Existing `AWS_REGION`, `BEDROCK_MODEL_ID`, credential role/profile and cost variables are reused. Coach requires `BEDROCK_MAX_ATTEMPTS=1` (default); `BEDROCK_TIMEOUT_MS` must be positive and at most 45,000 (default). Existing maximum output tokens is further capped at 500.
- `FIT_RATE_LIMIT_GLOBAL_PER_MIN`, `FIT_DAILY_CALL_LIMIT`, `FIT_MAX_CONCURRENT` still apply to a single shared process budget. There is no new budget or client identity/IP bypass.

Environment example/deployment/CI files are untouched to avoid overlapping draft #59. This document supplies the new setting's name and default. No model/IAM/region/credential changes are needed or authorized by this PR. Keep all deployment defaults off. Only a separately approved synthetic live test may validate the configured model, latency, errors and cost after owner review of private HTTPS hosting, processing region/provider retention, least privilege and distributed abuse controls. Existing process quotas are not public-launch protection.

## Contract and security

See [new additive endpoint contract](api-contract.md#private-conversational-career-coach-issue-64), [threat model](security/THREAT_MODEL.md#private-conversational-career-coach--issue-64), and [review checklist](security/REVIEW_CHECKLIST.md#private-conversational-career-coach--issue-64). Shared auth is unchanged; the new handler independently gates itself before reading data. Proxy limits free demo bypass to the two existing body-ignoring demo routes. No new externally callable function/action or client AWS path exists.

Known attacks are rejected before quota. Accepted data/history are tagged with a fresh random delimiter and JSON encoded. Model output must be strict bounded JSON; known markup/links/score language and numbers absent from candidate text are rejected, with no fake fallback. These checks are deliberately conservative **heuristics**, not semantic validation, comprehensive refusal or proof of injection resistance. History can be forged by an authorized client. No tools means the model cannot execute an injected action, but misleading prose is still possible. No real-model quality is claimed.

## Verification commands

From `web`: install with `npm ci --ignore-scripts`; `npm run lint`; `npm exec -- next typegen`; `npm exec -- tsc --noEmit`; `npm test`; `FIT_LIVE_AI_ENABLED=false COACH_LIVE_AI_ENABLED=false npm run build`; `npm audit --audit-level=high`. From root: `git diff --check`.

Run production on loopback with both switches false, then `node scripts/private-coach-smoke.mjs` for consent/error/mocked conversation screenshots, and the hub/evidence/contextual browser regression scripts. All SDK calls in unit/integration tests are mocked. Browser model success is intercepted; the genuine disabled-server 503 is separately checked. No live AWS behavior is implied.

## Review boundaries

Shared API contract, threat model and checklist receive isolated additive sections; no PDF/dashboard/shared UI modules, dependencies, lockfiles, provider wrapper or existing paid handler logic change. Preserve these sections when synchronizing #59. Stack merge order: #66, then retarget this draft to main and run main-targeted CI. No automatic retarget/merge or deployment is authorized. Safari/Firefox, physical devices and manual screen-reader review remain unverified.

## Screenshots

Before: the conversation route did not exist; see [legacy coach and hub before/after](CAREER_COACH_HUB.md#before--after). After screenshots use the production build, empty or fictional data only. “MOCKED TRANSPORT” in each sample reply is an explicit browser-test label, not evidence of a real Bedrock response.

| Viewport | Empty / no requests | Mocked conversation |
| --- | --- | --- |
| 320 | [Empty](screenshots/private-coach/empty-320.png) | [Mocked](screenshots/private-coach/mocked-conversation-320.png) |
| 390 | [Empty](screenshots/private-coach/empty-390.png) | [Mocked](screenshots/private-coach/mocked-conversation-390.png) |
| 768 | [Empty](screenshots/private-coach/empty-768.png) | [Mocked](screenshots/private-coach/mocked-conversation-768.png) |
| 1440 | [Empty](screenshots/private-coach/empty-1440.png) | [Mocked](screenshots/private-coach/mocked-conversation-1440.png) |

[Actual default-disabled server response](screenshots/private-coach/unavailable-1440.png). Phone and desktop screenshots were visually inspected.

## Executed results

Node 24.22.1. Install with scripts disabled, lint (zero warnings), Next typegen, TypeScript, **494 tests / 27 files**, production build (24 pages, both switches disabled), high/critical audit and diff check passed. Audit retains nine existing moderate tooling advisories; no dependency changes. Client chunks contain none of the private-token/coach-activation variable names or server invoker symbols. Existing unset metadataBase warning remains.

Production Chromium passed all four widths: empty/no mount call, actual disabled-server 503, explicit consent and header code, mocked full context/history, duplicate-submit prevention, 401/403/429/503/network states, manual retry without duplicate history, wrong-mode rejection, cancel/reset/exit late responses, six-send cap without dropping turns, escaped markup, clear/back/reload isolation and no cookies/storage/external requests. The hub, standalone evidence ledger and mocked contextual-impact regression suites also passed against the combined build. All after screenshots were visually inspected at phone/desktop widths.

Local Rust checks could not run because `cargo` is absent; Rust is unchanged. The UI base's [GitHub CI run 43742054994](https://github.com/charlierichards13/ScaleMe/actions/runs/43742054994) passed Web and Rust quality. The stacked endpoint branch requires its own CI run and human security review before readiness. No AWS API, deployment, merge or paid-service activation occurred.
