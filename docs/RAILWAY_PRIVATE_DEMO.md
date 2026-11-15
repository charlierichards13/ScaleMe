# Private Railway Bedrock demonstration

Reviewed main `8a95366e2a86a65b5a6e43318580b53b5ba00e19`, 2026-11-15.
**NO-GO for live judge access until the owner completes the gates below.**
No deployment, live enablement, model invocation or IAM change was performed.
The connected Railway account returned no projects; no deployed service, current
AWS identity/policy or credential expiry could be verified. Historical AWS results
in [aws-bedrock-plan.md](aws-bedrock-plan.md) are repository records, not new checks.

## Existing implementation reviewed

`/interview/contextual/workspace.tsx` calls `analyzeContext()` and `nextQuestion()`
in `lib/contextual-interview/client.ts`. They POST to existing `/api/fit/analyze`
and `/api/interview/next`, without `demo=true`, require `X-ScaleMe-Mode: live`, and
validate responses. Both handlers use `lib/ai/bedrock.ts` and SDK Converse. There
is no fixture substitution on failure. `/interview` and exact `?demo=true` remain
separately labeled fictional, AWS-free practice. Unlock/page load does not invoke
a model; `/api/practice/access` checks authorization, not AWS readiness.

| Area | Finding / constraint |
| --- | --- |
| Access | Production proxy guards both paid APIs and the access check. Constant-time bearer-code comparison and no-store responses. UI/static pages and labeled demos remain public. No individual accounts/fairness. |
| Proxy | Request-URL origin checks can reject browsers after TLS termination. New `SCALEME_PRIVATE_AI_ORIGIN` pins the public HTTPS origin and is required when `RAILWAY_ENVIRONMENT_ID` exists. Forwarded headers cannot choose it. Authenticated scripts may omit Origin; Origin is not authentication. |
| Cost | Shared minute/day/concurrency guard, 429 + Retry-After, admitted failures count, slots release in `finally`. Counters are **per process**, reset on restart/config change. One replica/process, no autoscaling or overlapping live deployments. Restarting is not permission for more calls. |
| Tokens/time | Fit defaults to 3000 output tokens; interview at most 400. New fail-closed bounds: output tokens 1–4096, timeout 1–45000 ms. Previously arbitrary large values were accepted and malformed values silently defaulted. |
| Retries/errors | Set SDK attempts to 1; code permits 2, potentially doubling attempts per admitted request. No app retry loop; UI retries require a click. Cancellation/timeouts may still incur charges. Expired/invalid sessions now return non-retryable 503: rotate rather than retry. |
| Validation | Streamed body 200000 bytes, resume 30000 chars, job 20000, 30 requirements; interview 12 history turns, 2000 chars each. Alternation, targets and fit IDs checked before model use. |
| Grounding | Schemas, source-quote checks, unsupported evidence removed/downgraded, numeric/advice checks. Client rejects incomplete/duplicate requirement coverage. Server plans targets; model words questions. Quote presence and lexical checks do **not** prove semantic entailment or independent truth. |
| Privacy | Numeric usage logs, generic errors, escaped React output, no new storage/fallback. Provider retention and real-model injection resistance remain unverified. |

## Credentials with unchanged trust

The client intentionally omits `credentials`. The installed SDK default chain
supports temporary environment sessions, role profiles, `credential_process` and
web identity. An offline probe with deliberately fictional values confirmed
session-token/expiration resolution, **not AWS authentication**. No SDK rewrite is needed.

The repository records `ScaleMeDevBedrockInvoke` trusting only
`/managed/AccountFullAccessRole`, with Nova Lite-only permissions/boundary and a
3600-second maximum session. Railway does not inherit a developer's profile or an
AWS instance role. Railway docs searches found user OAuth/OIDC but did not establish
renewable AWS workload identity for this service. A role ARN alone is insufficient.
Web identity / Roles Anywhere require matching trust/providers; none are established.
Do not change IAM, create permanent IAM user keys, or upload the administrative
source profile/login cache to Railway.

Prefer an **already established** trusted renewable credential process/broker
under unchanged trust that returns only restricted sessions. None was found here;
do not build new infrastructure for this demo. The documented feasible fallback
is a human-issued restricted STS session, transferred by the owner through a
secret-safe process into Railway's server-only variables. The agent must not
receive, capture, print or commit credentials.

Temporary variable names: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_SESSION_TOKEN` (all three), `AWS_CREDENTIAL_EXPIRATION` (non-secret ISO expiry
metadata supported by the installed SDK). Record actual AWS-issued UTC expiry
privately: **unavailable here**. Role chaining is at most one hour; remaining
validity can be shorter. Environment sessions do not renew themselves.

Rotation: schedule shutdown before expiry, set `FIT_LIVE_AI_ENABLED=false`, allow
in-flight calls to finish, obtain another restricted session via the same human
login, replace all three variables together plus expiry without terminal output,
history, screenshots or repository files, and restart while disabled. Recheck
identity/lifetime before approved enablement. Remove credentials/app code after
judging. Do not reset budgets through rotation/restarts.

Sources: [AWS Node credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html),
[web identity](https://docs.aws.amazon.com/sdkref/latest/guide/access-assume-role-web.html),
[Roles Anywhere prerequisites](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html),
[STS one-hour chaining limit](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

## Owner gates

1. Review this PR; approve merge/deployment separately. Confirm Railway account,
   project/service, root `web`, build `npm ci && npm run build`, start
   `npm run start -- --hostname 0.0.0.0` (Next uses Railway `PORT`). One process /
   replica, HTTPS, no live preview deploys. Keep `FIT_LIVE_AI_ENABLED=false` during setup.
2. Securely create/distribute separate high-entropy `SCALEME_PRIVATE_AI_TOKEN`
   (32–256 URL-safe characters). Set `SCALEME_PRIVATE_AI_ORIGIN` to the exact public
   HTTPS origin, no trailing slash/path. Rotate the app code after judging.
3. Configure `AWS_REGION=us-east-2`, `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0`,
   `BEDROCK_MAX_ATTEMPTS=1`, `BEDROCK_MAX_OUTPUT_TOKENS=3000`,
   `BEDROCK_TIMEOUT_MS=45000`, `FIT_RATE_LIMIT_GLOBAL_PER_MIN=3`,
   `FIT_DAILY_CALL_LIMIT=3`, `FIT_MAX_CONCURRENT=1` for the first rehearsal.
   Independently confirm AWS budget/project spend controls. Request limits are not
   a dollar guarantee. Never broaden the role to another model.
4. Verify free STS GetCallerIdentity **inside Railway's runtime**; require
   `assumed-role/ScaleMeDevBedrockInvoke/…`, never admin. Verify actual role trust,
   policy/boundary, expiry, and optionally an allowed free GetFoundationModel read.
   No AWS credentials/CLI were available here. Never print credential-provider
   objects or AWS CLI credential-export output.
5. Run free production checks below. After approved deployment repeat off-switch
   503 and free demos through **actual HTTPS Railway**. During an approved
   enablement window verify access 200, missing/wrong code 401, wrong-origin 403
   on all protected endpoints before valid AI requests. Local proxy simulation
   does not establish Railway edge behavior.
6. After credentials, limits, private access and production checks are verified,
   obtain explicit paid-test approval, enable the switch and run the synthetic
   test below. Disable immediately after success/failure; no automatic retry.
   Review actual output/usage, then separately approve judge budget/time window
   and ensure credentials last through it.

No `NEXT_PUBLIC_` secrets. `AWS_PROFILE` is for a local restricted profile, not
credentials on Railway; remove stale profile/env settings for the temporary-env
path. Optional `SITE_URL` sets metadata, not the access origin.
`RAILWAY_ENVIRONMENT_ID` and `PORT` are Railway-owned.

## Repeatable verification

From a clean `web/` checkout without populated dotenv files:

```sh
npm ci --ignore-scripts
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
FIT_LIVE_AI_ENABLED=false npm test
FIT_LIVE_AI_ENABLED=false npm run build
node scripts/private-production-smoke.mjs
npm audit --audit-level=high
```

The smoke script starts isolated loopback-only production processes, discards
inherited AWS settings and leaves model/region unset. Enabled-gate test processes
only exercise authorization; requests stop before SDK construction. It never
changes Railway or enables a configured live service.

After **explicit paid-test approval**, securely supply `SCALEME_LIVE_E2E_APPROVED=true`,
`SCALEME_LIVE_E2E_ORIGIN` (approved exact origin), and `SCALEME_PRIVATE_AI_TOKEN` to
the test process. Never put the token in a command/file. Run:

```sh
npm exec -- vitest run src/lib/contextual-interview/live.e2e.test.ts
```

No mocks, demo query, fallback or retry: the existing browser adapter calls real
HTTP APIs for fictional resume/job analysis, first question, and follow-up after a
fictional candidate answer: **three admitted paid requests**, plus free access check.
Server configuration must already pin Nova Lite; a mode header does not attest
model identity. CI skips this test. Human review must check relevance, unknown
metrics and unsupported claims in the actual browser. This is not a live browser
or adversarial-model evaluation.

Verified here: lint, typegen, TypeScript, production build; **445 tests passed /
one live test skipped**, 24 passing files; **35 production HTTP checks passed**.
Audit: **0 high/critical, 9 existing moderate development dependency findings**.
No dependency changes. Existing production Chromium smoke passed for three fictional
profiles, mobile, evidence handoff and session clearing with **mocked AI transport**.
Rust was unchanged; local Rust tooling absent. CI results are recorded in the PR.
**No actual inference, Railway deployment, AWS
identity/policy verification or live adversarial test was performed.**

Tell judges “fictional candidate/job, processed by real Amazon Nova Lite” only
after approved inference succeeds. Answers remain `candidate_reported`; candidate
confirmation is not independent verification. Quotes establish source text, not
verified real-world achievements. Offline demos remain fictional fixtures.
