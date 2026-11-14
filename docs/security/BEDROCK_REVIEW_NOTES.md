# Bedrock fit-analysis review notes — Issue #6

**Date:** 2026-11-14 · **Source:** Claude Code's user-provided execution transcript.  
**Verification status:** **Report-only**. This file records what the agent **claimed** to implement; it is **not** a source review of the uncommitted local worktree and not a passing security audit.

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
| No rate limiting on a cost-bearing Bedrock endpoint | High before any public deployment | Add per-client and global limits, concurrency caps, budget/alarms, and safe throttle responses |
| No live Bedrock invocation | High before claiming AI behavior verified | Perform one safe synthetic real-model test; inspect structured result and evidence quotes |
| Prompt-injection tests do not prove actual model resistance | High | Run controlled adversarial synthetic cases with no tools/secrets; verify schema and source evidence |
| SDK/model access/IAM not verified | High for cloud readiness | Verify approved region/model, least-privilege IAM and error path; no broad wildcard secrets |
| Rust matcher not integrated | Functional gap | Verify standalone Rust signals and a deployment-compatible integration boundary later |
| No persistent user model or session isolation tests | High if session storage is added | Design consent, isolation, authorization, retention and deletion before accounts |
| Contract lists no `INVALID_REQUEST` error | Medium | Update `docs/api-contract.md` and coordinate frontend handling |
| Schemas in `web/src/lib/ai/schemas.ts` rather than shared `web/src/lib/contracts.ts` | Medium | Agree a single export source before frontend consumes it |
| Demo mode uses headers and string label, no contract-level mode field | Medium | Agree a stable `mode` discriminator if UI needs one; preserve explicit DEMO labeling |
| npm audit reported advisories | Medium (severity not fully established) | Examine full audit report and update dependencies deliberately; do not run forced upgrades blindly |

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
