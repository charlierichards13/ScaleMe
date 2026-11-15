# Swipe-to-save job discovery demo — Issue #36

**Status:** Standalone UI prototype at `/discover`. **Synthetic data only.** No sourced jobs, no AI fit calculations, no real application links, and no cloud calls.

## User experience

The `web/src/app/discover/page.tsx` route shows a fictional deck of six internship/entry-level opportunities. The demo UI provides:
- Right swipe **Save**, left swipe **Pass** (also visible buttons).
- Keyboard alternatives: focus the card, right-arrow to save or left-arrow to pass.
- After a decision or Undo, focus moves to the replacement card, or to the completion heading when the deck is empty. Undo remains available after the final card.
- Expandable job details and a transparent "Why this card?" explanation.
- Saved opportunities tab with review and remove controls, last-decision Undo, end-of-deck and reset states.
- Explore/Saved use an accessible tablist with one tab stop: Left/Right wraps between panels, Home selects Explore, and End selects Saved. Selection follows focus; Tab enters the panel. Clicking a tab keeps focus on it. Back to cards/View saved moves focus into the chosen panel.
- Removing a saved role focuses the next removal button, the previous one when removing the last list item, or the Saved heading when the list becomes empty. Removed roles stay passed and are not restored by Undo, preserving reducer behavior.
- Responsive design and reduced-motion CSS.
- Plain-language disclosure that nothing is a live or verified opening.

Save only means **interested**; it never applies to a company. No source/application URLs exist in this fixture. The “why” explanation is explicitly based on the demo role category, **not** on resume fit or an inferred personal qualification.

## Data & state

- `web/src/lib/jobs/demo-openings.ts`: synthetic typed fixtures. **Never present these as live openings.**
- `web/src/lib/jobs/swipe-state.ts`: pure reducer for save, pass, undo, remove saved, reset, and duplicate protection.
- `web/src/lib/jobs/swipe-state.test.ts`: reducer unit tests using Vitest.
- State is held in React component memory only. Switching Explore/Saved retains choices. Restart demo clears saved/passed/history and restores all six cards; refresh or a fresh page instance starts a new deck. Another tab starts independently.
- Navigation is not a guaranteed reset: Next.js may retain the page in memory, so browser Back/Forward can restore earlier choices. Unmounting/discarding that instance loses them. This is not persistent storage or a shared saved-jobs list; dashboard saves and `/saved` are separate.
- No credentials, user resumes, cookies, browser storage, job/AI requests or model calls. Normal Next.js page/asset requests still occur.
- No changes to existing `web/src/app/page.tsx` or shared layout; teammate's dashboard feature remains separately owned.

## How to run and review

From `web/`, install dependencies using `npm ci` and run `npm run dev`. On Windows PowerShell if `npm.ps1` is blocked use `npm.cmd`. Navigate to `http://localhost:3000/discover`.

Suggested checks:
1. Save, pass, and undo two choices; verify card order, counters, and focus on each replacement card.
2. Review saved details; remove the first, last, and only saved items. Verify focus falls to the next/previous removal button or the empty Saved heading, with no role reintroduced to the deck.
3. Make consecutive left/right card decisions without refocusing. Verify Explore/Saved selected state, roving tab stop, Left/Right wrap, Home/End, Enter/Space, and Tab into the panel.
4. Try swipe gestures on mobile width and verify normal vertical page scrolling.
5. Empty the deck, check completion-heading focus, Undo the final save/pass, inspect saved roles, reset, and verify all six cards and empty saved/history state return.
6. Confirm visible **FICTIONAL DEMO** disclosure and **no real apply link**.
7. Run `npm run lint`, `npm exec -- next typegen`, `npm exec -- tsc --noEmit`, `npm run test`, `npm run build`, and `npm audit --audit-level=high`.
8. Check WCAG AA contrast in Explore (including expanded details), empty/populated Saved, and completion; check desktop/mobile widths and reduced-motion preferences.
9. Verify refresh and a separate tab start empty, while Back/Forward may retain choices. After integration with current main, verify both dashboard links reach `/dashboard`.

Do not mark checks as verified without executing them. GitHub Actions results and manual checks should be included in the pull request.

## Future integration (not implemented)

1. [#18](https://github.com/charlierichards13/ScaleMe/issues/18): replace synthetic fixtures with a **permitted provider API** using server-side credentials, normalized `JobOpening`, canonical provider ID, actual source URL, last-checked timestamp, missing-value handling, and deduplication. Do not scrape against provider terms or invent current openings.
2. [#34](https://github.com/charlierichards13/ScaleMe/issues/34): link to the standalone `/discover` route from the dashboard. Do not rewrite the teammate's home page on this feature branch.
3. [#32](https://github.com/charlierichards13/ScaleMe/issues/32): connect a **user-selected** job to explicit `Analyze fit` action, then to evidence discovery and interviews. No model request should be triggered simply by swiping.

The PR #37 base predates `/dashboard` and the shared route module. Its two dashboard links temporarily use a route-local `routes.dashboard` target and disable prefetch so the standalone demo does not request that absent page in the background. Verify actual navigation against current main, where `/dashboard` exists. When integrating with main, replace the local constant with the existing shared `routes.dashboard` import, coordinated with the navigation owner. No shared files are changed here.

Before storing profiles/preferences or using personalized swipe history for model-driven recommendations, update the [threat model](security/THREAT_MODEL.md), explain the collection/retention policy, and offer reset/consent controls. **Saved/passed choices are user preferences, not ground truth about employability or competence.**

**No API contract changes** in this demo PR. A new normalized job discovery contract should be designed with the sourcing integration, not invented here.
