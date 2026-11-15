# ScaleMe limited-time public PDF demo

This is a deliberately temporary, **unauthenticated** upload preview for SunHacks judging. It is **not** approved for real applicant resumes, and the Rust parser has not completed a comprehensive security audit. Keep the demo brief, do not invite sensitive uploads, and disable uploads immediately afterward.

## Deployment prerequisites

1. Merge the Resume Lab feature (PR #59) with this public-demo change.
2. In Railway, deploy from the **repository root** (`/`) using the root `Dockerfile`; the existing `/web`-only Railpack build does **not** contain the Rust executable.
3. Configure only server-side variables on the Next.js service:

| Variable | Value |
| --- | --- |
| `RESUME_UPLOAD_ENABLED` | `true` to opt into public parsing; `false` to turn it off |
| `RESUME_UPLOAD_EXPIRES_AT` | An absolute future cutoff with explicit timezone, e.g. `2026-11-15T16:00:00-07:00` |
| `RESUME_UPLOAD_ORIGIN` | Exact public HTTPS origin (e.g. `https://your-service.up.railway.app`), without trailing slash |
| `RESUME_PARSER_PATH` | `/usr/local/bin/resume-parser` (already set in Docker image) |

No `RESUME_UPLOAD_TOKEN`, private upload code, AWS credential, or browser secret is needed for PDF parsing. **Do not disable separate authentication for paid Bedrock AI routes.**

The route fails closed with HTTP 503 if `RESUME_UPLOAD_ENABLED` is not exactly `true`, the expiration is missing/malformed/expired, or the Rust parser is unavailable. Set the expiration to cover judging only. Use Railway's variables to turn `RESUME_UPLOAD_ENABLED=false` immediately when finished; the expiration is an additional cutoff, not a replacement for rollback.

## Safeguards retained

- Only a valid, text-based PDF: up to 5 MiB; up to 20 pages; maximum 30,000 UTF-16 characters.
- Bound multipart stream to 5 MiB + 64 KiB; 10-second body read; 10-second Rust parse; independent 12-second subprocess lifetime; 256 MiB Rust counted heap; 512 KiB parser output.
- One active parser process per Node instance; six upload admissions per rolling minute per process. Limits are **not** distributed or per-user, and are not reliable defenses against a determined public attacker.
- Same-origin browser checks; no permanent file storage, database, cookies, browser storage, request-body logs, or automatic AI calls.
- No private bearer code is sent by the frontend. Upload happens only on the explicit **Extract resume** click. A successful extraction is reviewed locally before moving to Fit Explorer.

## Judging and rollback

1. Deploy, verify `/resume-lab` is reachable, and upload an intentionally synthetic text-based PDF.
2. Confirm a successful section/text review and that `Open Fit Explorer` prefills the resume field without invoking Bedrock.
3. Reject renamed non-PDFs, oversized PDFs, scanned/unsupported PDFs, and cross-origin requests.
4. Check deployed service memory/CPU and logs during the demo; ensure one replica, bounded resources, and the correct HTTPS origin.
5. After judging, set `RESUME_UPLOAD_ENABLED=false`. HTTP upload must return 503; optionally redeploy and rotate any unrelated AI access credentials only if exposed.

**Caution:** A $20 AWS spending limit does not limit Railway CPU/memory/network usage or protect unauthenticated PDF parsing. The parser currently has unverified file classes and a dependency flagged as unmaintained. Do not market this temporary endpoint as production-secure or process authentic applicant data without further hardening and privacy review.
