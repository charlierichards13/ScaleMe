# AWS Bedrock integration plan — ScaleMe MVP

**Owner:** @charlierichards13 (human). **Implementation partner:** Claude Pro on [Issue #6](https://github.com/charlierichards13/ScaleMe/issues/6).  
**Status:** Design checklist; AWS model access and credentials are not yet verified.  
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
| `AWS_REGION` | Region selected after confirming available model access |
| `BEDROCK_MODEL_ID` | Model identifier confirmed enabled in that region |
| `AWS_PROFILE` | Optional local AWS CLI profile / SSO configuration; not a secret |
| `BEDROCK_TIMEOUT_MS` | Optional; per-call timeout in milliseconds. Default `45000`; invalid values fall back to the default |
| `BEDROCK_MAX_OUTPUT_TOKENS` | Optional; maximum model output tokens. Default `3000`; invalid values fall back to the default |
| `BEDROCK_MAX_ATTEMPTS` | Optional; AWS SDK attempts per request, `1` to `2`. Default `1` (no automatic retry, so one request is at most one paid call) |
| `FIT_LIVE_AI_ENABLED` | **Required for live calls.** Real Bedrock calls happen only when this is `true` (case-insensitive). Default: off |
| `FIT_RATE_LIMIT_GLOBAL_PER_MIN` | Optional; live calls per sliding minute, shared by all callers, `1` to `600`. Default `10` |
| `FIT_DAILY_CALL_LIMIT` | Optional; live calls per sliding 24 hours, `1` to `10000`. Default `50` |
| `FIT_MAX_CONCURRENT` | Optional; model calls running at once, `1` to `20`. Default `2` |

The four cost-guard variables (`BEDROCK_MAX_ATTEMPTS` and the `FIT_*` limits) **fail closed**: if one is set to an invalid or out-of-range value, live requests return 503 instead of running without a limit. The limits are held in the memory of one server process; see the cost-guard section of `docs/security/THREAT_MODEL.md` for why that keeps the endpoint private-only.

`FIT_LIVE_AI_ENABLED=true`, `AWS_REGION` and `BEDROCK_MODEL_ID` are **all required** for live analysis. If the switch is off, the route returns `AI_UNAVAILABLE` (503, `retryable: false`) and never contacts AWS. Setting `AWS_REGION` and `BEDROCK_MODEL_ID` alone does not enable paid calls. If either AWS setting is missing, `POST /api/fit/analyze` returns `AI_UNAVAILABLE` (HTTP 503, `retryable: false`) without contacting AWS. Names are listed in `web/.env.example` (names only, no values). The code never reads access keys itself; the AWS SDK default provider chain supplies credentials server-side. Never create a `NEXT_PUBLIC_` variable for any of these.

### AWS account status

**AWS status (reported by the project owner on 2026-11-14; not independently verified by the coding agent):** the AWS account has approved Amazon Bedrock access in `us-east-2`, and Amazon Nova Lite generated a response in the AWS console playground. **The ScaleMe API itself has NOT been tested against live Bedrock**: every ScaleMe test so far uses mocked AWS, so the route's real-model behavior (JSON compliance, evidence quality, prompt-injection resistance, latency, cost) is still unverified.

**AWS spend controls (reported by the project owner; current AWS configuration not independently verified):** an AWS budget notification at **$5** has been configured and a **$20** project spending limit has been selected. Neither is a guaranteed account-wide hard cap: a budget notification is an alert, not a stop, billing data can lag actual usage, and other usage in the account is not blocked. Treat them as early warnings on top of the app-side cost guard, not as a replacement for it.

### Implementation status of Issue #6 (merged to `main` in PR #33)

| Item | Status |
| --- | --- |
| `POST /api/fit/analyze` using the Bedrock Runtime **Converse** API (`@aws-sdk/client-bedrock-runtime`) | Implemented |
| Request/response validation, evidence-quote checking, safe errors, labeled `?demo=true` | Implemented, covered by **mocked** unit tests (29 tests; no network, no credentials) |
| Real Bedrock invocation, real model JSON compliance, real prompt-injection resistance, evidence quality, latency and cost | **NOT VERIFIED.** The ScaleMe API has not called live Bedrock (the owner's console-playground test of Nova Lite does not exercise ScaleMe code). Mocked tests prove our code, not model behavior |
| Chosen model, region, IAM policy | Owner reports Bedrock access in `us-east-2` with Amazon Nova Lite working in the playground (unverified by the agent). The ScaleMe model ID and least-privilege IAM policy are **not decided or verified**. No model ID is hardcoded |
| Rate limiting, concurrency cap, spend alarms | **Partly implemented** (Issue #23, mock-tested): off-by-default live switch, per-process shared limits, concurrency cap, `429` before AWS, no SDK retries. **No** distributed limit or per-user fairness. Owner-reported $5 budget notification and $20 spending limit are unverified and not a hard cap. Run only locally/privately with synthetic data |

### Local setup for a live test (human, synthetic data only)

1. Confirm in the AWS console that your account can invoke your chosen model in your chosen region (some models need an inference-profile ID instead of a model ID; use whatever your account's Bedrock console shows). Set an AWS budget or alarm first.
2. Sign in with short-lived credentials, for example `aws sso login --profile <your-profile>`.
3. Copy `web/.env.example` to `web/.env.local` (git-ignored) and set `AWS_REGION`, `BEDROCK_MODEL_ID`, `FIT_LIVE_AI_ENABLED=true` and optionally `AWS_PROFILE`. Keep the default cost-guard limits (or lower them) for a first test.
4. From `web/`, run `npm run dev`.
5. POST a **fictional** resume and job to `http://localhost:3000/api/fit/analyze` (header `content-type: application/json`, body `{ "resume": {...}, "job": {...} }`). A real result has the header `X-ScaleMe-Mode: live`.
6. Check every `evidence.quote` against the input by eye, then try the negative cases in `docs/security/REVIEW_CHECKLIST.md` (injection text, false-accomplishment bait, bad model ID, missing region) and record results there. Until that is done, describe live behavior as untested.

### IAM note

The identity running the server needs permission to invoke only the chosen model, which for the Converse API is the `bedrock:InvokeModel` action on that model's (or inference profile's) ARN. This is **not yet verified** against a real account; confirm against current AWS documentation and do not use a wildcard resource.

Do not commit a populated `.env.local`, access keys, long-lived credential strings or personal resumes. Prefer an AWS profile / SSO / role with short-lived credentials locally, and an attached execution role if hosted in AWS. The Node AWS SDK credential provider chain should obtain credentials server-side; never send them to the browser.

Confirm model access, region, invocation support and possible inference-profile requirements in your AWS account **before** choosing the exact API request. Avoid hardcoding a specific model ID in shared source code.

## Human setup checklist

- [ ] Confirm that an AWS account/project is available and cost controls are appropriate for hackathon testing.
- [ ] Select a Bedrock-enabled region and a model that the account is authorized to invoke.
- [ ] Configure limited permissions to invoke **only** the selected model/resources (subject to the Bedrock API and IAM rules for that model).
- [ ] Configure local AWS credentials/profile securely.
- [ ] Set `AWS_REGION` and `BEDROCK_MODEL_ID` in `web/.env.local` (copy of `web/.env.example`) without committing the file.
- [ ] Run a single harmless synthetic prompt to verify connectivity and observe usage/cost.
- [ ] Test the complete resume/job payload against the route and shared schema.
- [ ] Demonstrate a truthful failure state if AWS is unavailable.

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
3. Review evidence correctness on a **synthetic** resume/job example.
4. Integrate [Rust matcher #12](https://github.com/charlierichards13/ScaleMe/issues/12) as a separate service or deployment-compatible module once its JSON boundary is tested. Do not assume a native executable can run on every serverless host.
5. Reuse the Bedrock client patterns for mock interview and impact coaching, without copying security-sensitive configuration to the frontend.
6. Rehearse the 3-minute demo with a reliable, clearly labeled backup state.

## Do not expand this first slice

Avoid accounts, permanent resume storage, web scraping, detailed visa/authorization determinations, voice interviews, and multi-service AWS infrastructure until the original core experience works. Job discovery and student guidance are documented as later work in [#18](https://github.com/charlierichards13/ScaleMe/issues/18) and [#19](https://github.com/charlierichards13/ScaleMe/issues/19).

**Definition of done for this design task:** The team can identify the backend boundary, required configuration names, security responsibilities, integration steps and next human AWS account checks without relying on guesswork.
