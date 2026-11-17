# ScaleMe Rust resume parser

This Rust crate and executable extracts readable text and basic section structure from **text-based PDF resumes**. It was built for ScaleMe at SunHacks 2026 and is integrated with the Next.js Resume Lab upload handler.

**Implemented:** an offline Rust parser with a v0.1 JSON resume contract, unit/integration tests, and an explicit Next.js subprocess integration. **Not included:** OCR, AI-based parsing, requirement matching, network calls, storage, or a production-approved public upload service.

## How it fits into ScaleMe

1. An explicitly authorized Resume Lab upload reaches the [Next.js parse route](../../web/src/app/api/resume/parse/route.ts).
2. The Node handler checks file type/size and demo availability, then starts the Rust executable without a shell.
3. The PDF is passed on standard input. The parser extracts text, detects sections where possible, and returns JSON on standard output.
4. The Next.js server validates the contract and returns the result for browser-side review and local improvement.

The HTTP upload feature is **disabled by default** and is gated by owner-controlled configuration and an expiration time. No automatic AWS/Bedrock call occurs. See [public-demo controls](../../docs/PUBLIC_PDF_DEMO.md) and [upload integration](../../docs/RESUME_UPLOAD_INTEGRATION.md).

## Run the parser

From the repository root:

~~~bash
cargo test --manifest-path services/resume-parser/Cargo.toml --locked
cargo build --manifest-path services/resume-parser/Cargo.toml --locked --release
~~~

For a deliberately fictional, text-based PDF:

~~~bash
services/resume-parser/target/release/resume-parser --pretty < synthetic-resume.pdf
~~~

The command reads PDF bytes from standard input and produces the structured JSON envelope on standard output. On Windows, use the corresponding executable in target/release.

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Parsed successfully |
| 1 | Input rejected; a structured API error is returned |
| 2 | Usage or I/O failure |
| 3 | Parse time budget exceeded |
| Other | Process aborted or another unexpected failure |

Tests generate synthetic PDF fixtures in memory rather than committing real resumes.

## Design and limits

- Handles text-based PDFs; **no OCR** for scanned/image-only pages.
- Applies document size/page/text and processing constraints; oversized text is rejected, not silently truncated.
- Does not rewrite or infer achievements, follow PDF links, or send document content to a remote AI service.
- Uses a reviewed, pinned PDF library dependency and serializes a shared JSON contract.
- Processes untrusted files and has known parsing/security limitations; do **not** use real candidate data without further review.

For the library comparison, detailed limits, layout heuristics, error codes, and known caveats, see [resume ingestion design](../../docs/RESUME_INGESTION.md). For the broader product, return to the [ScaleMe README](../../README.md).
