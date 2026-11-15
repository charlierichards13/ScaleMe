//! ScaleMe resume parser (Issue #4).
//!
//! Turns the bytes of a **text-based PDF resume** into the v0.1 `Resume` JSON contract from
//! `docs/api-contract.md`: `{ "resume": { id, filename?, text, sections? } }`.
//!
//! * Deterministic: no LLM, no OCR, no network, no filesystem access, no stored state.
//! * Truthful: text is extracted, ordered and whitespace-normalized. Nothing is rewritten,
//!   inferred or invented, and oversized text is rejected rather than truncated.
//! * Defensive: the PDF is untrusted input. Size, signature, page and text limits are enforced,
//!   library panics are contained, and errors never carry document content.
//!
//! See `docs/RESUME_INGESTION.md` for architecture, limits and known limitations.
//!
//! ```no_run
//! use resume_parser::{parse_resume, ParseOptions};
//!
//! let bytes = std::fs::read("synthetic-resume.pdf").unwrap();
//! match parse_resume(&bytes, &ParseOptions::default()) {
//!     Ok(envelope) => println!("{}", serde_json::to_string(&envelope).unwrap()),
//!     Err(error) => eprintln!("rejected: {}", error.reason()),
//! }
//! ```

#![forbid(unsafe_code)]

pub mod deadline;
pub mod error;
pub mod extract;
pub mod layout;
pub mod limits;
pub mod models;
pub mod sections;

pub use error::{ApiError, ParseError};
pub use models::{Resume, ResumeEnvelope, ResumeSection};

use limits::{utf16_len, MAX_FILENAME_UTF16, MAX_ID_UTF16, MAX_TEXT_UTF16};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::time::Duration;

/// Caller-supplied metadata. Both fields are optional and validated.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ParseOptions {
    filename: Option<String>,
    id: Option<String>,
}

/// A rejected [`ParseOptions`] value.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OptionsError {
    /// The id must be 1 to 100 characters from `A-Z a-z 0-9 . _ -`.
    InvalidId,
}

impl ParseOptions {
    pub fn new() -> Self {
        Self::default()
    }

    /// Display name to echo in `resume.filename`. Only the final path component is kept and
    /// control characters are removed; a name that is empty or longer than the contract allows
    /// is omitted. The name is never used to open, create or look up anything.
    pub fn with_filename(mut self, raw: &str) -> Self {
        self.filename = sanitize_filename(raw);
        self
    }

    /// Use a caller-chosen opaque id instead of a random one.
    pub fn with_id(mut self, id: &str) -> Result<Self, OptionsError> {
        let valid = !id.is_empty()
            && id.len() <= MAX_ID_UTF16
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'));
        if !valid {
            return Err(OptionsError::InvalidId);
        }
        self.id = Some(id.to_string());
        Ok(self)
    }

    pub fn filename(&self) -> Option<&str> {
        self.filename.as_deref()
    }
}

/// Keep only a safe display name: the last path component, without control characters.
pub fn sanitize_filename(raw: &str) -> Option<String> {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or("");
    let cleaned: String = base.chars().filter(|c| !c.is_control()).collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty()
        || cleaned == "."
        || cleaned == ".."
        || utf16_len(cleaned) > MAX_FILENAME_UTF16
    {
        return None;
    }
    Some(cleaned.to_string())
}

/// Parse a PDF resume held in memory.
///
/// Never panics and never returns partial or truncated text: the result is either a complete
/// `Resume` that satisfies the v0.1 contract limits, or a [`ParseError`].
///
/// This call has no time or memory limit of its own. Use the `resume-parser` program (or
/// [`parse_resume_with_deadline`] plus process-level isolation) for untrusted uploads.
pub fn parse_resume(bytes: &[u8], options: &ParseOptions) -> Result<ResumeEnvelope, ParseError> {
    // Cheap checks first so obviously wrong input never reaches the PDF library.
    extract::check_envelope(bytes)?;

    // The PDF library is third-party code running on hostile input: contain its panics.
    let lines = catch_unwind(AssertUnwindSafe(|| {
        extract::extract_fragments(bytes).map(layout::build_lines)
    }))
    .map_err(|_| ParseError::Internal)??;

    if lines.is_empty() {
        return Err(ParseError::NoExtractableText);
    }

    let text = lines
        .iter()
        .map(|l| l.text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    if utf16_len(&text) > MAX_TEXT_UTF16 {
        return Err(ParseError::TextTooLong); // never truncate silently
    }

    let sections = sections::detect_sections(&lines).map(|detected| {
        detected
            .into_iter()
            .map(|s| ResumeSection {
                heading: s.heading,
                text: s.text,
            })
            .collect()
    });

    let resume = Resume {
        id: match &options.id {
            Some(id) => id.clone(),
            None => random_id()?,
        },
        filename: options.filename.clone(),
        text,
        sections,
    };
    // Self-check against the contract limits; a failure here is a bug, not bad input.
    resume.check_contract().map_err(|_| ParseError::Internal)?;
    Ok(ResumeEnvelope { resume })
}

/// [`parse_resume`] with a wall-clock budget. On timeout the caller gets
/// [`ParseError::Timeout`], but the abandoned work is only really stopped when the process
/// exits (see [`deadline`]).
pub fn parse_resume_with_deadline(
    bytes: Vec<u8>,
    options: ParseOptions,
    timeout: Duration,
) -> Result<ResumeEnvelope, ParseError> {
    deadline::run_with_deadline(timeout, move || parse_resume(&bytes, &options))
        .unwrap_or(Err(ParseError::Timeout))
}

/// `resume-` followed by 128 random bits in hex. Not derived from the file name or content.
fn random_id() -> Result<String, ParseError> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).map_err(|_| ParseError::Internal)?;
    let mut id = String::from("resume-");
    for b in bytes {
        id.push_str(&format!("{b:02x}"));
    }
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filenames_are_reduced_to_a_safe_display_name() {
        assert_eq!(
            sanitize_filename("resume.pdf").as_deref(),
            Some("resume.pdf")
        );
        assert_eq!(
            sanitize_filename("../../etc/passwd").as_deref(),
            Some("passwd")
        );
        assert_eq!(
            sanitize_filename("C:\\Users\\someone\\Jordan Example.pdf").as_deref(),
            Some("Jordan Example.pdf")
        );
        assert_eq!(
            sanitize_filename("a\u{0}b\r\n.pdf").as_deref(),
            Some("ab.pdf")
        );
        assert_eq!(sanitize_filename(""), None);
        assert_eq!(sanitize_filename("dir/"), None);
        assert_eq!(sanitize_filename(".."), None);
        assert_eq!(sanitize_filename(&"n".repeat(256)), None);
        assert_eq!(
            sanitize_filename(&"n".repeat(255)).map(|s| s.len()),
            Some(255)
        );
    }

    #[test]
    fn ids_must_be_short_and_plain() {
        assert!(ParseOptions::new().with_id("resume-demo-001").is_ok());
        assert_eq!(
            ParseOptions::new().with_id(""),
            Err(OptionsError::InvalidId)
        );
        assert_eq!(
            ParseOptions::new().with_id("has space"),
            Err(OptionsError::InvalidId)
        );
        assert_eq!(
            ParseOptions::new().with_id("../x"),
            Err(OptionsError::InvalidId)
        );
        assert_eq!(
            ParseOptions::new().with_id(&"x".repeat(101)),
            Err(OptionsError::InvalidId)
        );
    }

    #[test]
    fn random_ids_are_opaque_and_differ() {
        let a = random_id().unwrap();
        let b = random_id().unwrap();
        assert_ne!(a, b);
        assert_eq!(a.len(), "resume-".len() + 32);
        assert!(a.starts_with("resume-"));
    }

    #[test]
    fn cheap_checks_run_before_the_pdf_library() {
        let opts = ParseOptions::default();
        assert_eq!(parse_resume(b"", &opts), Err(ParseError::EmptyFile));
        assert_eq!(parse_resume(b"not a pdf", &opts), Err(ParseError::NotPdf));
    }
}
