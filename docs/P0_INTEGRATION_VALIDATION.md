# P0 integration handoff

Entry: `/interview` → **Open contextual interview**. Finish the AI interview, explicitly
associate answers with resume experiences, and build the evidence report in place.
The existing Impact Lab renders requirement transitions, exact sources and reviewed
copy. No navigation or persistence is needed for completion.

## Dependencies and review

Isolated branch: `feat/contextual-impact-integration`. Includes main (merged #50 parser,
unchanged), #54 `bb501d1` (including #49 `389285a`), #51 `2856cef`, and #46 `6095dcd`.
Initial CI on main and all four open PRs passed. Main advanced during implementation to
`39d8e0e` (#53 navigation), which is included. Existing source branches and PR states
were not modified. No PR was merged to main and no deployment/AWS action occurred.

Resolved conflicts: #46 and P0 both appended separate API-documentation sections;
retain both. #53 and #51 differed in the Impact Lab route comment; retain the implemented
local-workflow description and all incoming navigation behavior. No unresolved source
conflict. ESLint 10 peer warnings and nine existing moderate development-tool audit
advisories remain; zero high/critical, no manifest/lockfile change. Build retains the
existing `metadataBase` warning. The parser's unmaintained `ttf-parser` advisory remains
an inherited parser-review item; parser code is untouched.

## Demonstrated transition

Fictional resume: `Built web applications for a campus library booking desk.`
Requirements: `req-1` Build web applications, `req-2` Test web applications,
`req-3` Automate reports; all required. Mocked fit baseline: **1 of 3** supported.

Vague answer `I helped and it went well.` leaves **1 of 3**. Candidate then answers:
`I tested web applications with invalid bookings and mobile navigation before rollout.`
After explicit original-experience association, **2 of 3** are supported. The evidence
is `answer:interview-answer-3`, source `interview-answer-3` (handoff `turn-3`), offsets
`0–85`. The displayed quote is the entire answer, with `independentlyVerified: false`.
A later relevant denial returns the testing requirement to `unclear` and blocks its
proposal. A denial of the baseline building claim also reduces **1 of 3 → 0 of 3**.
Unsupported `Improved performance by 40%.` fails the wording guard.

The same checks pass for museum prototype testing and pantry inventory validation.
Browser tests additionally prove unlinked answers cannot change counts, both exact
source statements must be confirmed before copy, clipboard text equals the original
plus the candidate answer, confirmations reset on reassociation, and refresh clears all.

## Validation commands

From `web/`: `npm ci --ignore-scripts`, `npm run lint`, `npm exec -- next typegen`,
`npm exec -- tsc --noEmit`, `npm test`, `FIT_LIVE_AI_ENABLED=false npm run build`,
`npm audit --audit-level=high`. Final results are recorded in the draft PR.

Production loopback server with live inference disabled:
`node scripts/contextual-impact-smoke.mjs` and
`node scripts/evidence-ledger-smoke.mjs`. Both use fictional inputs and installed
Chromium without new dependencies. The first intercepts browser AI responses; unit
integration tests exercise actual handlers with mocked AWS. Mock tests temporarily
set the live gate only around the mocked SDK; no paid call occurs. The first standalone
smoke run's assertions passed but temporary-profile cleanup raced Chromium; bounded
cleanup retries fixed the harness and the rerun exited successfully. An initial
sandboxed build could not fetch fonts/launch a worker; a clean generated cache and
permitted build environment succeeded without changing application configuration.

## Remaining steps for judges

1. Human review of the stacked dependencies and this completion integration; retain draft
   until CI passes and review is complete. Merge ordering is an owner decision.
2. Separately authorize a small synthetic, cost-bounded live rehearsal on the existing
   private setup. Check actual model follow-ups, varied/adversarial wording, citations,
   response failures and latency. No live-model validation is claimed here.
3. Confirm private access/HTTPS, restricted identity, budgets and provider-retention
   settings before activating live inference. Keep `FIT_LIVE_AI_ENABLED=false` otherwise.
4. Rehearse the three-minute loop with a known relevant candidate answer and inspect its
   exact quote. Keep the separately labeled scripted practice as the offline backup.

Limits: conservative English lexical evidence review can miss synonyms and misread
complex attribution or polarity. A valid action with “not measured” may remain
unresolved; unknown metrics are never estimated. Proposals are exact extractive joins,
not fluent model rewrites, and need supported original citations. No independent
verification, persistent sessions, live Fit Explorer activation, PDF upload wiring,
public deployment readiness or manual screen-reader validation is claimed.
