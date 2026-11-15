# Career Coach hub — Issue #64, deliverable A

`/coach` replaces the old keyword comparison, generic canned chat, duplicated five-question interview and template impact answer with navigation to merged workflows. No fake model output or unused composer remains. Approved `Logo`, global brand colors and inherited Geist are used in a scoped layout; the dashboard/shared shell owned by draft #60 is untouched.

## Working paths and demo route

Dashboard → Career Coach → **Open contextual interview** → enter private access → paste context → explicitly consent to analysis → contextual follow-ups → associate answers with exact experiences → evidence impact report and confirmation. Opening Coach or following a link invokes no model. Private AI requires existing enabled server configuration, owner-distributed code and consent; it remains disabled by default. Use synthetic data until provider/privacy and hosting reviews are complete.

Other explicit choices:

- Fit Explorer: local pasted drafts; fictional sample only when deliberately chosen there; live analysis UI locked.
- Impact Lab: local resume/requirement/answer review, exact sources and candidate confirmation. Conservative lexical matching is not independent verification.
- `/interview`: separate scripted practice with fictional sample context.
- Resume Lab: verified merged placeholder, accurately labeled upload unavailable. Draft #59 is not inherited.

Page-local memory is cleared on leaving/reloading. No automatic resume/job/answer transfer is claimed. The contextual report remains in that feature's existing React tree. Approved live submissions send context to the server and Bedrock; the hub makes no blanket “never uploaded” claim.

## Before / after

Only empty/fictional data. Before screenshots use the original development build at main `8a95366`; after screenshots use the production build of this PR. Full-page after views capture the primary path and every alternative.

| Width | Before | After |
| --- | --- | --- |
| 320 | [Before](screenshots/coach-hub/before-320.png) | [After](screenshots/coach-hub/after-320.png) |
| 390 | [Before](screenshots/coach-hub/before-390.png) | [After](screenshots/coach-hub/after-390.png) |
| 768 | [Before](screenshots/coach-hub/before-768.png) | [After](screenshots/coach-hub/after-768.png) |
| 1440 | [Before](screenshots/coach-hub/before-1440.png) | [After](screenshots/coach-hub/after-1440.png) |

## Repeatable checks

From `web`: `npm ci --ignore-scripts`, `npm run lint`, `npm exec -- next typegen`, `npm exec -- tsc --noEmit`, `npm test`, `FIT_LIVE_AI_ENABLED=false npm run build`, `npm audit --audit-level=high`. From root: `git diff --check`.

Start the production server on loopback with `npm run start -- --hostname 127.0.0.1`, then `node scripts/coach-hub-smoke.mjs`. Chromium verifies all five destinations exist and navigate, dashboard → Coach → dashboard, a single main landmark, brand loading, keyboard skip/focus, no horizontal overflow at 320/390/768/1440, reduced motion, and no API calls, non-GET/external requests, cookies or storage. It regenerates the four after screenshots. Existing `evidence-ledger-smoke.mjs` and `contextual-impact-smoke.mjs` cover downstream workflows; the latter uses mocked AI transport.

No API, schema, prompt, dependency, storage, telemetry, auth, AWS or feature-owned modules change. No new external data flow: threat model/API contract need no changes for this navigation-only PR. No merge/deployment/live inference. Firefox/Safari, physical devices and manual screen-reader review remain unverified. Resume Lab copy must be synchronized after #59 merges.

## Executed verification

Node 24.22.1; no dependency changes. Install, lint (zero warnings), typegen, TypeScript, **424 tests / 24 files**, production build (22 pages), diff check and all three production Chromium suites above passed. Audit: nine existing moderate development-tool advisories, zero high/critical. Existing unset `metadataBase` warning remains. Screenshots were visually inspected at phone and desktop widths. No AWS request was made.
