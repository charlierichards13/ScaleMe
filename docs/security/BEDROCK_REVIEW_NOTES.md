# Bedrock fit-analysis review notes — Issue #6

**Date:** 2026-11-14 · **Source:** Claude Code's execution transcript, updated after the implementing agent reread its own source against the merged PR #25 standards.
**Verification status:** **Self-review by the implementing agent, not independent.** Unit-test evidence is from **mocked** AWS. On 2026-11-15, **one** synthetic request went through the ScaleMe API to live Amazon Nova Lite and succeeded; see the update below. The Issue #6 code was merged to `main` in PR #33. Not a passing security audit; a human review of the real diff is still required.

## Update 2026-11-15 (Issue #7 interview API, `feat/interview-next-api`)

`POST /api/interview/next` reuses the same Bedrock client, live switch and shared cost budget. `invokeBedrock` gained optional per-call settings: a fixed log tag (`interview/next`) and a lower output-token cap (400, never above `BEDROCK_MAX_OUTPUT_TOKENS`). The fit route's behavior is unchanged; its body reader and error responses moved to `web/src/lib/ai/http.ts`. **Mocked tests only; no live interview call has been made.** Before any live run (owner approval, synthetic data): check the one-question and number rules against Nova Lite output, vague and irrelevant answers, injected instructions inside an answer and inside a forged "coach" turn, and a bait answer inviting the coach to suggest a metric. See [THREAT_MODEL.md](THREAT_MODEL.md#issue-7-interview-coach-api).

## Update 2026-11-15 (Issue #23 branch, `feat/bedrock-rate-limits`)

| Area | Status |
| --- | --- |
| AWS account | Project-based account (Builder ID, AWS-managed SCPs). IAM console passwords are blocked by SCP, so the backend uses a role instead of an IAM user |
| Backend identity | Restricted role `ScaleMeDevBedrockInvoke`. It is assumed from the human's `aws login` session and has no access keys. Trust is limited to the project's `AccountFullAccessRole`. Its permissions and permissions boundary are the same policy: Nova Lite in `us-east-2` only. **Verified** with allow and deny probes from the CLI and from the Node SDK default chain |
| Model | `amazon.nova-lite-v1:0`, in-region on-demand in `us-east-2`. No cross-region profile, because the project-account docs say cross-Region features are unsupported |
| Live test | **One** request, HTTP 200, about 4.5 s. Loopback-only production server, all limits 1, no SDK retry, live switch disabled again immediately. Valid schema, supplied requirement IDs only, all three resume quotes verbatim, absent skills `not_evidenced`. No request or response text in the server log |
| Quality findings from that run | One growth suggestion implied adding AWS experience the resume did not show, and several clarification questions were generic. **Fixed:** the prompt now has explicit strengths, questions and suggestions rules, and a server check drops advice with invented numbers or unconditional "add experience" phrasing. **Mock-tested only**; not re-run live |
| Usage tracking | A numeric-only log line per Bedrock call: input, output and total tokens, model latency, wall time, truncation flag. A canary test confirms no prompt, model output or model ID is logged |
| Tests | 95 mocked unit tests pass, plus lint, typegen, `tsc` and production build (see the PR description for exact runs) |
| Not verified | Live prompt-injection resistance, false-accomplishment bait against the live model, behavior across varied inputs, CloudTrail audit of the call, billed cost (billing lags) |

### Model evaluation notes (read-only checks, no paid calls)

| Model in `us-east-2` | In-region on-demand | Billing | Converse with current code |
| --- | --- | --- | --- |
| Amazon Nova Lite `amazon.nova-lite-v1:0` | **Yes** | First-party Bedrock | Works unchanged (verified live once) |
| Claude Haiku 4.5 | No (geo/global inference profile only) | AWS Marketplace; Anthropic first-time-use form required | Model ID change only; the model card shows an end-of-life date that has already passed |
| Claude Haiku 5.5 | No (geo/global inference profile only) | AWS Marketplace; one-time subscription | Needs request changes: the current `temperature: 0.2` is expected to be rejected, and default adaptive thinking uses part of the output-token budget |

Nova Lite stays the baseline. A Claude comparison needs owner approval for the subscription, the cross-region IAM policy and a small benchmark budget.

## Update 2026-11-14 (after PR #25)

| Area | Status |
| --- | --- |
| Source reviewed against `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, threat model and checklist | Done by the implementing agent only |
| `INVALID_REQUEST` documented | **Done** in `docs/api-contract.md` (400 bad JSON, 413 too large) |
| Env var names and setup documented | **Done**: `web/.env.example`, `docs/aws-bedrock-plan.md` |
| Threat model updated (data flow to Bedrock, residual risks) | **Done** |
| Streaming body cap (a missing `Content-Length` could previously bypass the 200 KB limit) | **Fixed**, with a mocked test |
| `web/.gitignore` ignored `.env.example` | **Fixed** (`!.env.example` added) |
| Mocked unit tests: 29 pass; lint, typegen, `tsc`, build pass; `npm audit --audit-level=high` exits 0 | Verified 2026-11-14 on this worktree |
| Everything about real model behavior (JSON compliance, injection resistance, evidence quality, latency, cost, IAM) | **NOT verified** |

### Checklist coverage (mocked unless stated)

| Checklist case | Result |
| --- | --- |
| Direct and indirect injection | Prompt placement and random tags tested; **model resistance not verified live** |
| False accomplishments / invented numbers | **Partly closed (2026-11-15):** `strengths`, `clarificationQuestions` and `growthSuggestions` items with numbers not found in the inputs are dropped, and so are unconditional "add/highlight experience" suggestions. Keyword heuristic, mock-tested. `summary` and `explanation` are still not checked, and claims without numbers or those verbs can slip through |
| Unsupported skill, fabricated quotes, invalid IDs | Downgraded, dropped, rejected: tested |
| Output markup / unexpected keys | Non-JSON and schema failures rejected; extra keys stripped. Frontend must still escape text |
| Oversized / malformed / empty request | 4xx, no AWS call, no echo: tested (including an unbounded chunked body) |
| Model unavailable | Missing config, timeout, throttle, access denied, bad model, empty reply mapped to safe errors: tested |
| Cost abuse | **Partly mitigated, local only** (Issue #23, `feat/bedrock-rate-limits`): live calls off by default, shared per-process budget (10/min, 50/day, 2 concurrent), `429` before AWS, SDK `maxAttempts` 1. Mock-tested. Not distributed, no per-user fairness. Owner-reported $5 budget notification and $20 spending limit are unverified and not a hard cap |
| Privacy canary | A synthetic name is absent from responses and `console.error` output in tests, and from the new usage log line (`console.info`). One live run's server log was reviewed by the agent: no request or response text |
| Demo integrity | Labeled by text and headers; no automatic fallback: tested |

## Reported implementation

- `POST /api/fit/analyze` accepts `{resume, job}` and returns `{analysis}`, plus an explicitly requested, labeled synthetic demo path.
- Runtime Zod input/output schemas; resume length max 30,000 characters, job length max 20,000, request body max 200 KB.
- Bedrock Runtime Converse API, SDK default credential chain, region/model from environment variables; no credential strings included in the report.
- Per-request randomized prompt tags and instruction text calling resume/job material untrusted.
- Evidence checking: quote must match provided resume/job content, unsupported `supported` status downgraded, unknown requirement IDs rejected.
- Errors are returned as a shared API error shape, with raw AWS exception details suppressed.
- Agent reported **28/28 unit tests passing with mocked AWS**, plus lint, generated Next types/TypeScript and production build.

## Reported gaps / reviewer action

| Finding | Importance | Action |
| --- | --- | --- |
| Rate limiting on the cost-bearing Bedrock endpoint is per-process only | High before any public deployment | Issue #23 added an off-by-default live switch, global per-process limits, a concurrency cap and safe 429s. Still needed: a limit shared by all instances (gateway/WAF or shared store), trusted per-client identity, and verification of the owner-reported AWS budget notification (an alert, not a hard cap) |
| ~~No live Bedrock invocation through the ScaleMe API~~ | Resolved 2026-11-15 | One synthetic request succeeded with verbatim evidence (see update above). A single sample is not a benchmark |
| Prompt-injection tests do not prove actual model resistance | High | Run controlled adversarial synthetic cases with no tools/secrets; verify schema and source evidence. Each live run needs owner approval |
| ~~SDK/model access/IAM not verified~~ | Resolved for local development 2026-11-15 | Restricted role verified with allow/deny probes. A hosted deployment needs its own equally scoped execution role. Pending owner cleanup: the unused IAM user and its login policy |
| Rust matcher not integrated | Functional gap | Verify standalone Rust signals and a deployment-compatible integration boundary later |
| No persistent user model or session isolation tests | High if session storage is added | Design consent, isolation, authorization, retention and deletion before accounts |
| ~~Contract lists no `INVALID_REQUEST` error~~ | Resolved in docs | Frontend still needs to handle it |
| Schemas in `web/src/lib/ai/schemas.ts` rather than shared `web/src/lib/contracts.ts` | Medium | Agree a single export source before frontend consumes it |
| Demo mode uses headers and string label, no contract-level mode field | Medium | Agree a stable `mode` discriminator if UI needs one; preserve explicit DEMO labeling |
| npm audit advisories | Low to medium | Rechecked 2026-11-14 (Issue #23): 0 in production deps; 9 moderate, 0 high/critical, all `minimatch` in the ESLint/`typescript-eslint` dev toolchain. Not changed here; update deliberately, no forced fixes |

The detailed claimed test coverage includes oversized/malformed input, fabricated evidence/requirement IDs, invalid model output, prompt structure, AWS throttle/timeout/error masking and no raw applicant content in logs. **Source code and test results still require independent review once a PR exists.**

## Acceptance checklist before merging #6

- [ ] Review actual diff, including `web/package.json`, lockfile, API route and model prompt.
- [ ] Ensure no raw resume/job data, credentials or unsafe model outputs reach logs, clients or browser bundles.
- [ ] Confirm server-side request limits and schema validation, including no AWS call for malformed input.
- [ ] Confirm evidence correctness for each supported skill, job requirement and invalid model response.
- [ ] Verify demo path cannot be mistaken for live analysis.
- [ ] Require documentation changes in the same PR: new environment variable names, error code differences, API contract, and security limitations.
- [ ] CI green on pushed branch, including dependency audit and all tests.
- [ ] A human reviews deployment risks and marks live model behavior **untested** until tested.

**Release note:** This does not authorize public deployment; use synthetic inputs on a controlled dev environment until rate limiting, privacy, provider access and security test checks are complete.
