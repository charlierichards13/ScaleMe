# Fit Evidence Explorer: offline interview walkthrough (Issue #40)

Open `/fit-insights`, then **Open offline walkthrough**. This original fictional scenario
is now embedded below local input/API results panels. Its candidate, employer, role, resume
and answers are hand-written. Candidate-reported is not independently verified; coverage
is not ability or hiring probability. For the new inputs/API demonstration and current
verification, see [client integration notes](FIT_INSIGHTS_INTEGRATION.md).

## Walkthrough

1. Inspect four required requirements and one preferred requirement. Baseline coverage is
   2 of 4 required requirements supported.
2. Inspect web application/collaboration for exact resume quotes. Feedback is incomplete;
   testing has no supporting quote. Job context is separate from candidate evidence.
3. Reveal the specific fictional answer under **One question. More documented evidence.**
   Coverage stays at 2 of 4 until **Compare after this answer** is pressed.
4. Compare: only testing changes to supported, with an exact interview quote; coverage
   becomes 3 of 4. Switch between before/after to inspect the transition.
5. Vague/unrelated answers remain 2 of 4. Automation stays not evidenced. No tool, numerical
   achievement or outcome is inferred.
6. Filter, inspect full fictional resume excerpts or reset. Impact Lab opens a separate
   demo without transferring evidence or selections. Closing the walkthrough resets its state.

## Scope and integrity

`offline-explorer.tsx` renders the original scenario; `demo.ts` contains local fixture types,
not wire types. `demo.test.ts` preserves stable inventory, exact source/quote links,
reveal-before-compare and deterministic counting. Required IDs are `web`, `collaboration`,
`testing`, `feedback`; preferred skills are excluded. Missing, extra, duplicate, substituted
or unknown IDs cannot inflate coverage. Quotes need the complete manually approved
requirement/source/quote tuple. Mutated quotes, job-only context, missing answers and
vague/irrelevant answers cannot add support.

This is not a semantic classifier or live evidence ledger. General integration still needs
server provenance/relevance checks and an agreed v0.2 contract. Drafts/API responses never
enter this fixture allowlist. Walkthrough interactions make no network calls. No accounts,
uploads, storage, telemetry or model calls are added by the walkthrough. Original scoped
`fit-explorer-` styles remain inside the new workspace; shared layout/styles are unchanged.

## Historical standalone screenshots

These predate the new workspace. Current captures are linked in the integration notes.

- [Before interview](screenshots/fit-insights/desktop-before.png)
- [After interview](screenshots/fit-insights/desktop-after.png)
- [Mobile after interview](screenshots/fit-insights/mobile-after.png)
