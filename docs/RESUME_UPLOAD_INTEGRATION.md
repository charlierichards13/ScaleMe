# Private resume upload integration

Branch: `feat/resume-upload-integration`; follow-up to Issue #4 / merged PR #50.
This adds a private, synthetic-data-only upload preview. **Not approved for public applicant uploads.**

## User journey and shared data

1. Visit `/resume-lab`, select a text-based PDF, enter the privately distributed upload access code, and explicitly choose **Extract resume**.
2. The browser posts multipart `file` to `/api/resume/parse`. The Node backend validates access and bounds the body, then pipes PDF bytes to the Rust executable's stdin. Its validated response remains `{ resume: Resume }` from the existing v0.1 contract.
3. Review extracted text/JSON. **Use this resume in Fit Explorer** navigates to `/fit-insights` with the same validated Resume in tab memory.
4. The team's existing Fit Explorer opens with extracted text already in its editable resume draft. Enter a job title/description and use its existing input checks. Its live-AI button remains intentionally disabled; its fictional demonstrations remain separately labeled. Upload/import neither calls AI nor changes the team's live-access policy. This PR connects actual parsed input to the existing explorer rather than introducing another analysis form.
5. Clear the resume in Resume Lab, or reload/close the tab, to remove its in-memory handoff. No localStorage, sessionStorage, cookies, database or server resume cache is used. Client-side navigation preserves the tab's module; a hard reload deliberately clears it.

Future interview integration can import `useActiveResume` from `web/src/lib/resume/active-resume.ts` in a client component, then pass that object through the agreed interview contract after a separate explicit consent step. This PR does not edit interview/Bedrock implementation or introduce another resume format.

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

## Local verification record (2026-11-15)

After incorporating remote main through `8a95366`, Windows GNU Rust checks passed (fmt, Clippy, **96 tests**, release build). Web npm ci/audit (10 existing moderate tooling advisories, no high/critical), lint, typegen, TypeScript, **460 tests / 29 files**, the explicit real-binary integration test, and production standalone build (**23 pages**) passed. The unchanged lockfile was installed before the frontend-base merge; that merge added no package dependency changes.

The live loopback Next HTTP smoke passed for synthetic valid/corrupt/renamed/oversized PDFs and denied access. Browser inspection confirmed the form and disclosure render; file-picker automation stalled, so a browser click-through upload/navigation test is **not claimed as verified**. The existing explorer's imported textarea, escaping and disabled live-AI state have automated render coverage. Local Docker was unavailable; the draft PR's Linux container CI is the packaging/HTTP verification gate. Actual Railway deployment, real resumes and live Bedrock were not run.

## Remaining security and product limits

This is not a security audit or OS sandbox. Native multipart decoding happens in memory after a bounded read; external ingress limits, concurrency and host memory limits remain necessary. Parent timers cannot run if Node's event loop is starved. Rust's counted allocator excludes thread stacks/OS mappings; Docker limits bound the whole container, not only one parser. Windows kill/RSS/crash-reporting behavior differs; configure WER and host policies before private data.

The parser's existing limitations remain: `ttf-parser` is unmaintained (RUSTSEC-2026-0192); compressed bombs, embedded fonts, deep recursion, AES and representative real exporter PDFs are unverified. Owner-restricted PDFs that open without a password are accepted. Hidden/instruction-like text remains untrusted data. Two-column heuristics are best-effort; no OCR. No real AWS model resistance, distributed rate limiting, real-applicant/privacy consent policy, auth accounts, persistent resume storage or contextual interview integration is verified by these tests. See RESUME_INGESTION.md and the security threat model.
