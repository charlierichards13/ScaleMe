# ScaleMe — Hackathon Roadmap

**Event:** SunHacks, November 14–15, 2026  
**Goal:** A believable three-minute demonstration of resume upload → job comparison → context-aware interview → honest impact suggestions.  
**Tracking source of truth:** [GitHub Issues](https://github.com/charlierichards13/ScaleMe/issues). Keep this roadmap at a milestone level; the Issues/Projects board owns the live status.

> Scope rule: a small, fully working vertical slice beats five half-finished features. Desktop and mobile use one responsive Next.js/PWA frontend. Native Expo is a stretch goal, not a blocker.

## Milestone 1 — Foundation and parallel work

| Issue | Owner | Done when |
| --- | --- | --- |
| [#1 Next.js foundation](https://github.com/charlierichards13/ScaleMe/issues/1) | @charlierichards13 | Starter app is on `main`, builds in CI, setup documented |
| [#2 API contracts](https://github.com/charlierichards13/ScaleMe/issues/2) | @charlierichards13 | Team agrees on shared request/response shapes |
| [#3 UI/dashboard](https://github.com/charlierichards13/ScaleMe/issues/3) | @MisterProper667 | Synthetic sample user journey is navigable |
| CI and project planning | Both | PR lint/type-check/build and a tracking board are active |

**First integration gate:** both developers can clone, install, run the app and use the same data structures.

## Milestone 2 — Resume and job ingestion

| Issue | Owner | Done when |
| --- | --- | --- |
| [#4 Resume PDF ingestion](https://github.com/charlierichards13/ScaleMe/issues/4) | @MisterProper667 | A text-based PDF extracts or returns a helpful error |
| [#5 Job ingestion](https://github.com/charlierichards13/ScaleMe/issues/5) | @MisterProper667 | Pasted job description works; URL ingestion is best-effort |
| [#14 Mobile PWA](https://github.com/charlierichards13/ScaleMe/issues/14) | @MisterProper667 | Responsive and installable if time permits |

**Second integration gate:** a synthetic resume and job posting appear correctly in the app and are ready for analysis.

## Milestone 3 — Intelligence and candidate growth

| Issue | Owner | Done when |
| --- | --- | --- |
| [#6 Bedrock fit analysis](https://github.com/charlierichards13/ScaleMe/issues/6) | @charlierichards13 | One real AWS-backed structured, evidence-based assessment |
| [#9 AWS infrastructure](https://github.com/charlierichards13/ScaleMe/issues/9) | @charlierichards13 | Backend is configured with server-side credentials and least privilege |
| [#12 Rust matching](https://github.com/charlierichards13/ScaleMe/issues/12) | @charlierichards13 | Real match signal influences analysis; tests pass |
| [#7 Mock interview](https://github.com/charlierichards13/ScaleMe/issues/7) | @MisterProper667 | Coach asks coherent answer-aware follow-ups |
| [#8 Impact report](https://github.com/charlierichards13/ScaleMe/issues/8) | @charlierichards13 | Factual before/after bullets grounded in resume/interview evidence |

**Third integration gate:** full upload → analysis → interview → revised bullets flow works, including a documented synthetic demo fallback when an external integration is unavailable.

## Milestone 4 — Quality, expo and submission

| Issue | Owner | Done when |
| --- | --- | --- |
| [#10 Test and privacy pass](https://github.com/charlierichards13/ScaleMe/issues/10) | Both | Smoke tests, failure states and secret checks complete |
| [#11 Demo/submission](https://github.com/charlierichards13/ScaleMe/issues/11) | Both | Three-minute live demo rehearsed, backup prepared, submission requirements reviewed |

**Final gate:** an unfamiliar judge can understand the problem and witness a meaningful improvement in an applicant's story in under three minutes.

## Proposed GitHub Project board

The repository already has an owner-level **untitled project** visible in GitHub. Rename/link it to **ScaleMe | SunHacks 2026** from the GitHub UI and add all ScaleMe issues. Suggested saved views:

- **Board:** Group by `Status` with `Backlog`, `Ready`, `In progress`, `In review`, `Done`.
- **Table:** Columns `Title`, `Assignees`, `Status`, `Priority`, `Target date`.
- **Roadmap:** Timeline grouped by milestone, if desired. GitHub's timeline needs date fields to be meaningful.
- **My work:** Filter by `Assignee` for quick handoff.

Suggested custom fields: `Priority` (`P0`, `P1`, `Stretch`), `Workstream` (`Frontend`, `Ingestion`, `AI`, `Rust`, `Cloud`, `Demo`), and `Target date`.

Use the Project's **Workflows → Auto-add to project** to automatically capture newly opened ScaleMe issues. This is separate from GitHub Actions CI. The board setup itself is a **manual GitHub UI step**, not yet configured by this document.

## Our merge and agent workflow

1. **Claim exactly one issue** for each coding agent/task. A human owns integration and review.
2. Branch from the latest `main` (for example `feat/job-ingestion`), not from another agent's unpublished changes.
3. Read [API contracts](api-contract.md) before writing frontend/backend integrations. Propose changes to the contract explicitly instead of silently inventing incompatible payloads.
4. Open a pull request with `Closes #<issue>` where the issue is fully implemented, or `Refs #<issue>` for partial work.
5. GitHub Actions **Web quality** checks `npm ci`, lint, TypeScript, tests (when added), and production build. **Rust quality** checks fmt, clippy and tests after the Rust crate exists.
6. The other teammate reviews, then merge to `main` **after checks pass**. If repository rules allow it, require a review and passing status checks in **Settings → Rules → Rulesets** (or **Branches**).
7. Pull the updated `main` before beginning the next issue. Never paste real applicant resumes, tokens, or AWS secrets into the repo or AI-agent prompts.

### Important CI distinction

The presence of `.github/workflows/ci.yml` *runs* automatic checks; it does **not** automatically *block* an attempted merge. Requiring successful checks and reviews is a separate repository ruleset/branch-protection setting, subject to GitHub plan and admin permissions.

**Suggested required checks (only after their first successful run):** `Web quality` and `Rust quality`. Do not require stale or nonexistent checks; test enforcement with a small pull request.

## Scope control

**Must ship:** resume text, pasted job description, AWS-backed analysis, coherent text interview, evidence-based suggestions, responsive UI, three-minute demo.

**If time permits:** automated URL retrieval, Rust enrichment, installable PWA, nicer interview history, real-time visualizations, Grok bot workflow requirements.  
**Not for initial hackathon scope:** full native mobile app, accounts, long-term storage, app-store publishing, voice calls.

The product must never invent achievements, represent a fit score as a hiring guarantee, or expose private applicant information. Synthetic sample data is preferred for demo and tests.
