# Fit Evidence Explorer — Issue #40

`/fit-insights` is a standalone **FICTIONAL DEMO**, complementing `/impact-lab`.
Everything about the candidate, employer, job, resume, and interview is a hand-written
sample. Candidate-reported is not independently verified. Coverage measures documented
evidence, not ability or hiring probability.

## Three-minute walkthrough

1. Open `/fit-insights`. The target role lists four required requirements and one
   preferred requirement. Baseline coverage is **2 of 4 required requirements supported**.
2. Inspect the web application and collaboration cards: read the exact resume quotes.
   Inspect feedback: related context exists, but the resulting change is unknown.
   Inspect testing: there is no supporting quote. Job text is displayed separately.
3. At **One question. More documented evidence.**, reveal the specific fictional answer.
   Read the candidate's words. The active before snapshot stays at 2 of 4.
4. Select **Compare after this answer**. Only testing changes from not evidenced to
   supported; coverage becomes **3 of 4**. Inspect its exact interview-turn quote.
   Before/after buttons let judges revisit either snapshot. The answer stays visible.
5. Choose the vague or unrelated answer and reveal/compare it. Both remain **2 of 4**,
   with a narrower clarification prompt. Automation remains not evidenced even with
   the specific answer; no tool, outcome, or numerical achievement is inferred.
6. Expand the full fictional resume source. Use the status filter or reset the demo.
   Follow the Impact Lab link to explore writing separately: state does not transfer.

## Implemented versus simulated

Implemented: responsive requirement inventory, status filters, keyboard-operated native
controls, focus transfer to the evidence inspector, exact quote display, source labels,
unknown/missing-evidence states, sample-answer reveal gate, deterministic before/after
counting, reset, clarification questions, reduced-motion styles, and a separate Impact
Lab link. All state is component-local; refreshing resets it.

Simulated: role extraction, candidate evidence, coaching questions, requirement relevance,
and reassessment. Only predefined fixture links are accepted. There is no semantic AI
classifier and no arbitrary resume, job, answer, or API response input. Exact substring
matching alone cannot establish relevance; this demo also requires the complete manually
approved requirement/source/quote tuple. No rewrite changes coverage.

`demo.ts` defines **local fixture types**, not a wire contract. The v0.1 API and existing
backend remain unchanged. The proposed v0.2 evidence ledger is **not implemented**.
Future live integration must adapt validated v0.1 assessments, coordinate any agreed
v0.2 migration, and validate provenance and relevance server-side. Never reuse the
fixed-fixture allowlist as a general-purpose evidence validator.

The denominator is the fixed required IDs `web`, `collaboration`, `testing`, `feedback`.
Counting rejects missing, extra, duplicate, preferred, or substituted IDs. Unknown
selection resolves to an explicit unavailable inspector state. The inventory also has
an empty-filter recovery state. No network/service failure UI is needed because there
is no network-based analysis. No accounts, uploads, persistence, telemetry, AWS calls,
backend changes, new dependencies, or paid services were added.

Styles live in a route-owned stylesheet with `fit-explorer-` class prefixes. This avoids
the existing Turbopack `*.css` rule's CSS-module mapping behavior without touching shared
configuration, layout, or global styles.

## Verification

From `web/`:

```bash
npm ci
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm test
npm run build
npm audit --audit-level=high
```

Unit suite: 45 tests across 5 files pass (10 new explorer cases, including parameterized
missing/vague/irrelevant answers). Covers stable IDs, precise source/quote links, hidden
answers, unknown IDs, fabricated/partial quotes, job-only evidence, unrelated evidence,
rewriting alone, selection lookup, and only-testing status transitions.

Production Chromium checks: desktop/mobile widths 320, 390, 768, and 1440; no horizontal
overflow; exact resume/interview quotes; reveal-before-compare gating; both snapshots;
vague/unrelated answers; reset; status filter; native source disclosure; keyboard skip
link and Enter activation; inspector focus transfer; reduced-motion transitions disabled;
offline interactions after load; no API requests or browser exceptions. Visual inspection
uses the desktop/mobile screenshots below. This is browser automation and visual review,
not a screen-reader audit or exhaustive WCAG certification. A fresh offline load is not
promised: no service worker or offline installation was added.

Audit exits 0 at the high/critical threshold. Nine existing moderate advisories remain
in the ESLint/minimatch development dependency tree; dependencies and lockfile unchanged.
`npm ci` emits existing ESLint peer-range warnings. No Rust crate exists on this base.
No live AWS/model behavior was tested or changed.

## Screenshots (fictional data only)

- [Desktop before interview](screenshots/fit-insights/desktop-before.png)
- [Desktop after interview](screenshots/fit-insights/desktop-after.png)
- [Mobile after interview](screenshots/fit-insights/mobile-after.png)

## Remaining limitations

No live analysis, arbitrary input, independent verification, resume rewriting on this
page, cross-page handoff state, or end-to-end API integration. Questions and next steps
are authored fixtures. Human review is still needed before merging; do not deploy this
as a real candidate assessment service.
