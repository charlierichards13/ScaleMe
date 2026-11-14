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

Do not commit a populated `.env.local`, access keys, long-lived credential strings or personal resumes. Prefer an AWS profile / SSO / role with short-lived credentials locally, and an attached execution role if hosted in AWS. The Node AWS SDK credential provider chain should obtain credentials server-side; never send them to the browser.

Confirm model access, region, invocation support and possible inference-profile requirements in your AWS account **before** choosing the exact API request. Avoid hardcoding a specific model ID in shared source code.

## Human setup checklist

- [ ] Confirm that an AWS account/project is available and cost controls are appropriate for hackathon testing.
- [ ] Select a Bedrock-enabled region and a model that the account is authorized to invoke.
- [ ] Configure limited permissions to invoke **only** the selected model/resources (subject to the Bedrock API and IAM rules for that model).
- [ ] Configure local AWS credentials/profile securely.
- [ ] Set `AWS_REGION` and `BEDROCK_MODEL_ID` in `web/.env.local` without committing the file.
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

1. Merge the issue #6 route as a reviewed PR after CI passes.
2. Teammate connects the dashboard's "Analyze" action to the route's documented JSON response.
3. Review evidence correctness on a **synthetic** resume/job example.
4. Integrate [Rust matcher #12](https://github.com/charlierichards13/ScaleMe/issues/12) as a separate service or deployment-compatible module once its JSON boundary is tested. Do not assume a native executable can run on every serverless host.
5. Reuse the Bedrock client patterns for mock interview and impact coaching, without copying security-sensitive configuration to the frontend.
6. Rehearse the 3-minute demo with a reliable, clearly labeled backup state.

## Do not expand this first slice

Avoid accounts, permanent resume storage, web scraping, detailed visa/authorization determinations, voice interviews, and multi-service AWS infrastructure until the original core experience works. Job discovery and student guidance are documented as later work in [#18](https://github.com/charlierichards13/ScaleMe/issues/18) and [#19](https://github.com/charlierichards13/ScaleMe/issues/19).

**Definition of done for this design task:** The team can identify the backend boundary, required configuration names, security responsibilities, integration steps and next human AWS account checks without relying on guesswork.
