# Private resume upload integration

Branch: `feat/resume-upload-integration`; follow-up to Issue #4 / merged PR #50.
This adds a private, synthetic-data-only upload preview. **Not approved for public applicant uploads.**

## User journey and shared data

1. Visit `/resume-lab`, select a text-based PDF, enter the privately distributed upload access code, and explicitly choose **Extract resume**.
2. The browser posts multipart `file` to `/api/resume/parse`. The Node backend validates access and bounds the body, then pipes PDF bytes to the Rust executable's stdin. Its validated response remains `{ resume: Resume }` from the existing v0.1 contract.
3. Review expandable detected sections and readable full text; JSON is secondary technical detail.
4. Choose **Improve my resume** in the same workspace. The existing ImpactLab component receives the validated Resume and imports its exact, read-only text automatically. Add a target job, review its requirement inventory/importance, assess locally, select an original experience and target requirement, answer a clarification, then inspect exact supporting statements. Both statements must be candidate-confirmed before copying the extractive suggestion. No repasting or route handoff is needed. Vague/unsupported/contradictory statements cannot create copyable achievements; confirmation is not independent verification.
5. Switch between review and improvement without losing the job, pending answer or evidence review. **Reset improvement** requires an explicit discard confirmation, clears job/answers/reviews/proposals and keeps the imported source. Clearing/replacing the Resume destroys its keyed improvement workspace, preventing stale improvements from carrying to a different resume. Users without a PDF can explicitly choose **Use pasted resume text**, using the same engine; fictional samples remain opt-in and labeled.
6. **Open Fit Explorer** navigates to its existing text-prefilled draft; live analysis remains intentionally disabled. The dashboard reads the same tab-memory session through a client-only overlay: resume-ready status plus review/improve/Fit actions, without mutating the pure server snapshot or fictional fixture. In sample mode, actual tab resume status is visibly separate from the fictional profile. No scores, goals or job matches are inferred from extraction.
7. Clear the resume in Resume Lab, or reload/close the tab, to remove its handoff and restore the normal guest dashboard. No localStorage, sessionStorage, cookies, database or server resume cache is used. Upload, local improvement and navigation neither call AI nor change the team's live-access policy.

Future interview integration can import `useActiveResume` from `web/src/lib/resume/active-resume.ts` in a client component, then pass that object through the agreed interview contract after a separate explicit consent step. This PR does not edit interview/Bedrock implementation or introduce another resume format.

### Product workspace and onboarding follow-up

Resume Lab is the canonical sidebar/mobile/dashboard resume destination (`/resume-lab`). Its shared-brand cards show a file picker/drop area, filename/size, explicit extraction, indeterminate processing/cancel, fixed safe errors, successful section/full-text review, and clear/replace actions. Native details, labeled inputs, visible focus and status announcements support keyboard use; motion respects reduced-motion preferences. Private access is explained as an owner-provided preview code, not a user password. Selecting a file alone never uploads it.

The four-step onboarding flow reuses the same upload controls/controller/client/session. Local selection survives forward/back navigation; explicit extraction publishes the same Resume JSON. **Enter in the access-code field extracts, never advances onboarding**; missing code uses the normal explanatory error, and loading/repeat/composition do not double-submit. Other fields retain their normal Enter/Continue behavior. Skip/removal/replacement clears stale parsed state; cancellation, timeout, unmount and superseded validation/transport results cannot publish a late success. The completion screen links to Resume Lab and, when parsed, Fit Explorer. Ordinary visitors may continue without uploading anything.

`/impact-lab` is **retained only for compatibility**, with a link back to canonical Resume Lab and no separate primary navigation entry. Existing bookmarks, standalone regression fixtures and contextual completion's component import remain valid. All primary dashboard/Fit resume CTAs now point at Resume Lab. The same component accepts `initialResume`, `embedded` and `integrated` for the complete local workflow; the contextual `initialWorkspace` + `embedded` review-only behavior is unchanged. The owner explicitly transferred #51 integration ownership; its open status is no longer a blocker, and no blanket PR merge or second engine was needed. The fixed mock interview remains independent of the uploaded resume. #61/#62/#63 remain deferred.

Coordination notices were posted on #51 and #60. The final pass adds only a narrow DashboardView client status/overlay, canonical resume CTA content and the existing session hook; no dashboard layout/style or shared primitive rewrite. Preserve #60's visual polish and compose these narrow state/content changes when resolving eventual overlap. Neither PR was merged here.

## Coordination

Coordination notices were posted on PRs #46 (Fit Explorer), #53 (navigation/copy), and #54 (contextual interview) before editing. While this work was in progress, #53, branding #56 and combined contextual/fit work #57 landed on main. They were merged **into this feature branch**, leaving local main unchanged. The final handoff reuses the team's FitExplorer (a small optional uploadedResume prop), preserves its Suspense boundary and disabled live-AI controls, and seeds its existing draft. The upload page replaces its obsolete placeholder while retaining the sample-story link. Shared components/styles, root layout and all AI/interview implementations are preserved.

Shared edits: `web/next.config.ts` adds standalone output, `.github/workflows/ci.yml` adds a container smoke job, `web/.env.example` adds names, and API/security docs describe this boundary. Web package manifests/lockfile and existing ResumeSchema are unchanged.

## Local configuration

Build the existing binary from repository root:

```bash
cargo build --manifest-path services/resume-parser/Cargo.toml --locked --release
```

Run the web app from `web/`, with these **server-only** settings in your local environment (actual secrets must never be committed or logged):

- `RESUME_UPLOAD_ENABLED`: exactly `true` to enable the private preview; unset/anything else denies every request with 503.
- `RESUME_UPLOAD_TOKEN`: a privately generated access code of 32–4096 characters. Missing/short configuration also denies uploads. Enter the code manually in Resume Lab; it is never embedded in a client bundle or URL. Rotate after testing.
- `RESUME_UPLOAD_ORIGIN`: exact browser origin, e.g. local `http://localhost:3000`, no trailing slash. Default is localhost:3000. Cross-origin browser requests are rejected; authenticated CLI requests without Origin are allowed.
- `RESUME_PARSER_PATH`: optional absolute executable path. Default resolves `../services/resume-parser/target/release/resume-parser` relative to the web working directory (`.exe` on Windows). Docker sets `/usr/local/bin/resume-parser`.

No AWS configuration is needed to extract PDFs. Live Fit analysis still requires the team's existing, separately reviewed AI settings/access. No real applicant data or live AWS calls are used by these integration tests.

### Owner: create a local private test configuration

From `web/`, the following Node command creates a **new** ignored `.env.local` with a cryptographically random code. It prints no secret and refuses to overwrite an existing file (including any existing developer settings). If that file already exists, the owner must privately add/update these names using their editor or secret manager; do not paste its contents into logs, chats or PRs.

```bash
node --input-type=module -e 'import {randomBytes} from "node:crypto"; import {writeFileSync} from "node:fs"; writeFileSync(".env.local", ["RESUME_UPLOAD_ENABLED=true", "RESUME_UPLOAD_TOKEN="+randomBytes(32).toString("hex"), "RESUME_UPLOAD_ORIGIN=http://localhost:3000", ""].join("\n"), {flag:"wx",mode:0o600});'
npm run dev
```

Build Rust first using the command above. On PowerShell, use `npm.cmd` if script policy blocks `npm`. The owner reads the generated code privately in their local editor and provides it only to authorized synthetic-data testers through an agreed private channel. Never add `NEXT_PUBLIC_`, put the code in a URL, log it, commit the file, or enable public uploads. Use the exact origin/port shown in the browser; restart Next.js after editing configuration. Rotate/remove the preview code and disable uploads when testing ends. This setup belongs in developer docs, not the product interface.

### Repeatable browser checks

With a local production server, release Rust binary, private synthetic test code in the smoke process's `RESUME_UPLOAD_TOKEN`, and Chromium available:

```bash
SCALEME_SMOKE_URL=http://localhost:3000 CHROMIUM_PATH=/path/to/chrome node web/scripts/resume-workspace-smoke.mjs
```

PowerShell uses `$env:NAME` assignments instead. The script generates its synthetic PDF in its temporary browser profile and cleans that exact generated directory after exit. Optional `SCALEME_SCREENSHOT_DIR` selects an ignored output directory. It tests actual file input events and HTTP extraction, dashboard/client navigation, Fit prefill, review/clear/replace, onboarding select/back/continue/skip/remove/complete, processing cancellation, mobile overflow, keyboard focus and reload isolation. It asserts no AI/external requests or browser storage. Cancellation transport is deliberately stalled in the browser; actual process cancellation/timeouts remain covered by server tests. A passed API smoke alone never counts as browser verification.

Alternatively, after building the web app, run `node scripts/run-resume-workspace-smoke.mjs` from `web/` with `CHROMIUM_PATH` set and the existing Rust executable available. This starts a loopback-only production server on port 3191, generates an ephemeral private code without printing it or editing `.env.local`, and runs **one focused Chromium scenario** (`resume-final-smoke.mjs`): real PDF extraction → imported local evidence → confirmed copy/revocation → dashboard ready/clear/reload → onboarding Enter → interview compatibility. The script uses a temporary synthetic PDF/profile, cleans it afterward, and may write screenshots only to an explicitly selected ignored web output directory. It does not build/test/change Rust. Older suites remain opt-in CLI arguments, not automatically repeated.

## HTTP and process controls

- Access checked **before body read**: off by default, SHA-256/timing-safe comparison of a required Bearer code, origin/fetch-site checks. This is a shared private-preview code, **not user authentication**. Keep the deployment network-private/access-restricted too.
- Per Node process: **one active upload/child** and at most **six authenticated admissions/minute**; excess is rejected with 429/Retry-After. Numeric counters only; not distributed and not per-user fairness. No applicant payload or IP is retained by the limiter.
- Whole multipart stream capped at **5 MiB + 64 KiB** (including multipart overhead), regardless of Content-Length. Fixed-size input buffer avoids unbounded chunk-array overhead. Body read deadline **10 seconds**, including stalled chunked streams; caller abort cancels the reader without waiting for a hostile cancel callback.
- Exactly one `file` part and no other fields. File maximum **5 MiB**; nonempty PDF header at byte zero; Rust validates actual structure, 20 pages and 30,000 UTF-16 text limit. Filename/MIME claims are not trusted. Only a sanitized basename is echoed as display metadata; no filename/path is sent to the executable.
- `spawn` with **shell:false**, trusted absolute binary path and fixed flags. Minimal child environment excludes AWS credentials, access codes, HOME and unrelated application secrets. No temporary files or `--input/--output` paths.
- Rust parse deadline **10 seconds**, counted heap **256 MiB**; independent parent timer **12 seconds from spawn through output/close** covers blocked child stdin/stdout. Output max **512 KiB**. Abort, timeout or excess output sends SIGKILL. Capacity stays occupied until actual child close; failed termination leaves the process busy (fail closed).
- Child stderr is discarded, output schema-validated, and arbitrary child messages are never echoed. All HTTP responses are no-store, fixed safe messages. No PDF, filename, token, stdout or raw exceptions are logged by the integration.

| HTTP | Existing error code | Cause |
| --- | --- | --- |
| 401/403 | PARSING_FAILED | Private access/origin denied |
| 408 | PARSING_FAILED | Input read deadline or caller cancellation |
| 413 | FILE_TOO_LARGE | Multipart/file/page/text limit |
| 415 | INVALID_FILE_TYPE | Missing/duplicate fields, empty/non-PDF content, malformed multipart |
| 422 | NO_EXTRACTABLE_TEXT / PARSING_FAILED | Scanned, corrupt, encrypted or unsupported PDF |
| 429 | PARSING_FAILED | Private process-local capacity/rate budget |
| 502 | PARSING_FAILED | Invalid/excess child output or unexpected child termination |
| 503 | PARSING_FAILED | Disabled/misconfigured preview or unavailable binary |
| 504 | PARSING_FAILED | Parser deadline exceeded |

The ApiError shape and four parser codes are preserved. No raw library error text is returned. Proxy/platform request limits and timeouts may reject requests earlier.

## Linux Docker / Railway preparation

Build from repository root: `docker build -t scaleme-resume .`. The multi-stage Dockerfile compiles the Rust binary and standalone Next app against compatible Debian bookworm bases, includes static/public assets, runs as the existing unprivileged `node` user, and disables core dumps in the static entrypoint. It honors the host's PORT. No environment files, build caches or applicant data enter the image. Uploads default to disabled in the runtime image.

Railway can use this root Dockerfile. No Railway resources/settings have been created or deployed. Keep uploads disabled until review; use private networking/access restrictions, explicitly configure the allowed HTTPS origin and private access code, and set container memory/CPU/process limits. Do not expose a shared-code prototype as a public upload service. Never give the parser unnecessary credentials/privileges or mount a persistent upload volume.

Railway references: [Dockerfile builds](https://docs.railway.com/builds/dockerfiles), [private networking](https://docs.railway.com/networking/private-networking). Hosting configuration/access controls must still be reviewed by the deployment owner.

CI runs `node web/scripts/docker-resume-smoke.mjs`: builds the image, checks non-root/default-disabled configuration, starts a loopback-only **read-only** container with a temporary /tmp, 768 MiB memory, 2 CPUs, 128 PID cap, no capabilities, no-new-privileges and core limit zero, then exercises actual HTTP → Linux executable → Resume JSON using an in-memory synthetic PDF. It checks denied access, corrupted/renamed/oversized PDFs, no-store responses, unchanged container filesystem and absence of canaries in stdout/stderr. Test access codes are generated per run, never printed; test containers are removed.

## Verification commands

For the **frontend-only final integration pass**, use the existing prebuilt Rust executable for the actual upload scenario. Do **not** run local Cargo format/Clippy/tests/release builds or modify `services/resume-parser/`. The existing GitHub Rust/container CI remains unchanged. No dependency install/audit was repeated locally because manifests and lockfiles are unchanged; CI retains both.

Final pass commands from `web/` (PowerShell uses `npm.cmd`):

```text
npm exec -- vitest run src/lib/resume/final-integration.test.ts src/lib/resume/workspace.test.ts src/lib/dashboard/snapshot.test.ts
npm run test --if-present
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm run build
node scripts/run-resume-workspace-smoke.mjs
```

Final-pass results: **26 focused tests / 3 files**, **489 total Web tests / 32 files** (focused tests are included, not extra), lint clean, route types/TypeScript clean, production build **23 pages**. One React props-inference error in the new component tests was corrected and only TypeScript was rerun. The focused browser driver required two corrections (explicit requirement selection before revocation, and treating the dashboard destination as a link); only the failed browser check was rerun. No assertions or product security controls were weakened.

The final Chromium run passed using actual PDF extraction with the **existing executable**, then the existing local ledger: imported source → job inventory → assessment → clarification → exact-source proposal → both confirmations → clipboard. It also demonstrated contradiction revocation, retained job/pending answer between stages, route-return retention, explicit reset/keep-working, clearing/replacing stale improvement state, separate real/demo dashboard status, clear/reload to guest state, real access-code Enter events with missing/valid codes and exactly one submission, normal Enter on another onboarding step, desktop/390/320px layouts, keyboard confirmation and mock-interview interaction/contextual-page compatibility. No external/AI requests, browser storage writes or runtime errors were observed. Screenshots were inspected under ignored `web/.next/resume-final-screenshots/`; nothing under the Rust service was changed. Full live contextual-model behavior remains outside this frontend pass and is not claimed.

Existing Rust/Web checks remain required (CONTRIBUTING.md). From `web/`:

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm run test --if-present
npm exec -- vitest run --config vitest.resume.config.mts
npm run build
```

The explicit integration suite requires the built binary and fails if it is absent; it is never silently skipped. Unit tests exercise auth/gates, malformed/oversized/stalled input, rate/concurrency, child timeout/abort/crash/output limits, privacy, session isolation and client Fit payloads. Linux Docker CI is the actual packaging/HTTP test. Local Docker execution requires a Docker daemon; results and any unavailable checks must be reported accurately in the draft PR.

## Earlier local verification record (2026-11-15, before final integration pass)

On the product/onboarding follow-up from remote main `8a95366`, Windows GNU Rust checks passed (fmt, Clippy, **96 tests**, release build). Web npm ci/audit (10 existing moderate tooling advisories, no high/critical), lint with no warnings, typegen, TypeScript, **478 tests / 31 files**, **one explicit real-binary integration test**, and production standalone build (**23 pages**) passed. Package manifests/lockfile are unchanged. A stale generated `.next` cache initially caused a Turbopack CSS worker startup panic; removing only that verified generated directory fixed the normal production build, without source/config changes or relaxed checks.

The production Chromium suite (`node scripts/run-resume-workspace-smoke.mjs`, Node 22.23.5, Chrome on Windows) passed: actual synthetic file-input → HTTP → Rust → section/text review → client-side Fit prefill → clear; keyboard expansion/focus, drop without upload, oversize/renamed rejection, wrong/missing code, mobile sidebar destination, 320/390px reflow, four-step onboarding forward/back/local selection/parse/remove/replace/skip/completion and clearing an actually parsed resume on reload. Storage-write instrumentation spans navigation; no AI, external requests, browser storage or runtime errors were observed. Disabled-preview and stalled/cancel UI transport are simulated in this browser suite; real backend gate/timeout/cancellation checks remain in the unit/integration suite.

The existing `evidence-ledger-smoke.mjs` and `contextual-impact-smoke.mjs` both passed against the same production build; the latter mocks AI transport, never live AWS. Desktop/mobile screenshots were visually inspected and remain in ignored `services/resume-parser/target/resume-workspace-screenshots/`. Safari/Firefox, real devices, actual browser zoom, manual screen-reader review, Railway deployment, real resumes and live Bedrock remain unverified. Local Docker is unavailable; the existing Linux container CI is the packaging/HTTP gate and must pass again for the final PR head.

## Remaining security and product limits

This is not a security audit or OS sandbox. Native multipart decoding happens in memory after a bounded read; external ingress limits, concurrency and host memory limits remain necessary. Parent timers cannot run if Node's event loop is starved. Rust's counted allocator excludes thread stacks/OS mappings; Docker limits bound the whole container, not only one parser. Windows kill/RSS/crash-reporting behavior differs; configure WER and host policies before private data.

The parser's existing limitations remain: `ttf-parser` is unmaintained (RUSTSEC-2026-0192); compressed bombs, embedded fonts, deep recursion, AES and representative real exporter PDFs are unverified. Owner-restricted PDFs that open without a password are accepted. Hidden/instruction-like text remains untrusted data. Two-column heuristics are best-effort; no OCR. No real AWS model resistance, distributed rate limiting, real-applicant/privacy consent policy, auth accounts, persistent resume storage or contextual interview integration is verified by these tests. See RESUME_INGESTION.md and the security threat model.
