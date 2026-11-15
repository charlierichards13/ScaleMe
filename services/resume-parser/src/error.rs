//! Stable, content-free errors.
//!
//! No variant carries document text, a filename or a library error string, so an error can be
//! logged or returned to a client without leaking resume content.

use serde::Serialize;
use std::fmt;

/// Why a document was rejected. Variants and their [`reason`](ParseError::reason) slugs are
/// stable; add new ones rather than changing existing ones.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ParseError {
    /// No bytes were supplied.
    EmptyFile,
    /// The content does not start with a PDF header (whatever the file name or MIME type says).
    NotPdf,
    /// More than [`MAX_PDF_BYTES`](crate::limits::MAX_PDF_BYTES).
    FileTooLarge,
    /// More than [`MAX_PAGES`](crate::limits::MAX_PAGES) pages.
    TooManyPages,
    /// The extracted text exceeds the contract's 30,000-character limit. Never truncated.
    TextTooLong,
    /// The PDF needs a password to open.
    Encrypted,
    /// The PDF structure is damaged or uses something the parser cannot read.
    Corrupted,
    /// A valid PDF with no text layer (for example a scan). OCR is out of scope.
    NoExtractableText,
    /// The time budget ran out.
    Timeout,
    /// A worker failed to start or panicked, the PDF library panicked, or output failed its self-check.
    Internal,
}

impl ParseError {
    /// Error code from `docs/api-contract.md`. Only the four documented codes are used.
    pub fn code(self) -> &'static str {
        match self {
            Self::EmptyFile | Self::NotPdf => "INVALID_FILE_TYPE",
            Self::FileTooLarge | Self::TooManyPages | Self::TextTooLong => "FILE_TOO_LARGE",
            Self::NoExtractableText => "NO_EXTRACTABLE_TEXT",
            Self::Encrypted | Self::Corrupted | Self::Timeout | Self::Internal => "PARSING_FAILED",
        }
    }

    /// Finer-grained, machine-readable reason (several reasons share one contract code).
    pub fn reason(self) -> &'static str {
        match self {
            Self::EmptyFile => "empty_file",
            Self::NotPdf => "not_a_pdf",
            Self::FileTooLarge => "file_too_large",
            Self::TooManyPages => "too_many_pages",
            Self::TextTooLong => "text_too_long",
            Self::Encrypted => "encrypted_pdf",
            Self::Corrupted => "corrupted_pdf",
            Self::NoExtractableText => "no_extractable_text",
            Self::Timeout => "timeout",
            Self::Internal => "internal_error",
        }
    }

    /// Fixed, client-safe message. Never contains document content.
    pub fn message(self) -> &'static str {
        match self {
            Self::EmptyFile => "No file was provided, or the file is empty.",
            Self::NotPdf => "The file is not a PDF. Please upload a text-based PDF resume.",
            Self::FileTooLarge => "The PDF is larger than the 5 MB limit.",
            Self::TooManyPages => "The PDF has more than 20 pages.",
            Self::TextTooLong => {
                "The resume text is longer than the 30,000-character limit. Nothing was cut off; \
                 please upload a shorter resume."
            }
            Self::Encrypted => {
                "The PDF is password-protected. Please upload a version without a password."
            }
            Self::Corrupted => "The PDF could not be read. It may be damaged or unsupported.",
            Self::NoExtractableText => {
                "No text could be extracted. Scanned or image-only PDFs are not supported yet."
            }
            Self::Timeout => "The PDF took too long to process.",
            Self::Internal => "The PDF could not be processed.",
        }
    }

    /// Parser errors do not request automatic retries.
    pub fn retryable(self) -> bool {
        false
    }

    /// The shared `ApiError` shape from `docs/api-contract.md`.
    pub fn to_api_error(self) -> ApiError {
        ApiError {
            error: ApiErrorBody {
                code: self.code(),
                message: self.message(),
                retryable: self.retryable(),
            },
        }
    }

    /// Every variant, for exhaustive tests and documentation.
    pub const ALL: [ParseError; 10] = [
        Self::EmptyFile,
        Self::NotPdf,
        Self::FileTooLarge,
        Self::TooManyPages,
        Self::TextTooLong,
        Self::Encrypted,
        Self::Corrupted,
        Self::NoExtractableText,
        Self::Timeout,
        Self::Internal,
    ];
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.reason())
    }
}

impl std::error::Error for ParseError {}

/// `{ "error": { "code", "message", "retryable" } }`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ApiError {
    pub error: ApiErrorBody,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ApiErrorBody {
    pub code: &'static str,
    pub message: &'static str,
    pub retryable: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_documented_contract_codes_are_used() {
        const DOCUMENTED: [&str; 4] = [
            "INVALID_FILE_TYPE",
            "FILE_TOO_LARGE",
            "NO_EXTRACTABLE_TEXT",
            "PARSING_FAILED",
        ];
        for e in ParseError::ALL {
            assert!(DOCUMENTED.contains(&e.code()), "{e:?}");
            assert!(!e.message().is_empty());
            assert!(!e.retryable());
        }
    }

    #[test]
    fn reasons_are_unique_and_stable() {
        let mut reasons: Vec<&str> = ParseError::ALL.iter().map(|e| e.reason()).collect();
        reasons.sort_unstable();
        let before = reasons.len();
        reasons.dedup();
        assert_eq!(before, reasons.len());
        assert_eq!(ParseError::Encrypted.reason(), "encrypted_pdf");
        assert_eq!(
            ParseError::NoExtractableText.reason(),
            "no_extractable_text"
        );
    }

    #[test]
    fn api_error_serializes_to_the_shared_shape() {
        let json = serde_json::to_value(ParseError::NotPdf.to_api_error()).unwrap();
        assert_eq!(json["error"]["code"], "INVALID_FILE_TYPE");
        assert_eq!(json["error"]["retryable"], false);
        assert!(json["error"]["message"].is_string());
        assert_eq!(json.as_object().unwrap().len(), 1);
        assert_eq!(json["error"].as_object().unwrap().len(), 3);
    }
}
