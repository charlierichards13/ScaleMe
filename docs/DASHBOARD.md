# Career Dashboard (Issue #34)

**Branch:** `feat/dashboard-flow` · **Status:** frontend only. No new APIs, storage or AI calls.

The dashboard at `/` is the home of the ScaleMe workspace. It introduces the four main tools, shows what the candidate has added so far, and suggests what to do next. Every value is either **intentionally empty** or **labeled DEMO / fictional**.

## Product direction note

Issue #34 described the dashboard as the opening route. The product direction has since changed to **Welcome → Sign up / Sign in → Onboarding → Dashboard → Workspaces**. The welcome page, authentication and onboarding are separate tasks and are **not** built here. The dashboard stays at `/` for now and can move behind auth later without any component changes.

## Layout

| Area | Component | Data |
| --- | --- | --- |
| Sidebar (desktop) / drawer (mobile) | `components/layout/AppShell.tsx`, `Sidebar.tsx`, `nav-items.ts` | Static nav. Each item shows a status: *Demo* or *Soon* |
| Header, demo switch, profile link | `components/dashboard/DashboardView.tsx` | Client state only |
| Hero + "how ScaleMe digs deeper" ladder | `HeroPanel.tsx` | CTA changes depending on whether a resume exists |
| Four tool cards | `FeatureCards.tsx` | Links to `/discover-preview` (temporary), `/fit`, `/impact-lab`, `/interview` |
| Recommended roles | `RecommendedJobs.tsx`, `JobPreviewCard.tsx` | Empty, or 3 fictional listings in demo mode |
| Evidence insights | `EvidenceInsights.tsx` | Empty, or 3 sample assessments in demo mode |
| Profile & goals | `ProfileSummary.tsx` | Empty, or the sample profile in demo mode |
| Continue your progress | `NextSteps.tsx` | Derived by `getNextSteps()` |

Shared primitives (`Card`, `Badge`, `DemoBadge`, `EmptyState`, `SectionHeading`, `buttonStyles`) are in `components/ui/primitives.tsx`. Design tokens are in `app/globals.css` (canvas `#F8F9FC`, ink `#202638`, muted `#64748B`, line `#E6E9F0`, brand `#5856D6`, brand-soft `#EEF0FF`). Icons come from `lucide-react` (pinned `1.61.0`).

## Data model and the future live integration

- `lib/dashboard/types.ts`: view-model types. `EvidenceStatus` mirrors `RequirementAssessment.status` in [api-contract.md](api-contract.md), so a `FitAnalysis` can be mapped onto these cards without a new shape. "unclear" is displayed as *Needs clarification*.
- `lib/dashboard/snapshot.ts`: `getDashboardSnapshot("empty" | "demo")`. This function is pure and deterministic (no `Date`, no randomness), so static prerendering under `cacheComponents` is safe. To add live data, add a new `source` that returns the same `DashboardSnapshot`.
- `lib/dashboard/demo-data.ts`: fictional fixtures only.
- `lib/routes.ts`: the single list of routes.

Demo mode is a toggle held in client state. It makes no network requests (no Bedrock calls or other paid requests) and stores nothing.

## Routes in this branch

| Route | What it is |
| --- | --- |
| `/` | Dashboard |
| `/coach` | The previous chat-first demo, moved here unchanged except for a "Back to dashboard" link. It is still scripted, not live AI |
| `/impact-lab` | Not part of this branch: the fictional Resume Impact Lab from main (PR #39). The sidebar's *Resume Lab* item, the *Grill My Resume* card and the "Explain a project" next step link to it |
| `/resume-lab`, `/fit`, `/interview`, `/saved`, `/settings` | Clearly labeled "Not available yet" placeholders, built from `FeaturePlaceholder`, that link to the Coach demo. `/resume-lab` is where resume upload will live, and the hero's *Upload your resume* button points there |
| `/discover-preview` | **Temporary** labeled placeholder. The real `/discover` belongs to PR #37 (`feat/job-swipe-discovery`) and isn't created here. Once #37 merges, set `routes.discover` in `web/src/lib/routes.ts` back to `"/discover"` and delete `app/(workspace)/discover-preview/`. A separate path avoids two pages resolving to `/discover` |
| `/fit` | Placeholder. Connect it to the Fit Evidence Explorer at `/fit-insights` once PR #41 merges |

## Integrity and international-student rules applied

- No hiring probabilities, scores, streaks or application counts.
- *Not evidenced* is explained as "not shown in your resume", not as a missing skill.
- Job cards show only what the listing says about work authorization. *Not stated* is shown as "verify with the employer", never as ineligible. These notes appear only when the profile has opted in.
- No real names, companies, or account details. The guest session is labeled as not saved.

## Security notes

- Every user, demo and model text is rendered as escaped React text. There is no `dangerouslySetInnerHTML`, `eval`, or dynamic URL from data.
- No browser storage. Saved roles live only in component memory and reset whenever the dashboard re-renders fresh (switching demo mode, reloading, or navigating away once Next.js evicts the page from its route cache).
- No secrets and no `NEXT_PUBLIC_` variables. No new network calls or API routes. The threat model is unchanged for that reason.

## Automated tests (Vitest)

- `web/src/lib/dashboard/snapshot.test.ts`: empty vs demo snapshots, deterministic output, next-step ordering, and honest fixtures (every job fictional, no `not_evidenced` evidence quotes, no percentages or probability wording).
- `web/src/lib/routes.test.ts`: every route constant resolves to a real `page.tsx` (route groups included), so a 404 link fails CI. Also checks that nav items and next steps use known routes, and covers `isActive` matching.

These test logic only. Component interaction tests would need a DOM test environment, which isn't set up yet; the manual checks below cover interactions.

## Manual verification done (production build, `next start`)

- 1440, 768 and 390 px widths: no horizontal overflow (`scrollWidth` ≤ viewport).
- Mobile drawer: opens, moves focus inside, closes with Escape, returns focus to the menu button, and closes on navigation.
- Demo switch toggles all sections, shows the demo banner, and *Exit demo* restores empty states.
- `/coach`: *Load demo* → *Analyze fit* still produces the labeled DEMO output.
