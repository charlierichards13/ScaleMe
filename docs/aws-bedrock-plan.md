# AWS Bedrock integration plan — ScaleMe MVP

**Owner:** @charlierichards13 (human). **Implementation partner:** Claude Pro on [Issue #6](https://github.com/charlierichards13/ScaleMe/issues/6).  
**Status:** Local live path verified once (2026-11-15): one synthetic request through `POST /api/fit/analyze` reached Amazon Nova Lite in `us-east-2` through a restricted IAM role. Still a private, local-only setup; not deployed.  
**Target:** A real resume + job-description analysis from the web app using AWS Bedrock, with structured evidence and truthful limitations.

## Keep the first deployment small

For the hackathon, use **Next.js Route Handlers in `web/src/app/api/`** as the server boundary:

```text
Next.js web / mobile PWA
   |
   POST /api/fit/analyze   { resume, job }
   |
   Input validation + evidence prompt
   |
   AWS Bedrock via @aws-sdk/client-bedrock-runtime (server only)
   |
   JSON schema validation
   |
   { analysis: FitAnalysis }  -> UI
```

The shared types and error format are described in [api-contract.md](api-contract.md). Build and test this slice before adding AWS Lambda, API Gateway, S3, authentication or background queues. A local server calling Bedrock is a real AWS-backed demo, but describe the architecture accurately.

## Configuration

The app should use **environment variable names** (not embedded credentials):

| Variable | Meaning |
| --- | --- |
| `AWS_REGION` | Region selected after confirming available model access. Verified setup: `us-east-2` |
| `BEDROCK_MODEL_ID` | Model identifier confirmed enabled in that region. Verified setup: `amazon.nova-lite-v1:0` (in-region, on-demand) |
| `AWS_PROFILE` | Optional local AWS CLI profile name; not a secret. Verified setup: a profile that assumes the restricted role (see below) |
| `BEDROCK_TIMEOUT_MS` | Optional; per-call timeout in milliseconds. Default `45000`; invalid values fall back to the default |
| `BEDROCK_MAX_OUTPUT_TOKENS` | Optional; maximum model output tokens. Default `3000`; invalid values fall back to the default |
| `BEDROCK_MAX_ATTEMPTS` | Optional; AWS SDK attempts per request, `1` to `2`. Default `1` (no automatic retry, so one request is at most one paid call) |
| `FIT_LIVE_AI_ENABLED` | **Required for live calls.** Real Bedrock calls happen only when this is `true` (case-insensitive). Default: off |
| `FIT_RATE_LIMIT_GLOBAL_PER_MIN` | Optional; live calls per sliding minute, shared by all callers, `1` to `600`. Default `10` |
| `FIT_DAILY_CALL_LIMIT` | Optional; live calls per sliding 24 hours, `1` to `10000`. Default `50` |
| `FIT_MAX_CONCURRENT` | Optional; model calls running at once, `1` to `20`. Default `2` |

The four cost-guard variables (`BEDROCK_MAX_ATTEMPTS` and the `FIT_*` limits) **fail closed**: if one is set to an invalid or out-of-range value, live requests return 503 instead of running without a limit. The limits are held in the memory of one server process; see the cost-guard section of `docs/security/THREAT_MODEL.md` for why that keeps the endpoint private-only.

`FIT_LIVE_AI_ENABLED=true`, `AWS_REGION` and `BEDROCK_MODEL_ID` are **all required** for live analysis. If the switch is off, the route returns `AI_UNAVAILABLE` (503, `retryable: false`) and never contacts AWS. Setting `AWS_REGION` and `BEDROCK_MODEL_ID` alone does not enable paid calls. If either AWS setting is missing, `POST /api/fit/analyze` returns `AI_UNAVAILABLE` (HTTP 503, `retryable: false`) without contacting AWS. Names are listed in `web/.env.example` (names only, no values). The code never reads access keys itself; the AWS SDK default provider chain supplies credentials server-side. Never create a `NEXT_PUBLIC_` variable for any of these.

### Verified AWS setup (2026-11-15)

Checked by the coding agent with read-only AWS CLI calls, IAM policy-simulator calls and free control-plane requests, then one approved live request. No account ID, credential or local path is recorded here.

**Account type: AWS's new project-based account experience.** The project is owned by an AWS Builder ID inside an AWS-managed organization. Console sign-in uses the AWS-managed `AccountFullAccessRole` (path `/managed/`). AWS-managed SCPs apply, and two of them shaped this setup:
- IAM users cannot get console passwords (`iam:*LoginProfile*` is explicitly denied), so the originally planned `scaleme-dev` IAM user could not be used. AWS documents that IAM users and roles in project accounts are for programmatic access only.
- Roles under `role/managed/*` are protected. Creating roles at other paths is allowed (confirmed with the IAM policy simulator).

We did **not** activate Advanced Features. Activation is irreversible and removes the project spend limit.

**Restricted role used by the backend:** `ScaleMeDevBedrockInvoke` at path `/scaleme/`.

| Setting | Value |
| --- | --- |
| Trust policy | Only the project's `role/managed/AccountFullAccessRole` may call `sts:AssumeRole`. No other principal, no wildcard |
| Permissions policy | Customer-managed `ScaleMeDevBedrockNovaLite`: `bedrock:InvokeModel` and `bedrock:GetFoundationModel` on `arn:aws:bedrock:us-east-2::foundation-model/amazon.nova-lite-v1:0` only. Nothing else |
| Permissions boundary | The same policy, so attaching another policy later cannot widen the role |
| Inline policies, instance profiles | None |
| Maximum session | 3600 s. This is also the hard limit, because the role is reached by role chaining |

**How local credentials work:** a human runs `aws login --remote` (CLI v2.32+) for the project session, into an admin CLI profile used only as the `source_profile`. A second CLI profile (`role_arn` + `source_profile`) assumes `ScaleMeDevBedrockInvoke`, and `AWS_PROFILE` names that second profile. Credentials are short-lived (role ≤ 1 h, auto-renewed; login session ≤ 12 h), and no access key exists anywhere. AWS does not document using a login-session profile as a `source_profile`. We verified it works with AWS CLI v2.40.3 and with the AWS SDK for JavaScript v3 default chain installed in `web/` (`@aws-sdk/credential-provider-ini` 3.973.x).

**Free verification of the restricted role:**
- `sts get-caller-identity` returned `assumed-role/ScaleMeDevBedrockInvoke/<session>` from both the CLI and the Node SDK.
- Reading Nova Lite in `us-east-2` was **allowed**.
- Every other probe was **denied** by the role's own policy: Nova Lite in other regions, Nova Pro, Claude Haiku 5.5, the `us.` inference profile, listing models, IAM, S3, EC2, Secrets Manager, and further `AssumeRole`.

**Why in-region Nova Lite:** `amazon.nova-lite-v1:0` supports `ON_DEMAND` in `us-east-2`, so no cross-region inference profile is needed. AWS's project-account documentation says cross-Region features are not supported, which made the `us.amazon.nova-lite-v1:0` profile a risk. The Claude Haiku 4.5 and 5.5 models in `us-east-2` are inference-profile only (cross-region). They are billed through AWS Marketplace, which requires a one-time subscription, and Haiku 4.5 also needs Anthropic's first-time-use form. Promotional credits likely do not apply to Marketplace charges. Nova Lite stays the baseline; any Claude evaluation is a separate, approved decision.

**AWS spend controls (owner-reported in AWS Settings):** a **$20** project spend limit, and an earlier **$5** budget notification. A spend limit pauses the project near the limit, and billing data can lag. The app-side cost guard remains the first line of defence.

### Implementation status of Issue #6 (merged to `main` in PR #33)

| Item | Status |
| --- | --- |
| `POST /api/fit/analyze` using the Bedrock Runtime **Converse** API (`@aws-sdk/client-bedrock-runtime`) | Implemented |
| `POST /api/interview/next`: same client, live switch and shared cost budget; 400 output tokens per turn | Implemented, mock-tested only (no live call). See [INTERVIEW_API.md](INTERVIEW_API.md) |
| Request/response validation, evidence-quote checking, advice grounding, safe errors, labeled `?demo=true` | Implemented, covered by **mocked** unit tests (95 tests in `web/`; no network, no credentials) |
| Real Bedrock invocation through ScaleMe | **Verified once** (2026-11-15): one synthetic request, HTTP 200, `X-ScaleMe-Mode: live`, about 4.5 s end to end. See "First live test" below |
| Real prompt-injection resistance, behavior across varied inputs, cost per call at scale | **NOT VERIFIED.** One clean synthetic request does not establish these |
| Chosen model, region, IAM policy | **Decided and verified:** `amazon.nova-lite-v1:0` in `us-east-2`, restricted role `ScaleMeDevBedrockInvoke` (above). No model ID is hardcoded in source |
| Usage metrics | Implemented: one numeric log line per call (token counts, model and wall latency, truncation flag). Mock-tested; see `docs/api-contract.md` |
| Rate limiting, concurrency cap, spend alarms | **Partly implemented** (Issue #23, mock-tested, and exercised once live with all limits set to 1): off-by-default live switch, per-process shared limits, concurrency cap, `429` before AWS, no SDK retries. **No** distributed limit or per-user fairness. Run only locally/privately with synthetic data |

### First live test (2026-11-15)

- **Setup:** a production build (`next start`) bound to `127.0.0.1` only. Live switch on for one request, then off again straight away. `FIT_DAILY_CALL_LIMIT=1`, `FIT_RATE_LIMIT_GLOBAL_PER_MIN=1`, `FIT_MAX_CONCURRENT=1`, `BEDROCK_MAX_ATTEMPTS=1`.
- **Input:** an entirely fictional resume and job posting with five supplied requirements, labeled as synthetic in the text. Before the paid call, free smoke tests passed: demo mode, malformed JSON, empty body, blank resume, missing job title, oversized body (413), valid input with live off (503), and GET (405).
- **Result:** HTTP 200 in about 4.5 s. The output passed the response schema and used exactly the supplied requirement IDs. The three expected `supported` requirements each had a resume quote, all **verbatim**. The two absent skills were `not_evidenced` with no evidence. No quote was dropped and nothing was downgraded. The server log contained no request or response text.
- **Quality findings (one sample, not a benchmark):**
  - One growth suggestion read as advice to add AWS experience the resume did not show.
  - Several clarification questions were generic rather than tied to a requirement.
  - Both are addressed in the prompt, and the first by a new deterministic server check (see `docs/api-contract.md`). These fixes are mock-tested only; they have not been re-run against the live model.
- **Cost:** a few thousand tokens at Nova Lite on-demand rates in `us-east-2` (AWS Price List: about $0.06 per 1M input and $0.24 per 1M output tokens), so well under $0.001. CloudTrail was not checked, because the restricted role has no CloudTrail access by design.

### Local setup for a live test (human, synthetic data only)

1. Confirm that the restricted role exists and has only the permissions above. Keep the project spend limit in place.
2. Sign in: `aws login --remote --profile <admin-login-profile>`, completed in a browser that is signed in to the project. This profile is only a `source_profile`; never point `AWS_PROFILE` at it.
3. Check the identity: `aws sts get-caller-identity --profile <restricted-profile>` must show `assumed-role/ScaleMeDevBedrockInvoke/...`. If it shows `AccountFullAccessRole`, stop.
4. Copy `web/.env.example` to `web/.env.local` (git-ignored). Set:
   - `AWS_PROFILE=<restricted-profile>`
   - `AWS_REGION=us-east-2`
   - `BEDROCK_MODEL_ID=amazon.nova-lite-v1:0`
   - the cost-guard limits as low as the test needs
   - `FIT_LIVE_AI_ENABLED=false`

   Run the free checks first (lint, `tsc`, tests, build, demo mode, invalid input, and valid input with live off returning 503).
5. From `web/`, run `npm run build`, then `npx next start -H 127.0.0.1 -p 3001`. Use another free port if needed. Never bind to `0.0.0.0` for live tests.
6. Set `FIT_LIVE_AI_ENABLED=true` and restart. POST **one fictional** resume and job to `http://127.0.0.1:3001/api/fit/analyze`. A real result has the header `X-ScaleMe-Mode: live`.
7. Stop the server and set `FIT_LIVE_AI_ENABLED=false` immediately, whatever the outcome. Restarting resets the in-memory counters, so never restart a live-enabled server to get more calls.
8. Check every `evidence.quote` against the input, then work through the negative cases in `docs/security/REVIEW_CHECKLIST.md` as separately approved live tests.
9. When finished, run `aws logout --profile <admin-login-profile>`. The project login can be renewed for up to 90 days, so do not leave it cached.

### IAM note

For the Converse API the server identity needs only `bedrock:InvokeModel` on the model ARN (`bedrock:GetFoundationModel` is included only for free read-only checks). **Verified** with the role above: the role could read Nova Lite in `us-east-2`, and calls to other models, regions or services were denied. Nova Lite here is in-region. A cross-region inference profile would instead need the profile ARN plus the foundation-model ARN in **every** destination region, with a `bedrock:InferenceProfileArn` condition. Third-party models also need a one-time AWS Marketplace subscription by someone with `aws-marketplace:*` subscription permissions. Never use a wildcard resource.

Do not commit a populated `.env.local`, access keys, long-lived credential strings or personal resumes. Prefer an AWS profile / SSO / role with short-lived credentials locally, and an attached execution role if hosted in AWS. The Node AWS SDK credential provider chain should obtain credentials server-side; never send them to the browser.

Confirm model access, region, invocation support and possible inference-profile requirements in your AWS account **before** choosing the exact API request. Avoid hardcoding a specific model ID in shared source code.

## Human setup checklist

- [x] Confirm that an AWS account/project is available and cost controls are appropriate for hackathon testing. (Project account with a $20 spend limit, owner-reported)
- [x] Select a Bedrock-enabled region and a model that the account is authorized to invoke. (`us-east-2`, `amazon.nova-lite-v1:0`)
- [x] Configure limited permissions to invoke **only** the selected model/resources. (`ScaleMeDevBedrockInvoke`, verified with allow/deny probes)
- [x] Configure local AWS credentials/profile securely. (`aws login` plus role chaining; no access keys)
- [x] Set `AWS_REGION` and `BEDROCK_MODEL_ID` in `web/.env.local` without committing the file.
- [x] Run a single harmless synthetic prompt to verify connectivity. (2026-11-15. Cost not yet seen in billing, which lags)
- [x] Test the complete resume/job payload against the route and shared schema.
- [x] Demonstrate a truthful failure state if AWS is unavailable. (Mock-tested; live: live switch off returns 503 with no AWS call)
- [ ] Clean up the unused `scaleme-dev` IAM user and its login policy (owner, after review).
- [ ] Run approved adversarial live tests (prompt injection, false-accomplishment bait) and a small synthetic benchmark.

IAM permission requirements may differ between invocation methods and models. Validate with AWS's current Bedrock documentation during setup rather than guessing a permissive wildcard policy.

## Agent implementation contract

Claude owns the fit-analysis API route and `web/src/lib/ai/` modules, not dashboard components or `services/matching-rust/`.

The API should:
1. Validate `{ resume: Resume, job: JobPosting }`.
2. Treat user-provided resume and job text as **untrusted data** in prompts, not instructions.
3. Request short structured results for `FitAnalysis`, including source evidence and uncertainty.
4. Validate/parse the model response rather than trusting unstructured prose.
5. Return a clean, stable `ApiError` on invalid input, timeout, unavailable model or invalid response.
6. Avoid logging applicant text, API credentials or raw model outputs with PII.
7. Use a **clearly labeled** synthetic demo mode if an offline fallback is implemented. Never display invented analysis as a live AI result.
8. Keep Rust matching separate until its interface and packaging are agreed on.

Tests should mock AWS client calls where possible. CI must be able to lint, type-check, and build **without AWS credentials**.

## Integration sequence

1. ~~Merge the issue #6 route as a reviewed PR after CI passes.~~ Done: PR #33.
2. Teammate connects the dashboard's "Analyze" action to the route's documented JSON response.
3. Review evidence correctness on a **synthetic** resume/job example. Done once live (2026-11-15). Adversarial and benchmark cases remain.
4. Integrate [Rust matcher #12](https://github.com/charlierichards13/ScaleMe/issues/12) as a separate service or deployment-compatible module once its JSON boundary is tested. Do not assume a native executable can run on every serverless host.
5. Reuse the Bedrock client patterns for mock interview and impact coaching, without copying security-sensitive configuration to the frontend.
6. Rehearse the 3-minute demo with a reliable, clearly labeled backup state.

## Do not expand this first slice

Avoid accounts, permanent resume storage, web scraping, detailed visa/authorization determinations, voice interviews, and multi-service AWS infrastructure until the original core experience works. Job discovery and student guidance are documented as later work in [#18](https://github.com/charlierichards13/ScaleMe/issues/18) and [#19](https://github.com/charlierichards13/ScaleMe/issues/19).

**Definition of done for this design task:** The team can identify the backend boundary, required configuration names, security responsibilities, integration steps and next human AWS account checks without relying on guesswork.
