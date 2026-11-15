# Issue #4 — PDF resume ingestion and JSON parser

**Status:** Specification / documentation only. No parser implementation or pull request has been created by this documentation commit.

**Owner:** @MisterProper667  
**Branch:** `feat/resume-ingestion` (started from the current `main`)  
**Issue:** [#4 — Parse PDF resumes safely](https://github.com/charlierichards13/ScaleMe/issues/4)

## Goal

Implement an isolated, server-side PDF resume parser that takes a valid **text-based PDF**, extracts the document text, identifies sections where possible, and returns a **structured JSON resume object** that existing and future ScaleMe features can consume.

The first milestone is **the parser and JSON result only**. Do not connect it to the onboarding resume picker, dashboard, Resume Lab buttons, fit-analysis UI, or interview features in this branch. Integration will be planned as a separate change when approved.

## Compatibility with the existing API contract

Follow `docs/api-contract.md`, specifically:

- `POST /api/resume/parse` accepts `multipart/form-data` with a `file` field.
- The successful response is `{ "resume": Resume }`, using the current `Resume` contract.
- The canonical v0.1 `Resume` fields are `id: string`, optional `filename: string`, `text: string`, and optional `sections: { heading: string; text: string }[]`.
- `web/src/lib/ai/schemas.ts` currently defines `ResumeSchema`. Follow its limits and validate the parser output against the existing schema, without modifying AI/Bedrock code.
- In particular, `resume.text` is bounded to **30,000 characters** and `sections` to **50 items** by the current runtime schema. Handle over-limit text explicitly; do not silently truncate it.

### Example of intended JSON output

*Fully synthetic content for documentation; not a real applicant.*

```json
{
  "resume": {
    "id": "resume-demo-001",
    "filename": "synthetic-resume.pdf",
    "text": "EDUCATION\nB.S. Computer Science\nPROJECTS\nBuilt a scheduling application using Python and SQL.\nSKILLS\nPython, SQL, Git",
    "sections": [
      {
        "heading": "Education",
        "text": "B.S. Computer Science"
      },
      {
        "heading": "Projects",
        "text": "Built a scheduling application using Python and SQL."
      },
      {
        "heading": "Skills",
        "text": "Python, SQL, Git"
      }
    ]
  }
}
```

This is JSON **data**, not a promise that a file is written permanently to disk. A caller can serialize or export a `.json` file later if desired, but the MVP should return JSON in memory through the API. Do **not** store real resumes or generated JSON files on the server by default. Only synthetic test fixtures may be checked into Git.

## Expected parser behavior

1. Accept one uploaded PDF through the server-side API handler, with parsing in a separate testable library module.
2. Perform **server-side** limits and checks: require the file, cap the upload at **5 MiB** (matching the current onboarding picker), validate claimed type/name and actual PDF signature/content. Do not trust extension or MIME alone.
3. Use a reviewed PDF extraction library to get useful text and preserve reading order as well as reasonably possible. Bound parse time, document pages, input bytes, and computational work. Treat PDFs as untrusted data; never execute content, launch commands, fetch external links, or follow PDF-embedded instructions.
4. Normalize whitespace conservatively; preserve substantive text and the source's meaning. No rewritten bullets, fabricated achievements, skill claims, dates, or inferred employers.
5. Recognize headings such as **Experience**, **Education**, **Projects**, **Skills**, and **Certifications** on a best-effort basis. Keep unknown or unconventional headings instead of discarding data. If section detection is uncertain, return the reliable full text and omit uncertain sections.
6. Build a JSON object compatible with the existing `ResumeSchema` and return `{ "resume": ... }`. Use a request-specific opaque ID; never treat the filename as an authorization or storage key.
7. Make validation and extraction failures explicit and safe, using the shared `ApiError` format. Reuse the documented error codes `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `NO_EXTRACTABLE_TEXT`, and `PARSING_FAILED` where applicable; document any additional status/code before adopting it.
8. Text-based PDFs are the initial target. For scanned/image-only, encrypted, corrupted, or unsupported PDFs, return an explanatory error or honest limitation. **OCR is out of scope** for this first version.
9. Do not log resume contents, personal information, or filenames. No persistent uploads, generated JSON files, remote document stores, third-party AI extraction, telemetry, or network requests for parsing.

## Files and ownership (proposed)

```text
web/src/app/api/resume/parse/route.ts   # backend endpoint, no UI
web/src/lib/resume/                  # parsing, validation, normalization and tests
docs/RESUME_INGESTION.md             # this specification and later implementation notes
```

Implementation paths may be adjusted after inspecting the repo, but do not touch files owned by other PRs without prior coordination:

```text
web/src/app/api/fit/analyze/
web/src/lib/ai/
web/src/lib/fit/
web/src/app/fit-insights/
web/src/app/(workspace)/
web/src/components/onboarding/
web/src/app/onboarding/
web/src/app/(auth-preview)/
services/matching-rust/
```

Follow `AGENTS.md`, `SECURITY.md`, `CONTRIBUTING.md`, `web/AGENTS.md`, and the security review checklist. Any new PDF package must be approved/reviewed and the `package.json` / lockfile edits coordinated with the team.

## Acceptance criteria — parser-only Phase 1

- [ ] Valid **single-page and multi-page text PDFs** produce a JSON object matching `ResumeSchema`.
- [ ] The JSON contains useful extracted `text` and recognizable `sections` when supported by the document layout; unknown content isn't silently discarded.
- [ ] JSON is usable by downstream consumers without conversion to an incompatible custom schema.
- [ ] Empty, missing, non-PDF, malformed, password-protected, oversized, image-only and over-limit-text inputs produce appropriate, generic, stable errors.
- [ ] Test double-column/mixed-layout documents and document any unavoidable reading-order limitations.
- [ ] Use exclusively **synthetic PDF fixtures and resume data** for tests, logs and screenshots.
- [ ] Tests cover PDF signature checks, file/size/page/text limits, extraction outcomes, error codes, no filesystem persistence, and JSON schema validation.
- [ ] Document the extraction library, resource/abuse limits, known limitations, and how a future consumer calls the endpoint.
- [ ] All existing Web quality CI checks pass; the final PR is a draft for human review, not auto-merged.

## Explicitly deferred

- Wiring the onboarding PDF picker, Resume Lab buttons, or dashboard to this endpoint.
- Calling `POST /api/fit/analyze` or changing Bedrock code, API contracts for other features, or cost controls.
- Persisting `.pdf` or `.json` files, authenticated per-user storage, profile management, or a database.
- OCR, image reconstruction, AI-inferred skills/sections, score calculation, resume rewriting, exporting a downloadable `.json` file through a UI.
- Real applicant acceptance and public deployment until security and privacy review is complete.

## Proposed implementation stages

1. Review the existing `ResumeSchema`, the proposed endpoint, PDF parsing libraries and security constraints.
2. Write synthetic PDF fixtures and unit tests for valid and invalid documents.
3. Implement a deterministic extraction/sectioning function that returns JSON-shaped data.
4. Add the bounded server API handler, document errors, and test end-to-end locally with **synthetic** PDFs.
5. Open a draft PR on `feat/resume-ingestion` without touching frontend integrations.

**Current status:** planning only. No endpoint or parser functionality should be represented as already live.
