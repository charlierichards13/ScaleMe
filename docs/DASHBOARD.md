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
| Four tool cards | `FeatureCards.tsx` | Links to `/discover`, `/fit`, `/resume-lab`, `/interview` |
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
| `/resume-lab`, `/fit`, `/interview`, `/saved`, `/settings` | Clearly labeled "Not available yet" placeholders, built from `FeaturePlaceholder`, that link to the Coach demo |
| `/discover` | **Not created here.** It belongs to PR #37 (`feat/job-swipe-discovery`). Until that merges, the link shows the branded `not-found` page, and Next.js prefetches of `/discover` log 404s in the console |

## Integrity and international-student rules applied

- No hiring probabilities, scores, streaks or application counts.
- *Not evidenced* is explained as "not shown in your resume", not as a missing skill.
- Job cards show only what the listing says about work authorization. *Not stated* is shown as "verify with the employer", never as ineligible. These notes appear only when the profile has opted in.
- No real names, companies, or account details. The guest session is labeled as not saved.

## Security notes

- Every user, demo and model text is rendered as escaped React text. There is no `dangerouslySetInnerHTML`, `eval`, or dynamic URL from data.
- No browser storage. Saved roles live in component memory for the current tab only.
- No secrets and no `NEXT_PUBLIC_` variables. No new network calls or API routes. The threat model is unchanged for that reason.

## Manual verification done (production build, `next start`)

- 1440, 768 and 390 px widths: no horizontal overflow (`scrollWidth` ≤ viewport).
- Mobile drawer: opens, moves focus inside, closes with Escape, returns focus to the menu button, and closes on navigation.
- Demo switch toggles all sections, shows the demo banner, and *Exit demo* restores empty states.
- `/coach`: *Load demo* → *Analyze fit* still produces the labeled DEMO output.
