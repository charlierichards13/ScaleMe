# Fit Evidence Explorer: frontend security review addendum

Scope: `feat/fit-evidence-integration`, from main `950f99a`. Supplements the existing
[threat model](THREAT_MODEL.md) and [review checklist](REVIEW_CHECKLIST.md). This focused
addendum avoids editing those central files while PR #45 is active. It is not a security
certification or a waiver of SECURITY.md's public launch gate.

## Trust boundaries and data flow

The browser now accepts untrusted resume/title/job draft text in React memory. Local
checks enforce documented field/encoded-byte limits for future use. No draft is sent,
persisted, logged or passed to the offline simulation. Next.js/browser back navigation can
retain memory; Clear drafts removes it. Privacy copy does not promise destruction on navigation.

Only explicit demo selection plus a load action sends a bodyless same-origin POST with
`?demo=true`. The existing handler checks that query before parsing input or calling AI.
Credentials are omitted, redirects rejected, caching disabled, and no automatic retry occurs.
The client rejects live mode before fetch. No endpoints, credentials, AWS settings, environment
variables, dependencies or shared styles/layouts change.

API output is untrusted: schema/length checks, demo markers, unique IDs and source/status
consistency checks precede display. React escapes all prose. Job excerpts cannot establish
supported candidate evidence; interview evidence is rejected because this endpoint accepts
no history. Sparse v0.1 data is not used to infer required coverage or before/after progress.
The client generates no evidence or achievements. These checks cannot establish semantic truth.

Fixed error messages replace raw server/provider prose. Cancel/unmount abort the request and
ignore stale completions. A 15-second timeout bounds waiting. HTTP 429 gets manual-retry
cooldown, which is not server abuse/cost protection and can reset on mode exit/reentry.

## Original integration checks executed

- Mocked client tests: live blocked; exact demo URL; no draft body/cookies; no redirects,
  retries or fallback; malformed/schema/mode/source/duplicate-ID responses rejected;
  safe request/resume/job/AI errors; Retry-After; network rejection; cancellation/timeout.
- Draft tests: blank/whitespace, boundary/oversized fields, escaped body-byte overflow,
  v0.1 compatibility and hostile instructions treated as data.
- Presentation tests: statuses, exact quotes and source distinctions, missing quote/empty
  section states, no inferred required coverage, hostile markup escaped in all prose fields.
- Production-browser checks: no request on selection/draft check/offline comparison;
  disabled live control; bodyless demo load; failed reload clears prior success;
  cancel/stale-mode result handling; rate-limit countdown; hostile markup cannot execute;
  no browser storage/exceptions; responsive layouts and native controls.

Automated axe A/AA checks pass for the explorer and `/fit` main content. A full `/fit`
scan also flags pre-existing shared sidebar badge/Account-label contrast; those files
remain untouched for PR #45. Manual screen-reader verification is still pending.

Only synthetic data was used. Lint, typegen, TypeScript, 101 tests and production build
passed. Audit has no high/critical findings; nine existing moderate development-tool
advisories remain. No live model call was made.

## Unverified and future activation

The client lock is not server authorization. Direct-backend exposure and SECURITY.md
launch gates remain in effect. PR #38's reviewed backend security work is now merged;
obtain separate explicit authorization before adding live fetch. Re-review provider disclosure/consent/retention,
shared abuse limits, cost controls, server provenance and actual model adversarial behavior
(#23 / #24). Manual screen-reader verification and an independent review of this frontend
remain pending; backend independent review does not establish frontend review.

## PR #38 synchronization addendum (2026-11-15)

Merged main `ffc072be` without changing the incoming backend/security implementation.
No browser request path, gate, labeling, storage or data flow changed. The contract keeps
its v0.1 request/analysis/error shapes. Four added tests check actual handler/client demo
compatibility, prepared-draft compatibility with the default-off 503, empty grounded advice
and structured 429 handling. The provider boundary is mocked, including for the in-process
handler checks, so these tests cannot invoke AWS.

Lint, route typegen, TypeScript, **212 tests / 16 files**, production build and the
high/critical audit threshold passed. Nine existing moderate dev-tool advisories remain.
Production-browser checks at 320/390/768/1440 px confirmed explicit bodyless demo loading,
no draft submission, disabled live UI, validation/focus, filters, offline comparison and
no storage/cookies/overflow/page exceptions. Mocked 503/502/429/network/wrong-mode/hostile
prose/empty-advice and cancellation/stale-result checks passed. The actual loopback server,
started with live explicitly off, returned 503 for valid synthetic input without AWS and
400 for malformed JSON. Accessibility was not re-audited in this synchronization.

The owner's single prior synthetic Nova Lite success is documented in main's backend
notes, not re-executed here. Per-process budgets do not establish distributed protection,
authorization, provider-retention policy or semantic truth. No live call, IAM/credential
change, deployment or public access was made. See the
[future live-analysis PR plan](../FIT_INSIGHTS_LIVE_PLAN.md) for required implementation
and privacy/access decisions before enabling real input submission.
