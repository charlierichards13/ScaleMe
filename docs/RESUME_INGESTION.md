# Issue #4 — PDF resume ingestion and JSON parser

**Status:** parser implemented as a standalone Rust program in `services/resume-parser/`, tested with **synthetic PDFs only**. It is **not connected** to any HTTP route, upload screen or UI. `POST /api/resume/parse` is still a proposal. Nothing here has been tried on real resumes, independently reviewed, or run on Linux outside CI.

**Owner:** @MisterProper667
**Branch:** `feat/resume-ingestion`
**Issue:** [#4 — Parse PDF resumes safely](https://github.com/charlierichards13/ScaleMe/issues/4)

## What it does

`resume-parser` reads one text-based PDF and prints the v0.1 `Resume` JSON from [`docs/api-contract.md`](api-contract.md):

```text
PDF bytes ──► resume-parser (Rust, one short-lived process per document) ──► { "resume": Resume }  or  ApiError
```

- **Deterministic.** No LLM, no OCR, no network, no stored state. The same PDF always gives the same text and sections.
- **Truthful.** Text is extracted, put in reading order and whitespace-normalized. Nothing is rewritten, inferred or invented. Over-limit text is rejected, never cut.
- **Defensive.** The PDF is untrusted input: size, signature, page and text limits; a time budget and a heap budget enforced at the process level; content-free errors.

### Architecture decision: Rust, not TypeScript

The first version of this document proposed a TypeScript module under `web/src/lib/resume/`. The team decided to do PDF extraction and structuring in **Rust** instead. Reasons:

- PDF parsing is the riskiest code on the upload path. A separate process can be killed on a timeout and capped in memory, which an in-process Node library cannot guarantee.
- It keeps a large PDF dependency tree out of `web/package.json` and the Next.js bundle.
- It follows the JSON boundary already planned for the Rust matcher in the API contract.

Nothing was added to `web/package.json`. The only web change is one test file (see [Contract compatibility](#contract-compatibility)).

## Library comparison

Two Rust crates were compared by the original implementing agent on 2026-11-15 in a throwaway crate outside the repository, using the synthetic fixtures in `services/resume-parser/tests/support/`. The comparison dependencies were never added to the repo. The measurements below are that agent's historical results; the continuation review re-runs the committed parser tests, not the external comparison harness.

| | `pdf-inspector` 1.25.2 | `pdf_oxide` 0.3.78 |
| --- | --- | --- |
| Publisher / license | Firecrawl, MIT | single maintainer, MIT or Apache-2.0 |
| First release / latest | 2026-06 / 1.26.0 on 2026-11-14 | 2025-11 / 0.3.78 on 2026-09-08 |
| Built on | `lopdf` 0.45 | own parser |
| Source size | about 137,000 lines plus `lopdf` | about 452,000 lines (also writes, edits, signs and converts PDFs) |
| Crates in its dependency tree (Linux) | 87 | 141 |
| In-memory API | yes | yes |
| Positioned text with font size and bold | yes (`TextItem`) | yes (`TextSpan`) |
| Known advisories (OSV, 2026-11-15) | none for the crate; `lopdf` had a stack-overflow advisory fixed in 0.42 (0.45 is used) | none |

**Measured on the synthetic fixtures** (release build, one run each, Windows; times are indicative only):

| Check | `pdf-inspector` | `pdf_oxide` |
| --- | --- | --- |
| Text recovered from positioned fragments, all 11 valid fixtures | every drawn line | every drawn line |
| Words positioned one by one, no space glyphs | spaces recovered | spaces recovered |
| Kerned `TJ` arrays | correct | correct |
| CJK, Greek, symbols, emoji through a ToUnicode font | correct | correct in spans; its plain-text mode dropped the space after the CJK run |
| Built-in reading order, two columns | Markdown mode merged the two columns row by row; plain mode follows content-stream order | plain mode separated the columns |
| Built-in reading order, right-aligned dates | plain mode keeps content order | column-aware mode moved every date to the end of the page, away from its job |
| Bullets | kept in fragments; Markdown mode rewrote them as `-` | kept in fragments; Markdown mode rewrote them as `-` |
| Truncated file | `InvalidStructure` error | opened "successfully" with one page and no text |
| Password-protected file | `Encrypted` error | opened; needs a separate `is_authenticated()` check |
| Image-only file | reported as scanned, no text | no text |
| 30,000 randomly damaged PDFs | 0 panics, slowest 2 ms | **11 panics**, slowest 4 ms |
| Typical one-page parse | about 0.5 to 1 ms, under 300 KiB heap | about 0.5 to 1.3 ms, under 450 KiB heap |

**Findings that shaped the design**

1. **Neither library's own reading order is safe for resumes.** `pdf-inspector`'s Markdown output interleaves columns; `pdf_oxide`'s column detection treats right-aligned dates as a second column and detaches them from their jobs. So the parser takes *positioned fragments* and does its own small, tested line and column assembly (`src/layout.rs`). With that, both libraries give identical text on every fixture.
2. Advertised features did not decide anything. Heading detection, Markdown conversion and "multi-column support" exist in both crates and were not used, because they failed the fixtures above.

**Choice: `pdf-inspector`, pinned to `=1.25.2`, default features only.** With text quality equal, it won on robustness and attack surface: no panics on damaged input, a clear error for truncated files, an explicit `Encrypted` error, a smaller dependency tree, and much less code that is irrelevant to reading text. Its optional OCR, rendering, model-download and Python features (which bring in network and native code) are off, and a test fails if any networking, AI, OCR or second PDF crate enters `Cargo.lock`.

**Costs of this choice, stated plainly**

- The crate is five months old and releases very often. Version 1.26.0 came out the day before this work and was deliberately not adopted; upgrades should be reviewed, not automatic.
- It hard-depends on `env_logger` and `rayon`. The parser never initializes a logger, so nothing is logged.
- `ttf-parser` 0.25.1 (used by both candidate libraries to read embedded fonts) is flagged **unmaintained** by RustSec (`RUSTSEC-2026-0192`, informational, no known vulnerability). It parses attacker-controlled font data, so this is a real residual risk.
- It offers no "is this file encrypted?" query for files it can open (see [Encrypted PDFs](#encrypted-pdfs)).
- The dependency tree is 92 crates on Linux (126 packages in `Cargo.lock` across all platforms). Only `pdf-inspector`, `lopdf` and `ttf-parser` were looked at individually.

## Parser architecture

```text
services/resume-parser/
├── Cargo.toml, Cargo.lock      pinned dependencies (lockfile is committed)
├── src/
│   ├── main.rs        command-line program: bounded I/O, time and heap budgets, exit statuses
│   ├── lib.rs         parse_resume(): the pipeline below, panic containment, contract self-check
│   ├── limits.rs      every limit in one place
│   ├── error.rs       ParseError: stable reasons, contract error codes, fixed messages
│   ├── models.rs      Resume / ResumeSection / envelope; mirrors ResumeSchema limits
│   ├── extract.rs     the ONLY module that calls the PDF library
│   ├── layout.rs      fragments ─► reading-order lines (rows, two columns, spacing)
│   ├── sections.rs    heading detection and section grouping
│   └── deadline.rs    wall-clock budget helper
└── tests/
    ├── support/       in-memory synthetic PDF writer and fixtures (no binary PDFs in Git)
    ├── golden/        real parser output for one synthetic resume (JSON)
    ├── valid_resumes.rs, invalid_inputs.rs, cli.rs, contract.rs, robustness.rs
```

Pipeline in `parse_resume`:

1. **Envelope checks** (no PDF library involved): not empty, at most 5 MiB, `%PDF-x.y` at byte 0.
2. **Structure pass**: page count; encrypted and broken files fail here.
3. **Fragments**: positioned text runs with page, baseline, width, font size and bold flag. Image placeholders, link annotations and form fields are not text runs and are skipped.
4. **Layout** (`layout.rs`): runs on the same baseline become a row; rows become lines; a clear vertical gutter splits a page into two columns.
5. **Text**: lines joined with `\n`. Longer than 30,000 UTF-16 units is an error.
6. **Sections** (`sections.rs`): only when headings are found with enough evidence.
7. **Self-check** against the contract limits, then JSON.

### Whitespace normalization

Runs of whitespace and control characters become one space; each line is trimmed; zero-width space (U+200B) and the byte-order mark are removed; lines are separated by a single `\n`. Nothing else changes: no case folding, no punctuation, ligature or Unicode normalization, no merging of wrapped lines. Blank lines between paragraphs are not kept.

### Heading detection

A keyword is never enough. A line becomes a section heading only if all three hold:

1. **Shape**: 2 to 48 characters, at most 6 words, alone on its line, not a bullet, no sentence-ending punctuation, no digits.
2. **Name**: the *whole* line is a known heading or alias (about 120 of them: `Experience`, `Work Experience`, `Professional Experience`, `Education`, `Academic Background`, `Projects`, `Technical Skills`, `Licenses & Certifications`, `Summary`, `Awards`, `Volunteer Work`, ...). Case, `&`/`and`, a trailing colon and letter-spacing (`E D U C A T I O N`) are ignored.
3. **Layout evidence, at least 2 points**:

| Signal | Points |
| --- | --- |
| Bold while the body text is not | +2 |
| Font at least 10% larger than the body text | +2 |
| ALL CAPS | +2 |
| Title Case (when not all caps) | +1 |
| Clearly more space above than the usual line pitch | +1 |
| Trailing colon | +1 |
| The next line starts with a lower-case letter (a wrapped sentence) | −2 |

So `PROFESSIONAL EXPERIENCE` alone on a line is a heading, `I have experience with Python` is not, and neither is a plain `Leadership` in a one-word-per-line skills list.

**Unknown headings** (for example `Things I Built`) are accepted only when they use exactly the same larger-than-body style as at least two confirmed headings and come after the first confirmed heading.

**Titles**: a line set larger than every heading (usually the candidate's name) ends the section above it. Lines after it belong to no section until the next heading. This keeps a name at the top of a second column out of the sidebar's last section.

**Output rules**

- `sections[].heading` is the candidate's own wording, minus a trailing colon. A *known* heading written in capitals is shown in title case (`EDUCATION` → `Education`), matching the contract example. Unknown headings are never re-cased.
- `sections[].text` is the original lines between two headings, joined with `\n`.
- Lines before the first heading (name, contact details) are in `text` but in no section.
- No heading found, or more than 50 sections: `sections` is **omitted** and `text` carries everything.
- The canonical section kind (`Experience`, `Education`, ...) is known inside the library but is not emitted, because the v0.1 contract has no field for it.

## Supported layouts and known limitations

Every "supported" line below has an automated test; the test file is named.

| Layout | Status | Test |
| --- | --- | --- |
| One column, conventional headings | supported | `valid_resumes.rs::standard_one_column_resume` |
| Text written per line, per word without space glyphs, or with kerned arrays | supported, identical output | `same_resume_written_three_different_ways_gives_identical_output` |
| Two columns with a clear gutter, columns written separately or interleaved | supported: left column, then right | `two_column_resume_reads_each_column_separately` |
| Full-width header (up to 8 rows) above two columns, short footer (up to 2 rows) below | supported | `layout.rs::full_width_header_and_footer_do_not_hide_the_columns` |
| Right-aligned dates on a job row | kept on the row | `bullets_dates_and_wrapped_lines_are_preserved` |
| Multiple pages, a section continuing across pages | supported, up to 20 pages | `multi_page_resume_keeps_a_section_together_across_page_breaks` |
| Alias, mixed-case and unknown headings | supported as described above | `alias_mixed_case_and_unknown_headings` |
| Bullets | kept as extracted (`•` stays `•`) | `bullet_lists_survive_across_three_pages` |
| No recognizable headings | full text, no sections | `resume_without_headings_returns_full_text_and_no_sections` |
| Accents, CJK, Greek, symbols, emoji | extracted unchanged | `unusual_unicode_is_extracted_unchanged` |

**Not supported or not verified**

- **Scanned or image-only PDFs**: rejected with `NO_EXTRACTABLE_TEXT`. No OCR.
- **Three or more columns**: only one gutter is found; the rest is read row by row.
- **Two columns on the same line grid with no known heading on one side** (for example a skills grid): read row by row (`Python Docker`), because it cannot be told apart from a table. All text is kept.
- **Columns that begin below more than 8 full-width rows**, or tables: read row by row.
- **Inline labels** such as `Skills: Python, SQL` do not start a section.
- **Unstyled resumes** with headings in the same font, no capitals, no extra spacing and no colon: no sections, full text only.
- **Company or job-title lines set exactly like the headings** (same larger size and weight) can be taken for unknown headings.
- **Right-to-left scripts** (Arabic, Hebrew): not tested. The library reorders them; correctness is unverified.
- **Rotated text** is kept, each run on its own line after the page's other text. Tested only with hand-built fragments.
- **Repeated page headers or footers** are kept as ordinary lines.
- **Hidden text** (invisible render mode, white on white) is extracted like any other text. Downstream code must keep treating resume text as untrusted.
- **Form-field values and link targets** are not extracted.
- **Hyphenated line breaks** are not rejoined; wrapped lines stay separate lines.
- **Real-world PDFs** (Word, Google Docs, LaTeX, Canva exports) have not been tested. The fixtures are generated by a small PDF writer in the test suite and are simpler than real exports: standard fonts, no compression, no embedded font programs, no tagged structure.

## Interface

### Command line (the documented boundary)

```text
resume-parser [--input PATH] [--output PATH] [--filename NAME] [--id ID]
              [--timeout-ms N] [--max-memory-mib N] [--pretty]
```

| Flag | Meaning |
| --- | --- |
| *(none)* | Read the PDF from standard input, write JSON to standard output. Nothing touches the disk. |
| `--input PATH` | Read from a file instead (must be a regular file). |
| `--output PATH` | Write the JSON to a **new** file. An existing file is never overwritten. |
| `--filename NAME` | Display name for `resume.filename`. Only the base name is kept; it is never used as a path. |
| `--id ID` | Use this opaque id (`A-Z a-z 0-9 . _ -`, 1 to 100 characters). Default: `resume-` plus 128 random bits. |
| `--timeout-ms N` | Time budget, 1 to 60000. Default 10000. |
| `--max-memory-mib N` | Heap budget, 1 to 1024. Default 256. |
| `--pretty` | Indent the JSON. |

| Exit status | Meaning | Standard output |
| --- | --- | --- |
| `0` | Parsed | `{ "resume": ... }` |
| `1` | Document rejected | `{ "error": ... }` |
| `2` | Usage or I/O problem | nothing |
| `3` | Time budget exceeded | `{ "error": ... }` with `PARSING_FAILED` |
| anything else, or killed by a signal | Process aborted, for example the heap budget was exceeded | nothing; treat as `PARSING_FAILED` |

Standard error carries only fixed words: `resume-parser: rejected: <reason>`, a usage hint, `resume-parser: heap budget exceeded`, or Rust's `memory allocation of N bytes failed`. It never contains document text, a file name or a path.

### Example (synthetic)

```bash
resume-parser --id resume-demo-001 --filename synthetic-resume.pdf --pretty < synthetic-resume.pdf
```

Real output for the synthetic one-column fixture (`tests/golden/synthetic-one-column.json`, shortened here to three sections):

```json
{
  "resume": {
    "id": "resume-demo-001",
    "filename": "synthetic-resume.pdf",
    "text": "Jordan Example\njordan.example@example.com | (555) 010-0199 | Example City, EX\nEDUCATION\nExample State University, B.S. Computer Science, May 2026\nRelevant coursework: Data Structures, Databases, Operating Systems\nEXPERIENCE\nSoftware Engineering Intern, Synthetic Systems Co. Jun 2025 – Aug 2025\n• Built an internal scheduling dashboard with Python and SQL.\n• Wrote unit tests for the reporting service.\nPROJECTS\nCampus Events Finder\n• Developed a web app that lists student club events.\nSKILLS\nPython, SQL, Git, TypeScript\nCERTIFICATIONS\nExample Cloud Practitioner (fictional), 2025",
    "sections": [
      {
        "heading": "Education",
        "text": "Example State University, B.S. Computer Science, May 2026\nRelevant coursework: Data Structures, Databases, Operating Systems"
      },
      {
        "heading": "Experience",
        "text": "Software Engineering Intern, Synthetic Systems Co. Jun 2025 – Aug 2025\n• Built an internal scheduling dashboard with Python and SQL.\n• Wrote unit tests for the reporting service."
      },
      {
        "heading": "Skills",
        "text": "Python, SQL, Git, TypeScript"
      }
    ]
  }
}
```

A rejected document (exit status 1):

```json
{ "error": { "code": "NO_EXTRACTABLE_TEXT", "message": "No text could be extracted. Scanned or image-only PDFs are not supported yet.", "retryable": false } }
```

### Rust library

```rust
use resume_parser::{parse_resume, ParseOptions};

let options = ParseOptions::new().with_filename("synthetic-resume.pdf");
let envelope = parse_resume(&pdf_bytes, &options)?; // Result<ResumeEnvelope, ParseError>
```

`parse_resume` has **no** time or memory limit of its own. Untrusted uploads should go through the program.

## Error behavior

Only the four codes already in the API contract are used. No new code was introduced. The finer `reason` is available from the Rust API and on standard error.

| Situation | `reason` | `error.code` | Exit |
| --- | --- | --- | --- |
| No bytes | `empty_file` | `INVALID_FILE_TYPE` | 1 |
| Content does not start with `%PDF-x.y` (whatever the name or MIME type says) | `not_a_pdf` | `INVALID_FILE_TYPE` | 1 |
| More than 5 MiB | `file_too_large` | `FILE_TOO_LARGE` | 1 |
| More than 20 pages | `too_many_pages` | `FILE_TOO_LARGE` | 1 |
| Text longer than 30,000 characters | `text_too_long` | `FILE_TOO_LARGE` | 1 |
| Needs a password to open | `encrypted_pdf` | `PARSING_FAILED` | 1 |
| Damaged or unreadable structure | `corrupted_pdf` | `PARSING_FAILED` | 1 |
| Valid PDF, no text layer | `no_extractable_text` | `NO_EXTRACTABLE_TEXT` | 1 |
| Time budget exceeded | `timeout` | `PARSING_FAILED` | 3 |
| Worker failed to start or panicked, PDF library panicked, or output failed the self-check | `internal_error` | `PARSING_FAILED` | 1 |

All responses retain `retryable: false`; no automatic retry policy is introduced. Messages are fixed strings. Library error text is discarded because it can quote bytes from the document.

The deadline helper returns a typed result: only an expired channel wait produces `timeout`.
Failure to spawn the worker or a disconnected result channel (including an uncaught worker
panic) produces `internal_error`. Neither OS error details nor panic payloads enter the error
response. Regression tests cover completion, expiration, worker panic and injected spawn failure.

**Open question for the team:** `FILE_TOO_LARGE` for "too many pages" and "text too long", and `PARSING_FAILED` for "password-protected", are the closest existing codes, not exact ones. If the frontend needs to tell them apart, dedicated codes should be added to `docs/api-contract.md` first.

## Security and resource limits

Treat this section together with the [threat model](security/THREAT_MODEL.md). "Tested" means an automated test with synthetic input exists. It does not mean audited.

| Control | Value | Where enforced | Tested |
| --- | --- | --- | --- |
| Upload size | 5 MiB | `extract::check_envelope`; standard input is read to the limit plus one byte only | yes |
| Real content check | `%PDF-x.y` at byte 0; name and MIME type are ignored | `extract::check_envelope` | yes |
| Pages | 20 | after the structure pass, before page content is decoded | yes |
| Extracted text | 30,000 UTF-16 units, as Zod counts; rejected, never truncated | `lib::parse_resume` | yes |
| Text fragments | 60,000 runs, 480,000 bytes of raw text | `extract::extract_fragments`, before any layout work | no (not reached by any fixture) |
| Sections | 50, heading 200 characters | `sections`, `models::check_contract` | yes |
| Parse time (after input is read) | 10 s by default | program exits with status 3 | yes |
| Heap | 256 MiB by default | counting allocator; the process aborts | yes |
| Library panics | contained, reported as `PARSING_FAILED` | `catch_unwind` in `parse_resume` | path exists; never triggered in 4,000 damaged inputs |

**Why a separate process.** A thread cannot be stopped from outside in Rust, so an in-process timeout only stops *waiting*. The program therefore runs one document per process: when the deadline passes it exits, which ends the worker; when an allocation would exceed the heap budget the allocator refuses it and the process aborts. A caller should add its own kill timer on the child process as a second line of defense. A server that linked the library directly would lose both guarantees.

**What the heap budget does not cover:** thread stacks (the worker has a 16 MiB stack) and memory the operating system maps outside Rust's allocator. A stack overflow from deeply nested PDF objects would abort the process; it is not caught. For a hosted deployment, also set container or `ulimit` limits.

**Windows/Linux boundary.** The counting allocator and parse deadline use the same Rust code on both platforms; neither is an OS sandbox or an RSS limit. The input read and output write are outside the internal parse deadline, so the caller's independent kill timer must cover the entire child lifetime. Linux core dumps and Windows Error Reporting dumps can retain process memory after an abort; disable those host facilities before processing private data. The parser does not configure host crash-reporting policy. Local continuation checks use Windows GNU; Linux behavior still requires a successful CI run.

**Extreme geometry.** Font sizes are attacker-controlled. Heading comparisons widen integer arithmetic to avoid overflow after a float-to-integer conversion saturates. A regression test exercises extreme finite font sizes; ordinary resume output is unchanged.

**Active content.** The parser only reads text-showing operators. It does not run JavaScript, open or launch anything, follow links or fetch URLs. A test feeds it a PDF with `/OpenAction` JavaScript, a `/Launch` action, a base URI and an instruction-like document title, and checks that none of it reaches the output. A second test checks that no HTTP, TLS, async-runtime, cloud, AI, OCR or rendering crate is in `Cargo.lock`. This shows the parser has no networking dependency; it is not proof that no code path can open a socket.

**Instruction-like text.** A resume line such as "Ignore all previous instructions..." is returned unchanged as text. The parser neither obeys nor removes it. Anything that later sends this text to a model must keep treating it as data, as `/api/fit/analyze` already does.

**Files and paths.** By default nothing is written anywhere. The program never builds a path, a command or a shell string from the file name or document content. `--filename` is echoed after being reduced to a base name. `--output` creates a new file only. A test runs the program with its working and temp directories pointed at an empty folder and checks the folder stays empty.

**Logging.** The parser logs nothing. The PDF library's log calls go nowhere because no logger is installed.

**Privileges.** The program needs no network, no environment variables, no credentials and no write access. Run it as an unprivileged user. Sandboxing (seccomp, a locked-down container, a read-only filesystem) is recommended for deployment and is **not** implemented here.

### Encrypted PDFs

- A PDF that needs a password to **open** is rejected (`encrypted_pdf`).
- A PDF encrypted with an empty user password (it opens in any viewer; only printing or copying is restricted) **is parsed**. The library decrypts it transparently and offers no way to detect that it did. This is a deliberate, documented choice that a reviewer may want to change.

### Residual risks

- Memory-safety or logic bugs in `pdf-inspector`, `lopdf`, `ttf-parser` (unmaintained) or the decompression crates. Rust removes most memory-corruption classes, not denial of service.
- Only RC4 (revision 2) encryption was tested. AES-encrypted files were not.
- No test with compressed streams, a decompression bomb, embedded fonts or deeply nested objects. The heap and time budgets are the defense; they were tested with other inputs.
- The mutation test uses 4,000 damaged variants of seven small synthetic files with a fixed seed. It is a smoke test, not a fuzzing campaign.
- The timeout test relies on a 1 ms budget being too short for a 28,000-character document.
- Hidden text and keyword stuffing pass through.

## Contract compatibility

- Output fields are exactly `id`, `filename?`, `text`, `sections?[{ heading, text }]`. `filename` and `sections` are omitted, not `null`, when absent.
- Limits mirror `ResumeSchema` in `web/src/lib/ai/schemas.ts` and are checked before any JSON is written.
- `services/resume-parser/tests/golden/synthetic-one-column.json` is real parser output. A Rust test fails if the parser stops producing it. `web/src/lib/resume/parser-contract.test.ts` validates the same file against the real Zod `ResumeSchema` and `FitRequestSchema`. That web test is the only file added under `web/`; `web/src/lib/ai/` is unchanged.

## Running and testing

Needs Rust 1.89 or newer: the locked `aes` 0.9.4 dependency requires 1.89, even though `pdf-inspector` itself declares 1.88. The continuation checks used Rust 1.100; the exact minimum toolchain has not been run. From the repository root:

```bash
cargo fmt     --manifest-path services/resume-parser/Cargo.toml --all -- --check
cargo clippy  --manifest-path services/resume-parser/Cargo.toml --locked --all-targets -- -D warnings
cargo test    --manifest-path services/resume-parser/Cargo.toml --locked
cargo build   --manifest-path services/resume-parser/Cargo.toml --locked --release
```

The binary is `services/resume-parser/target/release/resume-parser` (`.exe` on Windows). After an intended output change, refresh the golden file with `UPDATE_GOLDEN=1 cargo test --manifest-path services/resume-parser/Cargo.toml --test contract`, then run the web tests.

CI runs the four commands above in the **Rust quality** job on Linux. The job fails if the crate is missing; it does not skip.

**Windows note.** With the GNU toolchain (`stable-x86_64-pc-windows-gnu`), a transitive dependency (`windows-sys`) needs a working `dlltool` on `PATH`. The one bundled with the toolchain cannot run on its own. Copying the toolchain's `llvm-ar.exe` to a file named `dlltool.exe` in a folder on `PATH` works. The MSVC toolchain and Linux do not need this.

**Fixtures.** No PDF file is committed. `tests/support/pdf_builder.rs` writes small PDFs in memory from fictional text (standard fonts, a ToUnicode font for non-Latin text, image-only pages, real RC4 encryption). Use only synthetic input with the program.

### Continuation verification — 2026-11-15

The existing implementation was preserved and reviewed locally on Windows, using Rust/Cargo 1.100.0 (`x86_64-pc-windows-gnu`), Node 22.23.5 and npm 10.9.9. These checks were run again in the continuation; they are independent of the original agent's test reports.

From the repository root:

```bash
cargo fmt --manifest-path services/resume-parser/Cargo.toml --all -- --check
cargo clippy --manifest-path services/resume-parser/Cargo.toml --locked --all-targets -- -D warnings
cargo test --manifest-path services/resume-parser/Cargo.toml --locked
cargo build --manifest-path services/resume-parser/Cargo.toml --locked --release
```

All exited 0: format and Clippy clean, **94 Rust tests** passed (49 unit, 44 integration, 1 documentation), release build succeeded. The added regression test first reproduced an overflow in heading comparison on extreme font sizes, then passed with widened comparison arithmetic. CLI stdout is now compared with the exact golden JSON that the web test validates against `ResumeSchema`.

From `web/` (Windows uses `npm.cmd`):

```text
npm.cmd ci
npm.cmd audit --audit-level=high
npm.cmd run lint
npm.cmd exec -- next typegen
npm.cmd exec -- tsc --noEmit
npm.cmd run test --if-present
npm.cmd run build
```

All exited 0: **171 tests in 13 files** passed, including the five Zod contract checks; the production build generated all 16 pages. Audit reported **10 moderate advisories**, 0 high/critical, in the existing ESLint toolchain. Existing ESLint peer-dependency warnings appeared during installation. No web dependencies or lockfile were changed.

The sandboxed install stalled and was stopped; the successful install and web checks ran outside the sandbox. The initial builds failed with a Turbopack worker-startup error. Preserving the stale generated `web/.next` directory under the ignored Rust `target/` directory and rebuilding from a clean cache resolved it; no application source change was needed.

`git diff --check` is clean. The changed/new file inventory contains only parser source, synthetic test data, one web contract test, CI and documentation; no PDF binaries, credentials or environment files were added. The existing CI change unconditionally checks the parser and preserves matcher checks. **GitHub Actions and Linux execution remain unverified until an approved draft PR runs CI.** Nothing was committed, pushed or published during this continuation.

Review decisions still needed: the unmaintained `ttf-parser` dependency; acceptance of owner-restricted PDFs with an empty user password; deployment sandbox, OS memory/crash-dump policy and whole-process kill timer; representative PDF coverage before real applicant data. The GitHub issue body still mentions the earlier TypeScript/HTTP design; a future draft should reference #4 and explain the explicitly authorized standalone Rust scope.

### Complete changed-file inventory

Relative to the existing branch HEAD: 9 modified files and 23 new files, all unstaged. This includes the original implementation and continuation fixes.

```text
.github/workflows/ci.yml                         unconditional parser checks; matcher preserved
CONTRIBUTING.md                                   parser toolchain and verification commands
README.md                                         standalone parser status
SECURITY.md                                       parser privacy/launch restrictions
docs/RESUME_INGESTION.md                           architecture, comparison, limits and handoff
docs/ROADMAP.md                                    parser CI status
docs/api-contract.md                               implementation status; contract shapes unchanged
docs/security/REVIEW_CHECKLIST.md                  synthetic cases and deployment review gates
docs/security/THREAT_MODEL.md                      parser boundary and residual risks
services/resume-parser/.gitattributes              golden JSON line endings
services/resume-parser/Cargo.toml                  crate, reviewed PDF dependency, Rust requirement
services/resume-parser/Cargo.lock                  pinned Rust dependency graph
services/resume-parser/README.md                   local entry point
services/resume-parser/src/deadline.rs             worker timeout helper
services/resume-parser/src/error.rs                stable content-free errors
services/resume-parser/src/extract.rs              input validation and positioned text
services/resume-parser/src/layout.rs               reading order and column assembly
services/resume-parser/src/lib.rs                  pipeline and metadata validation
services/resume-parser/src/limits.rs               shared limits
services/resume-parser/src/main.rs                 CLI, bounded I/O and process heap budget
services/resume-parser/src/models.rs               Resume JSON types and contract checks
services/resume-parser/src/sections.rs             headings and grouping; overflow regression fix
services/resume-parser/tests/cli.rs                real executable, budgets and persistence checks
services/resume-parser/tests/contract.rs           serialization and golden-output comparison
services/resume-parser/tests/invalid_inputs.rs     rejected and hostile input cases
services/resume-parser/tests/robustness.rs         mutation smoke test and dependency guard
services/resume-parser/tests/valid_resumes.rs      content, layout and section assertions
services/resume-parser/tests/golden/synthetic-one-column.json  synthetic parser output
services/resume-parser/tests/support/fixtures.rs   fictional resume cases
services/resume-parser/tests/support/mod.rs        shared test helpers
services/resume-parser/tests/support/pdf_builder.rs in-memory PDF writer
web/src/lib/resume/parser-contract.test.ts         actual Zod schema validation
```

## Future integration (separate PR, not implemented)

`POST /api/resume/parse` could wrap the program like this. Each step needs its own review.

1. Read the `multipart/form-data` `file` field as a **bounded stream** (stop at 5 MiB plus one byte). Do not trust `Content-Length`, the file name or the MIME type.
2. Start `resume-parser` with a **fixed argument list** (no shell): at most `--filename <client name>`. Pipe the bytes to standard input. Never write the upload to disk and never use the client's file name as a path.
3. Set a kill timer on the child slightly above `--timeout-ms`, and cap the number of concurrent parser processes.
4. Map the result:

| Program result | Suggested HTTP status | Body |
| --- | --- | --- |
| exit 0 | 200 | standard output; validate it with `ResumeSchema` |
| exit 1, `INVALID_FILE_TYPE` | 415 | standard output |
| exit 1, `FILE_TOO_LARGE` | 413 | standard output |
| exit 1, `NO_EXTRACTABLE_TEXT` or `PARSING_FAILED` | 422 | standard output |
| exit 3 | 422 | standard output |
| exit 2, any other status, killed, or unparseable output | 500 | a fixed `PARSING_FAILED` error written by the route |

5. Never log the request body, the file name or the parser's standard output.

Open points for that PR: the HTTP statuses above are suggestions and are not in the API contract; rate limiting for an unauthenticated upload route; and **where the binary runs**. A compiled program does not run in every hosted Next.js environment (the API contract already notes this for the Rust matcher). It may need a container image or a separate small service.

## Explicitly deferred

- The HTTP route, the onboarding PDF picker, Resume Lab buttons and the dashboard.
- Calling `/api/fit/analyze` or changing Bedrock code, AI schemas or cost controls.
- Storing PDFs or JSON, accounts, a database.
- OCR, AI-inferred sections or skills, scoring, rewriting.
- Real applicant data and public deployment, until security and privacy review is complete.
