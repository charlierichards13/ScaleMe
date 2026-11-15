# ScaleMe API contracts (draft v0.1)

**Status:** proposal for Issue #2. Do not assume implementation exists yet.  
**Clients:** Next.js responsive web/PWA first; an optional Expo native client later uses the same HTTP endpoints.  
**Design rules:** JSON over HTTPS, TypeScript-friendly types, stable error shapes, evidence-backed claims, no fabricated skills or outcomes.

## Private conversational Career Coach (Issue #64)

Implemented separately from fit/interview: `POST /api/coach/message`. No demo or query flags. See [setup, security limits and verification](PRIVATE_CAREER_COACH.md). Existing contracts remain compatible.

Request (strict JSON, no extra keys):

```json
{"consent":true,"messages":[{"role":"user","content":"I built a fictional booking tool. How can I explain my contribution?"}],"context":{"resume":"Optional explicitly provided resume excerpt","job":"Optional explicitly provided job context"}}
```

`messages` must alternate user/assistant, start and end with user, contain 1–11 turns (at most six sends), each 1–2,000 trimmed UTF-16 units. Optional resume ≤12,000; job ≤8,000; messages plus context ≤24,000 units. Body ≤96 KiB streamed, whole-body deadline 10 s. Blank present context is invalid; omit it instead. `consent:true` is mandatory. Client history is untrusted, not authenticated evidence.

Success: `{"message":{"role":"assistant","content":"What did you personally own?"},"advisory":"unverified"}` with `X-ScaleMe-Mode: live`. Reply ≤2,000 units; strict provider JSON `{reply:string}`, output cap 500 tokens (or lower configured cap). This is unverified prose, **never** a FitAnalysis, evidence ledger record, validated bullet or verification claim.

Both proxy and handler call `requirePrivateAi`. Existing `FIT_LIVE_AI_ENABLED=true` plus valid server-only private token are required, as is the additional **default-off** `COACH_LIVE_AI_ENABLED=true`. Authorization only in Bearer header, same-origin checks unchanged. No query/demo bypass. Authorization precedes body/budget/provider even for direct handler invocation. Single SDK attempt required; configured provider timeout must be ≤45 s. Same per-process minute/day/concurrency budget as fit/interview, no automatic retries.

Errors retain `ApiError`: 400 `INVALID_REQUEST` (schema/content-type/query), 400 `UNSAFE_COACH_REQUEST` (known instruction/fabrication patterns), 408 body deadline, 413 body size, 401/403 `PRIVATE_ACCESS_REQUIRED`, 429 `RATE_LIMITED` + numeric Retry-After, 502 `INVALID_AI_RESPONSE`, 503/504 `AI_UNAVAILABLE`. No submitted/model/error content echoed. All handler responses `Cache-Control: no-store`, `Vary: Authorization`; successful responses alone carry live mode. Other methods use Next.js 405; no other paid execution entry exists.

The client requires explicit send and consent, bounded local state, header-only session code, matching live header and strict response schema. No mount call, auto-retry, storage, telemetry, cookie or transfer to other tools. Clear/exit/reload remove active state. Cancellation invalidates late responses; already admitted calls may still be billed. The free practice-access endpoint does not establish coach availability, so the coach does not label itself live until its own authorized success.

## Contextual client private-preview access (additive transport requirement)

The contextual client consumes PR #49's `{ resume, job, history, fit? } → { turn }` contract without changing those schemas. The PR remains unreviewed; adoption is conditional on human review. See [integration and local evidence handoff](CONTEXTUAL_INTERVIEW.md).

- The Next.js server proxy gates **both** `/api/fit/analyze` and `/api/interview/next` before paid handlers. Live requests require `FIT_LIVE_AI_ENABLED=true`, a valid server-only `SCALEME_PRIVATE_AI_TOKEN`, and `Authorization: Bearer <owner-provided private access code>`. The code is an application access credential, never an AWS credential. The server does not inject it into HTML or JavaScript. Client-provided code lives in component memory only.
- Default-off or missing/invalid private access configuration: `503 AI_UNAVAILABLE`, non-retryable. Configured but missing/wrong access code: `401 PRIVATE_ACCESS_REQUIRED`, non-retryable. Wrong `Origin` or cross-site browser request: `403 PRIVATE_ACCESS_REQUIRED`, non-retryable. Responses are generic and `Cache-Control: no-store`; no submitted values are echoed. These checks precede body parsing and quota acquisition at the HTTP boundary. Direct handler unit tests do not exercise the proxy.
- Exact `?demo=true` continues to bypass paid access for the existing fixed, labeled, body-ignoring demos. No fallback from live to demo is automatic.
- `POST /api/practice/access` uses the same access gate, returns `{ "available": true }` on success, and never reads a body, calls AWS or acquires quota. `?demo=true` does not bypass this route. This confirms private-preview access only; AWS readiness is checked by subsequent paid handlers.
- Client calls omit cookies, prohibit redirects, and require `X-ScaleMe-Mode: live` for analysis/interview output. Timeout is 55 seconds (default server timeout 45 seconds); responses are bounded to 200 KB. Retrying or cancelling does not refund or undo a model request already accepted by the server.

This shared private-preview credential is not a user account/session system, a distributed quota, or public-launch authorization. Deploy only with server-side proxy support and HTTPS in an authorized private environment after human review. No deployment is part of this change.

## Architecture choice for the hackathon

Start with **Next.js Route Handlers** in `web/src/app/api/` so the frontend can integrate quickly. The handlers may call Amazon Bedrock directly from the server. If AWS deployment calls for it, move the same handlers behind API Gateway/Lambda without changing the client contract.

The matching Rust executable/service is a *backend component*, not exposed directly to the browser. Use one simple JSON boundary at first.

```text
Web browser / mobile PWA / future Expo app
                  |
           JSON API over HTTPS
                  |
         Next.js API handlers
            /           \
     Rust matcher     AWS Bedrock
```

## Shared modeling rules

- IDs are opaque strings. During the MVP, clients can send objects directly without requiring accounts or a database.
- Match statuses mean **supported**, **not_evidenced**, or **unclear**. Not being evidenced in a resume is *not* proof the user lacks a skill.
- `evidence` identifies a source (`resume`, `job`, or `interview`) plus a short quote. If there is no source quote, use an empty evidence array.
- Numeric hiring probabilities are deliberately excluded; analysis is guidance, not a forecast.
- All generated writing must preserve the user's actual facts, including measurements and dates. Unknown impact is returned as a question.
- Untrusted resume/job content is data, not model instructions.
- Responses use HTTP 2xx for success and 4xx/5xx with the shared `ApiError` format for errors.

## TypeScript interface draft

```ts
export type Evidence = {
  source: "resume" | "job" | "interview";
  quote: string; // short excerpt; no invented evidence
  section?: string;
};

export type Resume = {
  id: string;
  filename?: string;
  text: string;
  sections?: Array<{ heading: string; text: string }>;
};

export type JobPosting = {
  id: string;
  title: string;
  company?: string;
  sourceUrl?: string;
  text: string;
  requirements?: Array<{
    id: string;
    description: string;
    importance: "required" | "preferred" | "unspecified";
  }>;
};

export type RequirementAssessment = {
  requirementId: string;
  status: "supported" | "not_evidenced" | "unclear";
  explanation: string;
  evidence: Evidence[];
};

export type FitAnalysis = {
  summary: string;
  assessments: RequirementAssessment[];
  strengths: string[];
  clarificationQuestions: string[];
  growthSuggestions: string[];
  disclaimer: string; // coaching signal, not a hiring prediction
};

export type InterviewTurn = {
  role: "coach" | "candidate";
  content: string;
  targetRequirementId?: string; // additive (implemented): coach turns only, echoed back from InterviewResponse
};

export type InterviewResponse = {
  coachMessage: string;
  focus: "context" | "contribution" | "tradeoffs" | "impact" | "reflection";
  canFinish: boolean;
  targetRequirementId?: string; // additive (implemented): server-chosen; absent in general sessions
};

export type ImpactSuggestion = {
  original: string;
  improved: string;
  supportingEvidence: Evidence[];
  followUpQuestions: string[]; // for missing details or metrics
};

export type ImpactReport = {
  suggestions: ImpactSuggestion[];
  talkingPoints: string[];
  nextSteps: string[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
```

For MVP, `web/src/lib/contracts.ts` can export these types or equivalent runtime-validated Zod schemas. Avoid duplicated hand-written type definitions in separate agents' implementations.

## Proposed additive evidence-discovery extension (v0.2; **not implemented**)

The types above remain the **v0.1 integration baseline** while #3/#6/#7/#8 are developed on separate branches. Before adopting new wire fields, the team should agree on the following *additive* extension, update runtime validators and consumers together, and use real acceptance tests. Do not silently change a live response shape based on this planning text.

```ts
export type CandidateEvidenceRecord = {
  id: string; // stable within a resume/interview session
  source: "resume" | "interview"; // NEVER job: job text is a requirement, not candidate proof
  quote: string; // exact span in candidate-provided text; verify on the server
  sourceRef: string; // resume section/offset or stable interview turn ID
  review: "candidate_reported" | "candidate_confirmed";
};

export type RequirementEvidenceLink = {
  requirementId: string; // must exist in the same JobPosting.requirements
  candidateEvidenceIds: string[]; // only IDs in CandidateEvidenceRecord[]
};

export type CoverageSnapshot = {
  phase: "initial" | "after_interview";
  requiredRequirementIds: string[]; // stable denominator for both phases
  supportedRequirementIds: string[];
  unclearRequirementIds: string[];
  notEvidencedRequirementIds: string[];
};

export type DiscoveryExtension = {
  evidenceRecords: CandidateEvidenceRecord[];
  links: RequirementEvidenceLink[];
  before: CoverageSnapshot;
  after: CoverageSnapshot;
};

// Implemented for /api/interview/next: `targetRequirementId` now lives on InterviewResponse itself.
export type TargetedInterviewResponse = InterviewResponse;

export type GuardedImpactSuggestion = Omit<ImpactSuggestion, "improved"> & {
  improved?: string; // absent when a proposed claim is blocked
  candidateEvidenceIds: string[];
  reviewStatus: "ready_for_candidate_review" | "needs_confirmation" | "blocked";
  reviewReason?: string;
};
```

**Rules for adoption:**

- The client should display a clearly separated **candidate-reported** vs **candidate-confirmed** state. Confirmation is not independent employer/credential verification.
- Job-description excerpts may justify the existence of a requirement but must **not** count as evidence that the candidate satisfies it.
- Compute coverage counts **in application code** from validated requirement IDs and statuses; do not accept arbitrary totals output by the model. Only compare snapshots over the **same requirement ID set**.
- A requirement may become supported after an interview only when a relevant exact candidate-supplied quote is linked. A rephrased bullet by itself must not change status.
- The interview and impact routes should eventually support these records, but **keep the existing v0.1 requests and responses valid** until all consuming branches coordinate migration. Possible reassessment strategies: optional interview context on `/api/fit/analyze` or a dedicated `/api/fit/reassess`; choose one before implementation.
- All references and quotes are sensitive candidate data. Avoid permanent storage/logging for the MVP; use synthetic fixtures and server-side validation.
- The optional Rust claim guard may flag additions such as new percentages, counts, dates or tools, but it does **not** establish the independent truth of a candidate's report.

**Synthetic integration acceptance:** with a testing requirement initially `not_evidenced`, an answer about testing the portal may change that requirement to `supported` with an exact interview reference; an unrelated or missing answer must leave it unresolved, and an invented “40% faster” metric must not pass as source-grounded. See [DIFFERENTIATION.md](DIFFERENTIATION.md).

---
## Endpoints (proposed)

### `POST /api/resume/parse`

**Request:** `multipart/form-data` with `file` (text-based PDF); optionally `demo=true` for a clearly labeled sample.  
**Response:** `{ "resume": Resume }`.  
**Failures:** `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `NO_EXTRACTABLE_TEXT`, `PARSING_FAILED`.
*Current state (Issue #4): this route is **not implemented**. The parsing itself exists as a standalone Rust program, `services/resume-parser/`, which reads a PDF on standard input and writes `{ "resume": Resume }` or an `ApiError` on standard output using only the four codes above. Limits it enforces: 5 MiB, 20 pages, `resume.text` up to 30,000 characters (rejected, never truncated), up to 50 sections. The request, response and error shapes in this contract are unchanged. See [RESUME_INGESTION.md](RESUME_INGESTION.md) for the code-to-cause table, suggested HTTP statuses for a future route, and the open question about more specific error codes.*

### `POST /api/job/ingest`

**Request:** `{ "descriptionText"?: string, "url"?: string }`. At least one must be provided; pasted text takes precedence.  
**Response:** `{ "job": JobPosting, "source": "pasted" | "url" }`.  
**Failures:** `JOB_INPUT_REQUIRED`, `INVALID_URL`, `URL_UNAVAILABLE`, `JOB_TEXT_EMPTY`. Treat user-supplied URLs as untrusted; block private/internal hosts and redirects to them. If fetching fails, offer pasted-text input.

### `POST /api/fit/analyze`

**Request:** `{ "resume": Resume, "job": JobPosting }`.  
**Response:** `{ "analysis": FitAnalysis }`.  
**Failures:** `INVALID_REQUEST`, `INVALID_RESUME`, `INVALID_JOB`, `AI_UNAVAILABLE`, `INVALID_AI_RESPONSE`, `RATE_LIMITED`.
**Implementation:** use the Rust matcher for explainable requirement signals and Bedrock for qualitative reasoning, constrained by evidence. *Current state (Issue #6, merged in PR #33): Bedrock only; the Rust matcher is not integrated. Verified once against live Amazon Nova Lite (`amazon.nova-lite-v1:0`, `us-east-2`) on 2026-11-15 with synthetic data. See `docs/aws-bedrock-plan.md`.*

**Request limits (server-enforced; the request is rejected before any AWS call):**

| Field | Limit |
| --- | --- |
| Whole JSON body | 200,000 bytes (read as a bounded stream, so a missing `Content-Length` does not bypass it) |
| `resume.text` | 1 to 30,000 characters (whitespace-only is rejected) |
| `job.title` | 1 to 200 characters |
| `job.text` | 1 to 20,000 characters |
| `job.requirements` | at most 30 items. If supplied, the analysis may only use these `id`s. If omitted, the model extracts requirements and names them `r1`, `r2`, ... |

Unknown extra fields are ignored. `filename`, `sourceUrl` and `sections` are accepted but are **not** sent to the model.

**Status codes and error codes (all use the shared `ApiError` shape):**

| HTTP | `error.code` | Retryable | When |
| --- | --- | --- | --- |
| 400 | `INVALID_REQUEST` | no | Body is not valid JSON |
| 413 | `INVALID_REQUEST` | no | Body exceeds 200,000 bytes |
| 400 | `INVALID_RESUME` | no | `resume` missing, empty, wrong type or too long |
| 400 | `INVALID_JOB` | no | `job` missing, empty, wrong type or too long (checked after the resume) |
| 503 | `AI_UNAVAILABLE` | no | Live AI cannot run on this server: switched off (the default), missing or invalid server settings (fails closed), AWS access denied, or the configured model is unusable. The client always gets the same generic message (below); the specific cause is only in the server log |
| 429 | `RATE_LIMITED` | yes | The shared live-call budget is used up: more than the per-minute limit, the daily cap, or the concurrent-call cap. Has a `Retry-After` header (seconds). Bedrock was **not** called |
| 503 / 504 | `AI_UNAVAILABLE` | yes | Throttled by AWS (503), timeout (504), or other transient AWS failure (503) |
| 502 | `INVALID_AI_RESPONSE` | yes | Model reply was empty, not JSON, failed schema validation, or used a requirement id that was not supplied |
| 500 | `AI_UNAVAILABLE` | yes | Unexpected server error (generic message) |

**Client-facing messages are generic.** Every non-retryable `AI_UNAVAILABLE` returns `"Live AI analysis is not available on this server right now. You can try the labeled demo instead."`, with no environment-variable names, AWS account details, model IDs or limit values. Operators troubleshoot from the server log, which records one fixed hint per cause (never a value, credential, header or user text):

| Server log line (prefix `[fit/analyze] AI_UNAVAILABLE:`) | Fix |
| --- | --- |
| `live AI disabled: FIT_LIVE_AI_ENABLED is not true` | Set `FIT_LIVE_AI_ENABLED=true` on a private, deliberately live server |
| `not configured: AWS_REGION and BEDROCK_MODEL_ID are required` | Set both variables |
| `invalid setting: <NAME> must be an integer from <min> to <max>` | Correct or unset the named variable |
| `not authorized: check the server's AWS credentials and Bedrock model access` | Check the server's AWS profile/role and model access (the AWS error type is logged on the line before) |
| `model unusable: check BEDROCK_MODEL_ID and AWS_REGION` | Use a model or inference-profile ID enabled in that region |

**Order of checks for a live request** (each rejects before any AWS call): (1) bounded body read and schema validation; (2) `FIT_LIVE_AI_ENABLED`; (3) cost-guard and AWS settings; (4) cost guard: daily cap, then per-minute limit, then concurrency; (5) one Bedrock call. Malformed or invalid requests and server misconfiguration never use up the call budget. An admitted call counts against the budget even if Bedrock then fails or times out, because it may still be billed.

**Cost guard (Issue #23):**

| Limit | Default | Variable (allowed range) |
| --- | --- | --- |
| Live calls in any sliding 60 s window | 10 | `FIT_RATE_LIMIT_GLOBAL_PER_MIN` (1 to 600) |
| Live calls in any sliding 24 h window | 50 | `FIT_DAILY_CALL_LIMIT` (1 to 10,000) |
| Model calls running at the same time | 2 | `FIT_MAX_CONCURRENT` (1 to 20); extra requests get 429 immediately, they are not queued |
| AWS SDK attempts per request | 1 (no automatic retry) | `BEDROCK_MAX_ATTEMPTS` (1 to 2) |

These limits are **one shared anonymous budget** for all callers. The server does **not** read `X-Forwarded-For`, `X-Real-IP`, `Forwarded` or any other client-supplied header to identify callers, so there is no per-user limit or fairness: one caller can use up the budget for everyone. Counters live in the memory of each server process, so they are **not** shared between instances and reset on restart (see `docs/security/THREAT_MODEL.md`). The 429 message is the same for every limit and does not reveal the limit values:

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many analysis requests right now. Please wait and retry, or use the labeled demo.", "retryable": true } }
```

Clients should wait at least `Retry-After` seconds before retrying, retry at most once automatically, and offer the labeled demo. Do not retry in a loop.

`INVALID_REQUEST` is **not** a resume/job content error: it means the HTTP body itself could not be used. `INVALID_RESUME` and `INVALID_JOB` messages never echo the submitted text.

**Server-side guarantees on the returned `FitAnalysis`:**
- An `evidence` item is kept only if its `quote` appears in the submitted resume (`source: "resume"`) or job (`source: "job"`) text, ignoring case and whitespace. Others are dropped. `source: "interview"` is dropped because this endpoint receives no interview data.
- A `supported` assessment with no verified resume quote is downgraded to `unclear` and its explanation says so.
- `disclaimer` is always replaced with a fixed server-side string; the model's version is ignored.
- Quote matching is a substring check: it shows the quote exists in the input, not that it proves the requirement. A very short quote can match by chance, so reviewers should read the evidence.
- **Advice grounding.** Items in `strengths`, `clarificationQuestions` and `growthSuggestions` are **dropped**, never rewritten, when:
  - they contain a number that does not appear in the inputs. For `strengths` the number must appear in the resume. For questions and suggestions it may come from the resume, the job text or the supplied requirements. Requirement IDs such as `r1` don't count as numbers.
  - a growth suggestion tells the candidate to add, list, include, mention, highlight, claim or showcase experience, skills, achievements, metrics or results, with no condition such as "if" or "whether". "If you have X, add an example" is kept; "Add X experience to your resume" is dropped.
- These lists can therefore be shorter than the model produced, or empty. Their types and limits are unchanged, so this is not a contract change.
- `explanation`, `summary` and the remaining advice are still model-written text. They are schema- and length-checked but **not** fact-checked. The grounding rule is a keyword heuristic, so it can miss invented claims written without numbers or those verbs. It can also drop an honest item. The prompt additionally asks for one clarification question per `not_evidenced` or `unclear` requirement and for conditional or future-learning suggestions only; the code does not enforce that.

**Usage metrics (server log only, never in the response):** each completed Bedrock call logs one line of numbers:

```text
[fit/analyze] Bedrock usage: inputTokens=812 outputTokens=256 totalTokens=1068 modelLatencyMs=2346 wallMs=2410 truncated=0
```

- `modelLatencyMs` is Bedrock's own reported latency. `wallMs` is the time measured by the server.
- `truncated=1` means the model stopped at `BEDROCK_MAX_OUTPUT_TOKENS`.
- A value that is missing or not a number is logged as `n/a`.
- A failed call logs the AWS error type and `wallMs` only.
- The line never contains prompts, resume or job text, model output, model or account IDs, credentials or caller details. To estimate cost, multiply the token counts by the model's current on-demand prices.

**Demo mode:** `POST /api/fit/analyze?demo=true` returns a fixed, hand-written synthetic `FitAnalysis`. The request body is ignored (it is not even parsed), and AWS is not called. Demo mode works with live AI switched off and no AWS settings, and it is exempt from the cost guard (it never returns 429 and does not use up the live budget). The response has header `X-ScaleMe-Mode: demo` and `X-ScaleMe-Demo-Label`, and the `summary` begins with `DEMO:` and the `disclaimer` with `DEMO (synthetic sample, not a live AWS Bedrock result)`. A normal response has `X-ScaleMe-Mode: live`. The route never switches to demo on its own when AWS fails; the client must ask for it. There is no `mode` field in the JSON body (open decision: see Decisions below).

### `POST /api/interview/next`

**Status:** implemented (server route `web/src/app/api/interview/next/route.ts`, logic in `web/src/lib/ai/interview*.ts`). Unit tests use **mocked** Bedrock only; live behavior is not verified. Guarded by the same live switch and the **same** per-process cost budget as `/api/fit/analyze`.

**Request** (v0.1 shape still valid; `fit` and the echoed `targetRequirementId` are optional additions):
```json
{
  "resume": { "id": "resume-demo", "text": "Software engineer who built an internal employee portal." },
  "job": {
    "id": "job-demo",
    "title": "Software Engineer Intern",
    "text": "Experience with APIs and testing",
    "requirements": [
      { "id": "r1", "description": "Experience with APIs", "importance": "required" },
      { "id": "r2", "description": "Experience testing web applications", "importance": "required" }
    ]
  },
  "history": [
    { "role": "coach", "content": "How did you check the portal before colleagues used it?", "targetRequirementId": "r2" },
    { "role": "candidate", "content": "I checked that it worked before we launched it." }
  ],
  "fit": { "assessments": [ { "requirementId": "r1", "status": "supported" }, { "requirementId": "r2", "status": "not_evidenced" } ] }
}
```

**Response:** `{ "turn": InterviewResponse }`, for example `{ "turn": { "coachMessage": "...", "focus": "impact", "canFinish": false, "targetRequirementId": "r2" } }`. Header `X-ScaleMe-Mode: live`.

**Validation and limits** (all before any live-AI gate, budget use or AWS call):
- `resume` and `job` use the same schemas and limits as `/api/fit/analyze`. Body max 200,000 bytes, read in a bounded stream.
- `history`: required array (may be empty), at most **12** turns; each `content` is trimmed, 1–2,000 characters. Turns must start with `coach`, alternate, and end with a `candidate` answer. Only coach turns may carry `targetRequirementId`.
- `job.requirements` ids must be unique.
- `fit` (optional): `{ assessments: [{ requirementId, status }] }`, at most 30. Other `RequirementAssessment` fields (`explanation`, `evidence`) are accepted but **stripped and never used**. Every id must exist in `job.requirements`, at most once each. `fit` without `job.requirements` is rejected, because those ids cannot be checked.

**Server-selected target (deterministic, model cannot override):**
- Client fit statuses are **untrusted and unverified**. They only order the questions; they are never treated as evidence and never change a status.
- Unresolved requirements are ordered `not_evidenced`, then `unclear`, then not assessed (no fit entry), then by importance (`required`, `preferred`, `unspecified`), then posting order. `supported` requirements are skipped.
- Each target gets **two** questions: `contribution` (what the candidate did), then a narrower `impact` follow-up on the same requirement, based on the latest answer (missing detail if vague; how it was checked / what changed if specific, with "not measured" accepted). At most 5 targeted questions, then one untargeted `reflection` question.
- **General session:** if the job has no structured requirements, or all are `supported`, turns have **no** `targetRequirementId` and follow `context`, `contribution`, `tradeoffs`, `impact`, `reflection`.
- Turn *k* of a session is plan step *k*, so the server keeps no session state. An echoed `targetRequirementId` must equal what the server planned for that turn; a mismatch (different job/fit or edited history) is `INVALID_HISTORY`. v0.1 clients may omit it.
- After the last question the server returns a **closing** turn (no question, `focus: "reflection"`, `canFinish: true`). A request answering past it is `INVALID_HISTORY`. `canFinish` is also `true` once the candidate has given 4 answers, and on the reflection turn.

**Model output checks:** the model returns only `{ "coachMessage": string }` (max 1,000 characters); any other key is ignored. Focus, target and `canFinish` always come from the server. The message must contain exactly one `?` (zero for the closing turn), no number that does not appear in the resume, job, requirement descriptions or history, and no hiring-probability/score/guarantee language. A failure returns **`502 INVALID_AI_RESPONSE`** (`retryable: true`). The route never substitutes a scripted question for rejected live output.

**Errors:** `INVALID_REQUEST` (400 malformed JSON / 413 too large), `INVALID_RESUME`, `INVALID_JOB`, `INVALID_HISTORY`, `INVALID_FIT_CONTEXT` (400, not retryable); `AI_UNAVAILABLE` (503 live switch off / not configured; 503/504 AWS problems); `RATE_LIMITED` (429 with `Retry-After`, shared with fit analysis); `INVALID_AI_RESPONSE` (502).

**Demo mode:** `POST /api/interview/next?demo=true&step=N` (N = 0–3, default 0) returns a fixed, hand-written synthetic step for the "testing the portal" story in [DIFFERENTIATION.md](DIFFERENTIATION.md), using the fit demo ids (`r2` is the target). The body is **not read**, AWS is not called, and it needs no AWS settings and no budget. Header `X-ScaleMe-Mode: demo` and `X-ScaleMe-Demo-Label`; every `coachMessage` begins with `DEMO:`. The coach messages respond to the **sample answers** in `DEMO_INTERVIEW_STEPS` (`web/src/lib/ai/interview-demo.ts`), not to what a user types. Other `step` values return 400 `INVALID_REQUEST`. The route never falls back to demo on its own.

**Not in this endpoint:** evidence records, `candidate_reported`/`candidate_confirmed` links and reassessment. An interview answer does **not** change any fit status yet; the reassessment route is still an open decision (see the v0.2 rules above).

### `POST /api/impact/rewrite`

**Request:** `{ "resume": Resume, "job": JobPosting, "history": InterviewTurn[] }`.  
**Response:** `{ "report": ImpactReport }`.  
**Behavior:** Only write specifics explicitly evidenced by resume/interview. Ask for unknown quantities rather than guessing.

## Example fit-analysis response (synthetic)

```json
{
  "analysis": {
    "summary": "The resume shows internal application work but does not specify the applicant's testing approach.",
    "assessments": [
      {
        "requirementId": "r1",
        "status": "supported",
        "explanation": "The candidate describes building an internal portal.",
        "evidence": [
          { "source": "resume", "quote": "Built an internal employee portal." }
        ]
      },
      {
        "requirementId": "r2",
        "status": "not_evidenced",
        "explanation": "The resume does not explain how features were tested.",
        "evidence": []
      }
    ],
    "strengths": ["Experience building an internal application"],
    "clarificationQuestions": ["How did you test the portal before release?"],
    "growthSuggestions": ["Add an accurate testing example if you have one."],
    "disclaimer": "This assessment is coaching guidance, not a prediction of hiring outcomes."
  }
}
```

## Example `fit/analyze` input error (synthetic)

`POST /api/fit/analyze` with body `{oops` returns HTTP 400:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request body must be valid JSON.",
    "retryable": false
  }
}
```

## Standard error example

```json
{
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "Interview coaching is temporarily unavailable. Please retry or use the labeled demo.",
    "retryable": true
  }
}
```

## Rust boundary (proposal)

Rust accepts JSON over stdin and writes JSON to stdout; Next.js server-side code invokes it in a local/container environment. **Serverless caveat:** a local executable will not automatically run in all hosted Next.js environments. If deployment constraints make invoking a compiled binary difficult, package Rust separately (e.g., a Lambda function or small HTTP service), keeping the exact matching schema.

**Input:** `{ "resumeText": string, "requirements": [{ "id": string, "description": string }] }`.  
**Output:** `{ "signals": [{ "requirementId": string, "normalizedTerms": string[], "matchedExcerpts": string[] }] }`.

These are deterministic keyword/alias signals, not final judgments of candidate suitability. Bedrock turns signals and actual input text into assessments and interview prompts. Add tests for case-insensitivity, aliases, duplicates, and missing values.

## Frontend integration sequence

1. Build the full UI from **synthetic mocked responses** that conform to these contracts.
2. Implement PDF and pasted job inputs.
3. Wire `fit/analyze` to Bedrock and Rust; handle loading/errors.
4. Wire `interview/next` (backend implemented; UI wiring pending) and `impact/rewrite`.
5. Add PWA manifest and icons, test mobile layout, then consider a separate Expo client.

## Decisions to finalize before implementation

- **Runtime schemas location:** `fit/analyze` currently defines its Zod schemas in `web/src/lib/ai/schemas.ts`, not the shared `web/src/lib/contracts.ts` suggested above. Agree on one export source before the frontend imports them.
- **Demo/live marker:** the demo is currently identified by response headers and `DEMO` text, not a JSON field. Decide whether to add an optional `mode: "live" | "demo"` to the contract.
- **`INVALID_REQUEST`:** the frontend should handle it (for example a generic "something was wrong with the request" message) in addition to the resume/job errors.

- Data persistence: default to **no user accounts** and no permanent resume storage in the hackathon demo.
- AWS region/model and backend hosting: choose based on actual access and permissions, not guessed defaults.
- PDF size limit: the Rust parser enforces 5 MiB (Issue #4). The upload route must enforce the same limit on the request stream before public upload.
- Optional job-URL ingestion: secure and best-effort only; text input is guaranteed.
- Mobile: prioritize responsive PWA; Expo is a separate stretch project sharing API contracts.

## Branch-local P0 contextual completion (no wire change)

`/interview/contextual` now reuses `collectEvidence()` → `fromFitAnalysis()` →
`fromCandidateTurn()` → the existing ledger → embedded Impact Lab. Resume/job IDs,
requirement inventory, initial analysis and candidate turns stay in one in-memory
React session. Candidate-selected `subjectId` metadata is local and is **not** added
to the interview HTTP history. No `/api/fit/reassess` or `/api/impact/rewrite` route
is implemented by this integration. The existing `fit` statuses still only order
backend questions. Local report counts are recomputed, never submitted as trusted
server state. [Behavior and limitations](CONTEXTUAL_INTERVIEW.md#p0-completion-integration-supersedes-forthcoming-engine-above).

## Fit Evidence Explorer client integration (demo only)

The frontend at `/fit-insights` consumes the existing v0.1 fit response through
`web/src/lib/fit/client.ts`, reusing browser-safe schemas in `lib/ai/schemas.ts`. No wire
types, backend limits, handlers or demo payloads change. Local draft checks mirror the
existing field/encoded-body limits; they do not run analysis.

Explicit `/fit-insights?demo=true` selection reveals a separate load action. Only that
user action makes a bodyless `POST /api/fit/analyze?demo=true`; it never submits drafts.
The client validates analysis, `X-ScaleMe-Mode: demo` and existing DEMO text markers and
never synthesizes fallback results. Live invocation rejects before network access pending
a separately authorized client change. PR #38's backend security controls are now merged;
that does not activate the browser's live path.

v0.1 returns IDs but no extracted descriptions/importance or per-assessment question links.
The UI shows IDs, overall questions and returned-assessment status counts without inventing
a required denominator. HTTP 429 uses Retry-After and a visible manual-retry cooldown.
PR #38 adds per-process shared live-call limits; the fictional demo bypasses those limits.
Grounding can leave advice lists empty, which the client accepts and displays explicitly. See
[functional scope, tests and activation requirements](FIT_INSIGHTS_INTEGRATION.md).
