# resume-parser

Rust program and library for ScaleMe Issue #4. It turns one **text-based PDF resume** into the v0.1 `Resume` JSON contract. No AI, no OCR, no network, no storage.

**Status:** standalone and tested with synthetic PDFs only. It is not connected to the web app.

Everything else is in [`docs/RESUME_INGESTION.md`](../../docs/RESUME_INGESTION.md): the library comparison, architecture, supported layouts, known limitations, error codes, limits and security notes.

```bash
# from the repository root
cargo test  --manifest-path services/resume-parser/Cargo.toml --locked
cargo build --manifest-path services/resume-parser/Cargo.toml --locked --release

# PDF on standard input, JSON on standard output (synthetic input only)
services/resume-parser/target/release/resume-parser --pretty < synthetic-resume.pdf
```

Exit status: `0` parsed, `1` document rejected (an `ApiError` is printed), `2` usage or I/O problem, `3` time budget exceeded. Any other status means the process was aborted, for example because the heap budget was exceeded.

Do not commit PDF files here. The tests build their PDFs in memory from fictional text (`tests/support/`).
