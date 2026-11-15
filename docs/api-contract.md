# ScaleMe API contracts (draft v0.1)

**Status:** proposal for Issue #2. Do not assume implementation exists yet.  
**Clients:** Next.js responsive web/PWA first; an optional Expo native client later uses the same HTTP endpoints.  
**Design rules:** JSON over HTTPS, TypeScript-friendly types, stable error shapes, evidence-backed claims, no fabricated skills or outcomes.

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
};

export type InterviewResponse = {
  coachMessage: string;
  focus: "context" | "contribution" | "tradeoffs" | "impact" | "reflection";
  canFinish: boolean;
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

export type TargetedInterviewResponse = InterviewResponse & {
  targetRequirementId?: string; // required once targeted questioning ships
};

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

### `POST /api/job/ingest`

**Request:** `{ "descriptionText"?: string, "url"?: string }`. At least one must be provided; pasted text takes precedence.  
**Response:** `{ "job": JobPosting, "source": "pasted" | "url" }`.  
**Failures:** `JOB_INPUT_REQUIRED`, `INVALID_URL`, `URL_UNAVAILABLE`, `JOB_TEXT_EMPTY`. Treat user-supplied URLs as untrusted; block private/internal hosts and redirects to them. If fetching fails, offer pasted-text input.

### `POST /api/fit/analyze`

**Request:** `{ "resume": Resume, "job": JobPosting }`.  
**Response:** `{ "analysis": FitAnalysis }`.  
**Failures:** `INVALID_REQUEST`, `INVALID_RESUME`, `INVALID_JOB`, `AI_UNAVAILABLE`, `INVALID_AI_RESPONSE`.
**Implementation:** use the Rust matcher for explainable requirement signals and Bedrock for qualitative reasoning, constrained by evidence. *Current state (branch `feat/bedrock-fit`, Issue #6): Bedrock only; the Rust matcher is not integrated.*

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
| 503 / 504 | `AI_UNAVAILABLE` | usually | Not configured (`retryable: false`), access denied or bad model ID (`false`), throttled (`true`), timeout 504 (`true`), other AWS failure (`true`) |
| 502 | `INVALID_AI_RESPONSE` | yes | Model reply was empty, not JSON, failed schema validation, or used a requirement id that was not supplied |
| 500 | `AI_UNAVAILABLE` | yes | Unexpected server error (generic message) |

`INVALID_REQUEST` is **not** a resume/job content error: it means the HTTP body itself could not be used. `INVALID_RESUME` and `INVALID_JOB` messages never echo the submitted text.

**Server-side guarantees on the returned `FitAnalysis`:**
- An `evidence` item is kept only if its `quote` appears in the submitted resume (`source: "resume"`) or job (`source: "job"`) text, ignoring case and whitespace. Others are dropped. `source: "interview"` is dropped because this endpoint receives no interview data.
- A `supported` assessment with no verified resume quote is downgraded to `unclear` and its explanation says so.
- `disclaimer` is always replaced with a fixed server-side string; the model's version is ignored.
- Quote matching is a substring check: it shows the quote exists in the input, not that it proves the requirement. A very short quote can match by chance, so reviewers should read the evidence.
- `explanation`, `strengths`, `clarificationQuestions` and `growthSuggestions` are model-written text. They are schema- and length-checked but **not** fact-checked. Prompt rules forbid invented facts and hiring probabilities, but the code does not detect them.

**Demo mode:** `POST /api/fit/analyze?demo=true` returns a fixed, hand-written synthetic `FitAnalysis`. The request body is ignored (it is not even parsed), and AWS is not called. The response has header `X-ScaleMe-Mode: demo` and `X-ScaleMe-Demo-Label`, and the `summary` begins with `DEMO:` and the `disclaimer` with `DEMO (synthetic sample, not a live AWS Bedrock result)`. A normal response has `X-ScaleMe-Mode: live`. The route never switches to demo on its own when AWS fails; the client must ask for it. There is no `mode` field in the JSON body (open decision: see Decisions below).

### `POST /api/interview/next`

**Request:**
```json
{
  "resume": { "id": "resume-demo", "text": "Software engineer who built an internal employee portal." },
  "job": { "id": "job-demo", "title": "Software Engineer Intern", "text": "Experience with APIs and testing" },
  "history": [
    { "role": "coach", "content": "What problem did your portal solve?" },
    { "role": "candidate", "content": "It reduced navigation between several internal resources." }
  ]
}
```
**Response:** `{ "turn": InterviewResponse }`.  
**Behavior:** Ask one focused follow-up at a time, citing the user's own previous details. The initial request may use an empty `history` array. Limit history length and input size.

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
4. Wire `interview/next` and `impact/rewrite`.
5. Add PWA manifest and icons, test mobile layout, then consider a separate Expo client.

## Decisions to finalize before implementation

- **Runtime schemas location:** `fit/analyze` currently defines its Zod schemas in `web/src/lib/ai/schemas.ts`, not the shared `web/src/lib/contracts.ts` suggested above. Agree on one export source before the frontend imports them.
- **Demo/live marker:** the demo is currently identified by response headers and `DEMO` text, not a JSON field. Decide whether to add an optional `mode: "live" | "demo"` to the contract.
- **`INVALID_REQUEST`:** the frontend should handle it (for example a generic "something was wrong with the request" message) in addition to the resume/job errors.

- Data persistence: default to **no user accounts** and no permanent resume storage in the hackathon demo.
- AWS region/model and backend hosting: choose based on actual access and permissions, not guessed defaults.
- PDF size limit: define and enforce before public upload.
- Optional job-URL ingestion: secure and best-effort only; text input is guaranteed.
- Mobile: prioritize responsive PWA; Expo is a separate stretch project sharing API contracts.

## Fit Evidence Explorer client integration (demo only)

The frontend at `/fit-insights` consumes the existing v0.1 fit response through
`web/src/lib/fit/client.ts`, reusing browser-safe schemas in `lib/ai/schemas.ts`. No wire
types, backend limits, handlers or demo payloads change. Local draft checks mirror the
existing field/encoded-body limits; they do not run analysis.

Explicit `/fit-insights?demo=true` selection reveals a separate load action. Only that
user action makes a bodyless `POST /api/fit/analyze?demo=true`; it never submits drafts.
The client validates analysis, `X-ScaleMe-Mode: demo` and existing DEMO text markers and
never synthesizes fallback results. Live invocation rejects before network access pending
backend security merge and separate authorization.

v0.1 returns IDs but no extracted descriptions/importance or per-assessment question links.
The UI shows IDs, overall questions and returned-assessment status counts without inventing
a required denominator. HTTP 429 is handled defensively using Retry-After and a visible
manual-retry cooldown; this does not assert backend rate limiting has shipped. See
[functional scope, tests and activation requirements](FIT_INSIGHTS_INTEGRATION.md).
