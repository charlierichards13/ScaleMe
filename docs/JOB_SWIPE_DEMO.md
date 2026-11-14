# Swipe-to-save job discovery demo — Issue #36

**Status:** Standalone UI prototype at `/discover`. **Synthetic data only.** No sourced jobs, no AI fit calculations, no real application links, and no cloud calls.

## User experience

The `web/src/app/discover/page.tsx` route shows a fictional deck of six internship/entry-level opportunities. The demo UI provides:
- Right swipe **Save**, left swipe **Pass** (also visible buttons).
- Keyboard alternatives: focus the card, right-arrow to save or left-arrow to pass.
- Expandable job details and a transparent "Why this card?" explanation.
- Saved opportunities tab with review and remove controls, last-decision Undo, end-of-deck and reset states.
- Responsive design and reduced-motion CSS.
- Plain-language disclosure that nothing is a live or verified opening.

Save only means **interested**; it never applies to a company. No source/application URLs exist in this fixture. The “why” explanation is explicitly based on the demo role category, **not** on resume fit or an inferred personal qualification.

## Data & state

- `web/src/lib/jobs/demo-openings.ts`: synthetic typed fixtures. **Never present these as live openings.**
- `web/src/lib/jobs/swipe-state.ts`: pure reducer for save, pass, undo, remove saved, reset, and duplicate protection.
- `web/src/lib/jobs/swipe-state.test.ts`: reducer unit tests using Vitest.
- State is held in React memory only; refresh/navigation clears choices. Do not claim that a saved list is persisted.
- No credentials, user resumes, cookies, localStorage, requests or model calls.
- No changes to existing `web/src/app/page.tsx` or shared layout; teammate's dashboard feature remains separately owned.

## How to run and review

From `web/`, install dependencies using `npm ci` and run `npm run dev`. On Windows PowerShell if `npm.ps1` is blocked use `npm.cmd`. Navigate to `http://localhost:3000/discover`.

Suggested checks:
1. Save, pass, and undo two choices; verify the card order and counters.
2. Review the saved list, expand details, and remove a saved item.
3. Use keyboard focus and left/right arrows rather than pointer gestures.
4. Try swipe gestures on mobile width and verify normal vertical page scrolling.
5. Empty the deck, inspect saved roles, reset, and verify all six cards reappear.
6. Confirm visible **FICTIONAL DEMO** disclosure and **no real apply link**.
7. Run `npm run lint`, `npm exec -- next typegen`, `npm exec -- tsc --noEmit`, `npm run test`, `npm run build`, and `npm audit --audit-level=high`.

Do not mark checks as verified without executing them. GitHub Actions results and manual checks should be included in the pull request.

## Future integration (not implemented)

1. [#18](https://github.com/charlierichards13/ScaleMe/issues/18): replace synthetic fixtures with a **permitted provider API** using server-side credentials, normalized `JobOpening`, canonical provider ID, actual source URL, last-checked timestamp, missing-value handling, and deduplication. Do not scrape against provider terms or invent current openings.
2. [#34](https://github.com/charlierichards13/ScaleMe/issues/34): link to the standalone `/discover` route from the dashboard. Do not rewrite the teammate's home page on this feature branch.
3. [#32](https://github.com/charlierichards13/ScaleMe/issues/32): connect a **user-selected** job to explicit `Analyze fit` action, then to evidence discovery and interviews. No model request should be triggered simply by swiping.

Before storing profiles/preferences or using personalized swipe history for model-driven recommendations, update the [threat model](security/THREAT_MODEL.md), explain the collection/retention policy, and offer reset/consent controls. **Saved/passed choices are user preferences, not ground truth about employability or competence.**

**No API contract changes** in this demo PR. A new normalized job discovery contract should be designed with the sourcing integration, not invented here.
