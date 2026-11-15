//! PDF validation and text-fragment extraction.
//!
//! This is the only module that touches the PDF library (`pdf-inspector`). It asks the library
//! for positioned text runs and nothing else: no rendering, no OCR, no JavaScript, no embedded
//! files, no links are followed and no network or filesystem access happens. The PDF is
//! untrusted data from start to finish.

use crate::error::ParseError;
use crate::limits::{MAX_FRAGMENTS, MAX_PAGES, MAX_PDF_BYTES, MAX_RAW_TEXT_BYTES};
use pdf_inspector::types::ItemType;
use pdf_inspector::PdfError;

/// One run of text as positioned on a page.
#[derive(Clone, Debug, PartialEq)]
pub struct Fragment {
    /// 1-based page number.
    pub page: u32,
    /// Left edge in PDF points.
    pub x: f32,
    /// Baseline in PDF points, growing upward.
    pub y: f32,
    /// Advance width in points (0 when the font has no width data).
    pub width: f32,
    /// Font size in points.
    pub size: f32,
    pub bold: bool,
    /// `false` for rotated runs such as vertical margin text.
    pub horizontal: bool,
    pub text: String,
}

/// Size and content-signature checks that need no PDF library.
///
/// The header must be at byte 0 and look like `%PDF-1.7`. The PDF specification tolerates
/// leading junk; this parser deliberately does not, so a file that merely *contains* a PDF
/// somewhere (a polyglot, or a renamed archive) is rejected.
pub fn check_envelope(bytes: &[u8]) -> Result<(), ParseError> {
    if bytes.is_empty() {
        return Err(ParseError::EmptyFile);
    }
    if bytes.len() > MAX_PDF_BYTES {
        return Err(ParseError::FileTooLarge);
    }
    let header_ok = bytes.len() >= 8
        && bytes.starts_with(b"%PDF-")
        && bytes[5].is_ascii_digit()
        && bytes[6] == b'.'
        && bytes[7].is_ascii_digit();
    if !header_ok {
        return Err(ParseError::NotPdf);
    }
    Ok(())
}

/// Parse the document and return its text runs. Enforces the page and fragment limits.
pub fn extract_fragments(bytes: &[u8]) -> Result<Vec<Fragment>, ParseError> {
    check_envelope(bytes)?;

    // Cheap structural pass first: it yields the page count (and fails on encrypted or broken
    // files) before any page content is decoded.
    let detected = pdf_inspector::detect_pdf_mem(bytes).map_err(map_pdf_error)?;
    if detected.page_count > MAX_PAGES {
        return Err(ParseError::TooManyPages);
    }

    let items = pdf_inspector::extract_text_with_positions_mem(bytes).map_err(map_pdf_error)?;
    if items.len() > MAX_FRAGMENTS {
        return Err(ParseError::TextTooLong);
    }
    // Far more text than the contract allows: stop before doing any layout work. (The exact
    // limit is applied to the final text; double-painted "fake bold" runs can shrink it.)
    let total_bytes: usize = items.iter().map(|item| item.text.len()).sum();
    if total_bytes > MAX_RAW_TEXT_BYTES {
        return Err(ParseError::TextTooLong);
    }

    let mut fragments = Vec::with_capacity(items.len());
    for item in items {
        // Image placeholders, link annotations and form fields are not resume text runs.
        if !matches!(item.item_type, ItemType::Text) {
            continue;
        }
        if item.page > MAX_PAGES {
            return Err(ParseError::TooManyPages);
        }
        fragments.push(Fragment {
            page: item.page,
            x: item.x,
            y: item.line_y(),
            width: item.width,
            size: item.font_size,
            bold: item.is_bold,
            horizontal: item.is_horizontal(),
            text: item.text,
        });
    }
    Ok(fragments)
}

/// Collapse library errors into content-free categories. The library's own message is dropped
/// on purpose: it can quote bytes from the document.
fn map_pdf_error(err: PdfError) -> ParseError {
    match err {
        PdfError::Encrypted => ParseError::Encrypted,
        PdfError::NotAPdf(_) => ParseError::NotPdf,
        PdfError::Io(_) | PdfError::Parse(_) | PdfError::InvalidStructure => ParseError::Corrupted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_input_is_rejected() {
        assert_eq!(check_envelope(b""), Err(ParseError::EmptyFile));
    }

    #[test]
    fn header_must_be_at_byte_zero() {
        assert_eq!(check_envelope(b"%PDF-1.7\n..."), Ok(()));
        assert_eq!(check_envelope(b"%PDF-2.0\n..."), Ok(()));
        assert_eq!(check_envelope(b" %PDF-1.7\n"), Err(ParseError::NotPdf));
        assert_eq!(check_envelope(b"junk%PDF-1.7\n"), Err(ParseError::NotPdf));
        assert_eq!(check_envelope(b"%PDF-"), Err(ParseError::NotPdf));
        assert_eq!(check_envelope(b"%PDF-x.y\n"), Err(ParseError::NotPdf));
        assert_eq!(
            check_envelope(b"PK\x03\x04zipfile"),
            Err(ParseError::NotPdf)
        );
        assert_eq!(check_envelope(b"<html>%PDF-1.7"), Err(ParseError::NotPdf));
    }

    #[test]
    fn size_limit_is_checked_before_the_header() {
        let mut big = b"%PDF-1.7\n".to_vec();
        big.resize(MAX_PDF_BYTES, b' ');
        assert_eq!(check_envelope(&big), Ok(()));
        big.push(b' ');
        assert_eq!(check_envelope(&big), Err(ParseError::FileTooLarge));
        // An oversized non-PDF is reported as too large without inspecting it further.
        let junk = vec![0u8; MAX_PDF_BYTES + 1];
        assert_eq!(check_envelope(&junk), Err(ParseError::FileTooLarge));
    }

    #[test]
    fn library_errors_map_to_content_free_categories() {
        assert_eq!(map_pdf_error(PdfError::Encrypted), ParseError::Encrypted);
        assert_eq!(
            map_pdf_error(PdfError::NotAPdf("secret text".into())),
            ParseError::NotPdf
        );
        assert_eq!(
            map_pdf_error(PdfError::Parse("quoted resume text".into())),
            ParseError::Corrupted
        );
        assert_eq!(
            map_pdf_error(PdfError::InvalidStructure),
            ParseError::Corrupted
        );
    }
}
