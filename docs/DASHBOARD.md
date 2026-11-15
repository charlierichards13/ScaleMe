# Career Dashboard (Issue #34)

**Current presentation update:** [Phase B verification, screenshots and demo route](DASHBOARD_PHASE_B.md) (Issue #58, `feat/dashboard-workspace-polish`).

**Original implementation:** `feat/dashboard-flow` · **Status:** frontend only. No new APIs, storage or AI calls.

The dashboard at `/dashboard` is the home of the ScaleMe workspace. It introduces the four main tools, shows what the candidate has added so far, and suggests what to do next. Every value is either **intentionally empty** or **labeled DEMO / fictional**.

## Product direction note

Issue #34 described the dashboard as the opening route. The product direction has since changed to **Welcome → Sign up / Sign in → Onboarding → Dashboard → Workspaces**. Issue #43 moved the dashboard from `/` to `/dashboard` (only the page file moved, to `app/(workspace)/dashboard/page.tsx`) and added the public welcome page at `/` and guest onboarding at `/onboarding`. See [WELCOME_ONBOARDING.md](WELCOME_ONBOARDING.md). Sign-in and sign-up are Issue #42. The dashboard has no auth guard yet.

## Layout

| Area | Component | Data |
| --- | --- | --- |
| Sidebar (desktop) / drawer (mobile) | `components/layout/AppShell.tsx`, `Sidebar.tsx`, `nav-items.ts` | Static nav. A status, when shown, is *Sample*, *Practice*, *Preview*, or *Planned* |
| Guest/sample header, demo switch, setup link | `components/dashboard/DashboardView.tsx` | Client state only |
| Ink hero + story ladder | `HeroPanel.tsx` | Empty state opens interview practice. Sample data opens the sample resume story and the fit explorer |
| Four tool cards | `FeatureCards.tsx` | Discover stays on `/discover-preview` (*Planned*). Fit opens `/fit-insights` (*Preview*). Resume Lab opens `/impact-lab` (*Sample*). Interview opens `/interview` (*Practice*) |
| Recommended roles | `RecommendedJobs.tsx`, `JobPreviewCard.tsx` | Empty, or 3 fictional listings in demo mode |
| Evidence insights | `EvidenceInsights.tsx` | Empty, or 3 sample assessments in demo mode |
| Profile & goals | `ProfileSummary.tsx` | Empty, or the sample profile in demo mode |
| Open a working page | `NextSteps.tsx` | Derived by `getNextSteps()` |

Shared primitives (`Card`, `Badge`, `DemoBadge`, `EmptyState`, `SectionHeading`, `buttonStyles`) are in `components/ui/primitives.tsx`. Design tokens are in `app/globals.css` (canvas `#F8F9FC`, ink `#0D1039`, muted `#535A77`, line `#E6E9F0`, brand `#7153FC`, brand-strong `#3928B8`, brand-soft `#F0EBFF`). Icons come from `lucide-react` (pinned `1.61.0`).

## Data model and the future live integration

- `lib/dashboard/types.ts`: view-model types. `EvidenceStatus` mirrors `RequirementAssessment.status` in [api-contract.md](api-contract.md), so a `FitAnalysis` can be mapped onto these cards without a new shape. "unclear" is displayed as *Needs clarification*.
- `lib/dashboard/snapshot.ts`: `getDashboardSnapshot("empty" | "demo")`. This function is pure and deterministic (no `Date`, no randomness), so static prerendering under `cacheComponents` is safe. To add live data, add a new `source` that returns the same `DashboardSnapshot`.
- `lib/dashboard/demo-data.ts`: fictional fixtures only.
- `lib/routes.ts`: the single list of routes.

Demo mode is a toggle held in client state. It makes no network requests (no Bedrock calls or other paid requests) and stores nothing.

## Routes in this branch

| Route | What it is |
| --- | --- |
| `/dashboard` | Dashboard (was `/` before Issue #43). `/` is now the public welcome page |
| `/coach` | The previous chat-first demo, moved here unchanged except for a "Back to dashboard" link. It is still scripted, not live AI. Sidebar status is *Practice* |
| `/impact-lab` | Fictional Resume Impact Lab (PR #39). The sidebar's *Resume Lab* item, the *Resume Lab* card, and the sample-resume next step link to it |
| `/interview` | Scripted practice workspace. Sidebar and the dashboard card label it *Practice*. See [INTERVIEW.md](INTERVIEW.md) |
| `/discover-preview` | **Temporary** placeholder. The real `/discover` belongs to PR #37 and is not in this build. Once #37 merges, set `routes.discover` back to `"/discover"` and delete `app/(workspace)/discover-preview/`. The primary button opens the fit explorer |
| `/resume-lab` | Upload placeholder. The primary button opens the sample resume story. The hero does not link here; Resume Lab in the sidebar opens `/impact-lab` |
| `/saved` | Placeholder. The primary button opens interview practice. A save on the dashboard stays on the dashboard |
| `/settings` | Placeholder. The primary button opens guest setup at `/onboarding` |
| `/fit` | Placeholder kept for the fit entry PR #46 replaces. Its button still matches that page's own status text. Navigation and dashboard cards use `routes.fitInsights` (`/fit-insights`): local resume and job drafts, plus an explicitly selected fictional sample. Live analysis is off |

## Integrity and international-student rules applied

- No hiring probabilities, scores, streaks or application counts.
- *Not evidenced* is explained as "not shown in your resume", not as a missing skill.
- Job cards show only what the listing says about work authorization. *Not stated* is shown as "verify with the employer", never as ineligible. These notes appear only when the profile has opted in.
- No real names, companies, or account details. The guest session says what you enter stays on that page until you leave or refresh, and it is not uploaded.

## Security notes

- Every user, demo and model text is rendered as escaped React text. There is no `dangerouslySetInnerHTML`, `eval`, or dynamic URL from data.
- No browser storage. Saved roles live only in component memory and reset whenever the dashboard re-renders fresh (switching demo mode, reloading, or navigating away once Next.js evicts the page from its route cache).
- No secrets and no `NEXT_PUBLIC_` variables. No new network calls or API routes. The threat model is unchanged for that reason.

## Automated tests (Vitest)

- `web/src/lib/dashboard/snapshot.test.ts`: empty vs demo snapshots, deterministic output, next-step ordering, and honest fixtures (every job fictional, no `not_evidenced` evidence quotes, no percentages or probability wording).
- `web/src/lib/routes.test.ts`: every route constant resolves to a real `page.tsx` (route groups included), so a 404 link fails CI. Also checks that nav items and next steps use known routes, that Fit Analysis opens `/fit-insights` as *Preview*, that Mock Interviews and Career Coach open as *Practice*, and that no nav item is labeled *Soon* or starts with "AI ". Covers `isActive` matching.

These unit tests cover logic. `web/scripts/dashboard-workspace-smoke.mjs` adds production Chromium interaction/regression coverage without a DOM test dependency; see the Phase B verification above.

## Manual verification done (production build, `next start`)

- 1440, 768 and 390 px widths: no horizontal overflow (`scrollWidth` ≤ viewport).
- Mobile drawer: opens, moves focus inside, closes with Escape, returns focus to the menu button, and closes on navigation.
- Demo switch toggles all sections, shows the demo banner, and *Exit demo* restores empty states.
- `/coach`: *Load demo* → *Analyze fit* still produces the labeled DEMO output.
