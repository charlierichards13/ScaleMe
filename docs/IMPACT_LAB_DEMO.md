# Resume Impact Lab — fictional prototype

Issue #8 prototype: run `cd web && npm ci && npm run dev`, then visit
`http://localhost:3000/impact-lab`. No credentials or additional dependencies are needed.
The home page and other routes are unchanged.

## Built in this prototype

- Two hand-written before/after examples: employee portal and CSV import validation.
- An evidence inspector links each draft to exact fictional resume/interview quotes with source IDs.
- Candidate-reported statements start as **Needs verification**. **Confirm** marks a
  statement candidate-confirmed within the demo; **Reject** blocks the linked draft.
  **Undo review** returns a statement to reported. None of these states means external verification.
- Copy unlocks only after every linked statement is confirmed. A rejected or unreviewed
  statement locks it again. Missing metrics are excluded and cannot be confirmed into existence.
- Five targeted grilling prompts per original cover contribution, decisions, challenges,
  measurements, and business impact. Potential strengths, evidence gaps, and next actions
  are fixed sample coaching notes, not judgments about the person using the demo.
- Reviews exist only in component memory. Reset/reload discards them. No uploads,
  free-text collection, authentication, storage, telemetry, or API calls are introduced.

## Demonstration script

1. Compare both originals with the clearly marked unconfirmed drafts. Copy is disabled.
2. Inspect the portal. Review its resume excerpt and fictional interview answer.
3. Confirm both: the draft becomes candidate-confirmed and Copy suggestion unlocks.
4. Reject either: the draft becomes blocked, copy locks, and the status message explains why.
5. Undo review or reset the demo. Inspect the CSV example and repeat independently.
6. Expand the grilling prompts. Note that unknown outcomes stay questions, never numbers.

Use keyboard navigation to reach every action and question. Inspect moves focus to the
inspector (including on narrow screens); review/copy/reset results use a live status region.
Clipboard access requires browser permission and a secure context (localhost or HTTPS).
If unavailable, a message explains manual copying of the confirmed text.

Fictional sample screenshots: [desktop](images/impact-lab-desktop.png) and
[mobile](images/impact-lab-mobile.png).

## Verification

From `web/`: `npm run lint`, `npm exec -- next typegen`, `npm exec -- tsc --noEmit`,
`npm run test`, `npm run build`, and `npm audit --audit-level=high`.
`src/app/impact-lab/demo.test.ts` tests quote/source integrity, copy gating, rejection,
undo/reset, independent sessions and suggestions, missing links, and missing metrics.
Manual/browser checks should include desktop and narrow mobile layouts, keyboard focus,
clipboard success/failure, both examples, all question disclosures, and reload/reset.

## Future work — not simulated as live AI

This is not the integrated resume → job → adaptive interview → impact-report pipeline.
Questions do not adapt or accept answers. There is no requirement coverage score,
job-fit assessment, fact verification, general claim validator, or model-generated output.
The local fixture types are view state, not adoption of the proposed v0.2 API contract.
Exact fixture quotes and hand-reviewed paraphrases do not prove real-world truth.

Before live integration, coordinate the evidence contract and server-side provenance
validation with #2/#6/#7, validate all references and claims against actual candidate
sources, preserve missing-fact blocking, and complete privacy/cost/adversarial reviews.
Never reuse the fixed-fixture copy guard as a validator for arbitrary model output.
