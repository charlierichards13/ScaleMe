//! Hard limits. See the specification's resource-limit table for verification coverage.
//!
//! The text, section and field limits mirror `ResumeSchema` in `web/src/lib/ai/schemas.ts`
//! (the v0.1 contract). Zod measures string length in UTF-16 code units, so this crate does too.

/// Largest accepted upload: 5 MiB, the same limit as the onboarding file picker.
pub const MAX_PDF_BYTES: usize = 5 * 1024 * 1024;

/// Largest accepted page count. Resumes are short; this bounds parser work.
pub const MAX_PAGES: u32 = 20;

/// `resume.text` and each `sections[].text`: at most 30,000 UTF-16 code units.
pub const MAX_TEXT_UTF16: usize = 30_000;

/// Positioned fragments accepted from the PDF library before giving up. A dense 20-page
/// document stays far below this; it only stops pathological files early.
pub const MAX_FRAGMENTS: usize = 60_000;

/// Raw text bytes accepted from the PDF library before layout. Sixteen times the final text
/// limit leaves room for multi-byte characters and double-painted runs.
pub const MAX_RAW_TEXT_BYTES: usize = 16 * MAX_TEXT_UTF16;

/// At most 50 sections; above that, section detection is treated as unreliable and omitted.
pub const MAX_SECTIONS: usize = 50;

/// `sections[].heading`: at most 200 UTF-16 code units.
pub const MAX_HEADING_UTF16: usize = 200;

/// `resume.id`: 1 to 100 UTF-16 code units.
pub const MAX_ID_UTF16: usize = 100;

/// `resume.filename`: at most 255 UTF-16 code units.
pub const MAX_FILENAME_UTF16: usize = 255;

/// Default wall-clock budget for one parse in the CLI.
pub const DEFAULT_TIMEOUT_MS: u64 = 10_000;

/// Upper bound for the CLI `--timeout-ms` flag.
pub const MAX_TIMEOUT_MS: u64 = 60_000;

/// Default heap budget for the CLI process.
pub const DEFAULT_MAX_MEMORY_MIB: usize = 256;

/// Upper bound for the CLI `--max-memory-mib` flag.
pub const MAX_MEMORY_MIB: usize = 1024;

/// Length of `s` as JavaScript (and therefore Zod) counts it.
pub fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_len_counts_surrogate_pairs_as_two() {
        assert_eq!(utf16_len("abc"), 3);
        assert_eq!(utf16_len("\u{e9}"), 1);
        assert_eq!(utf16_len("\u{1f680}"), 2); // rocket emoji: one char, two UTF-16 units
    }
}
