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
**Failures:** `INVALID_RESUME`, `INVALID_JOB`, `AI_UNAVAILABLE`, `INVALID_AI_RESPONSE`.  
**Implementation:** use the Rust matcher for explainable requirement signals and Bedrock for qualitative reasoning, constrained by evidence.

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

- Data persistence: default to **no user accounts** and no permanent resume storage in the hackathon demo.
- AWS region/model and backend hosting: choose based on actual access and permissions, not guessed defaults.
- PDF size limit: define and enforce before public upload.
- Optional job-URL ingestion: secure and best-effort only; text input is guaranteed.
- Mobile: prioritize responsive PWA; Expo is a separate stretch project sharing API contracts.
