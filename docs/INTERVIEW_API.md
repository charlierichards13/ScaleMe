# Interview coach API (backend, Issue #7)

**Route:** `POST /api/interview/next` · **Branch:** `feat/interview-next-api`
**Status:** backend implemented and **mock-tested only**. No live Bedrock call has been made for this route. The `/interview` UI (owned separately, see [INTERVIEW.md](INTERVIEW.md)) is still the scripted demo and does not call this API yet.

Wire format, limits and error codes: [api-contract.md](api-contract.md#post-apiinterviewnext). Security notes: [THREAT_MODEL.md](security/THREAT_MODEL.md#issue-7-interview-coach-api).

## What it does

One request = one coach message. The client sends the resume, the job, the interview so far and (optionally) the fit result it already received from `/api/fit/analyze`. The server:

1. validates the body (same resume/job limits as fit analysis; at most 12 history turns of up to 2,000 characters each);
2. builds a **deterministic plan** from the job's structured requirements and the client's fit statuses, and picks plan step *k* for coach turn *k*;
3. checks the live switch and the shared cost budget;
4. asks the model to **word** that one question (the model is never asked to choose the topic);
5. checks the wording and returns `{ turn }`, or a safe 502.

Nothing is stored on the server. The client re-sends the history each turn.

## How the question is chosen

| Input | Plan |
| --- | --- |
| `job.requirements` + `fit` | Unresolved requirements, `not_evidenced` → `unclear` → not assessed; `required` first; two questions each (`contribution`, then an `impact` follow-up on the same requirement); max 5, then `reflection`, then closing |
| `job.requirements`, no `fit` | All requirements count as "not assessed", same ordering by importance |
| No `job.requirements` | **General session**: `context`, `contribution`, `tradeoffs`, `impact`, `reflection`, then closing. No `targetRequirementId`. Sending `fit` here is rejected (`INVALID_FIT_CONTEXT`) because its ids cannot be checked |
| Every requirement `supported` | General session, worded around experience the resume already shows |

The returned `targetRequirementId` should be echoed on that coach turn in the next request. If it is echoed and does not match the server's plan for that turn, the request fails with `INVALID_HISTORY`. Omitting it is allowed (v0.1 clients).

`canFinish` is `true` after four candidate answers, on the reflection question and on the closing turn. After the closing turn the session is over; a further request is `INVALID_HISTORY`.

## Truthfulness rules enforced in code

- The model output may only contain `coachMessage`. Focus, target and `canFinish` come from the server.
- Exactly one question per turn (none on the closing turn).
- No number that the candidate, resume or job did not provide. This blocks invented or suggested metrics such as "40% faster?".
- No hiring-probability, score or guarantee language.
- Client fit statuses only order the questions. Their `explanation` and `evidence` are dropped before the prompt is built, and no interview answer changes a fit status (reassessment is not implemented).

The prompt also tells the model to restate a specific detail from the latest answer, probe for the missing detail when an answer is vague, accept "not measured" without estimating, and never assume the candidate has the skill. Those prose rules are **prompt-only**: code cannot check that a follow-up is relevant or that it does not imply an achievement without a number.

## Demo

`POST /api/interview/next?demo=true&step=0..3` returns fixed `DEMO:` steps from `web/src/lib/ai/interview-demo.ts`. It never reads the body or calls AWS and works with `FIT_LIVE_AI_ENABLED` off. The script: a vague first answer gets a narrower probe; a specific answer that says nothing was measured is acknowledged as **unknown**, not turned into a number; reflection; closing. Each step's coach message refers to the **sample answer** stored next to it (`sampleCandidateAnswer`), so a UI must show those sample answers rather than letting the user type and appear to get a reaction.

## Integration notes for the `/interview` UI

- Keep the scripted mode and labels. Show live output only when the response header is `X-ScaleMe-Mode: live`, and demo output with its `DEMO` label.
- Request: `{ resume, job, history, fit? }`. For targeted questions, send `job.requirements` (stable ids, descriptions, importance). `/api/fit/analyze` does not return requirement descriptions for unstructured jobs, so a fit result alone is not enough to target questions.
- Send `fit.assessments` as `[{ requirementId, status }]` taken from the fit response. Extra fields are ignored.
- Append the returned coach turn as `{ role: "coach", content: turn.coachMessage, targetRequirementId: turn.targetRequirementId }`, then the candidate's answer. Keep answers within 2,000 characters after trimming (the UI already enforces this).
- Handle `INVALID_HISTORY` (start a new session), `AI_UNAVAILABLE` (offer the labeled demo), `RATE_LIMITED` (honor `Retry-After`) and `INVALID_AI_RESPONSE` (offer retry). Do not auto-switch to demo.
- Render `coachMessage` as escaped text. Do not persist history.
- With `FIT_LIVE_AI_ENABLED` off (the default), the live path always returns 503; use `?demo=true` for UI development.

## Not implemented

- Evidence ledger (`CandidateEvidenceRecord`), candidate-reported/confirmed review, and fit reassessment after interview answers.
- Adaptive per-requirement depth (every target gets exactly two questions, whatever the answer quality).
- Server-side session or signature binding history to earlier responses: a client can edit earlier coach text. Coach turns are treated as untrusted data in the prompt.
- Live-model evaluation of question quality or prompt-injection resistance.

## Files

| File | Role |
| --- | --- |
| `web/src/app/api/interview/next/route.ts` | Route: validation order, live switch, shared cost guard, demo |
| `web/src/lib/ai/interview-schemas.ts` | Zod request schema, limits, response type |
| `web/src/lib/ai/interview-plan.ts` | Deterministic target selection and history checks |
| `web/src/lib/ai/interview-prompt.ts` | System prompt and tagged user prompt |
| `web/src/lib/ai/interview.ts` | One model call and output checks |
| `web/src/lib/ai/interview-demo.ts` | Fixed DEMO script |
| `web/src/lib/ai/http.ts` | Body reader and safe error response, shared with `/api/fit/analyze` |
| `*.test.ts` next to each | Mocked unit and route tests |
