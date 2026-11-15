# Mock Interview workspace

**Route:** `/interview`  
**Branch:** `feat/cursor-interview-ui`  
**Status:** scripted browser demo. No API, no model call, and no saved transcript.

This page replaces the Mock Interview placeholder with a practice workspace. It is a fixed script, not the answer-aware interviewer described in [api-contract.md](api-contract.md) and [DIFFERENTIATION.md](DIFFERENTIATION.md).

## What is implemented

- Two modes, **Technical** and **Behavioral**. Each has five questions in a fixed order: context, your contribution, trade-offs, what changed, and reflection.
- One question on screen at a time. Submitting a non-empty answer reveals the next scripted question.
- Text answers. Empty and whitespace-only answers stay on the same question. Answers are trimmed, then limited to 2,000 characters. Internal spaces and line breaks are kept.
- Progress (`Question n of 5`), an in-session history of submitted answers, and a completion recap.
- Restart, exit, and mode switch. Each one asks for confirmation and states how many submitted answers will be discarded.
- Keyboard use: labeled controls, visible focus, Ctrl or ⌘ + Enter to submit, and Escape to dismiss the discard dialog.
- Layout that stacks on narrow screens and places history beside the question on large screens.

The session lives in React state inside `web/src/app/(workspace)/interview/`. Refreshing the page, leaving it (including the sidebar), restarting, exiting, or switching mode drops that state. Answers are not written to `localStorage`, cookies, or a server.

## What is simulated

The label **Scripted Demo — Not Live AI** is shown on the page. Questions and practice prompts are constants in `questions.ts`. The next question does not depend on the text of an answer, a resume, or a job description.

The completion recap repeats the candidate's answers exactly. Under each answer it shows the practice prompt that belongs to that question's focus. Those prompts are the same for every session. They are reflective questions, not a score, a hiring judgment, or a claim about what the candidate achieved. The workspace does not invent metrics, employers, or improvement.

## What is not implemented

These stay future work and are **not** claimed by this page:

- `POST /api/interview/next` ([api-contract.md](api-contract.md)): one follow-up at a time that cites the candidate's own details.
- Targeted questions for unresolved job requirements, stable requirement IDs, and answer-aware follow-ups ([DIFFERENTIATION.md](DIFFERENTIATION.md), Issue #7).
- A candidate evidence ledger, `candidate_reported` / `candidate_confirmed` review, or before/after coverage counts.
- Accounts, transcript storage, or sending answers to Bedrock or any other model.

When a live interviewer is added, keep this scripted path visibly separate from live output. Do not store interview text until there is an explicit privacy review. Server validation, size limits, and safe errors belong with that API, not in this client demo.

## Files

| File | Role |
| --- | --- |
| `web/src/app/(workspace)/interview/page.tsx` | Route and document title |
| `web/src/app/(workspace)/interview/questions.ts` | Fixed question banks and scripted labels |
| `web/src/app/(workspace)/interview/session.ts` | Pure session transitions |
| `web/src/app/(workspace)/interview/session.test.ts` | Progression, validation, restart, and isolation tests |
| `web/src/app/(workspace)/interview/MockInterviewWorkspace.tsx` | Client workspace UI |

Shared navigation labels this route *Practice* (`nav-items.ts` and the dashboard Mock Interview card). The page badge remains **Scripted Demo — Not Live AI**. One note under that badge states that the script does not adapt, that answers stay in memory on this page and are not uploaded, and that they are discarded when you leave or refresh.

## Tests

`web/src/app/(workspace)/interview/session.test.ts` covers mode selection, whitespace-only answers, the length limit, one-question progression, completion, mode switching, restart, exit, discard copy, and isolation between session objects. The UI is not rendered in Vitest; the web test config runs in Node and only includes `src/**/*.test.ts`.
