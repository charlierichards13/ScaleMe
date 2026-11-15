//! Malformed-input robustness and dependency guards.

mod support;

use resume_parser::{parse_resume, ParseError, ParseOptions};
use std::time::{Duration, Instant};
use support::fixtures as fx;

/// Small deterministic generator (xorshift64): the same mutations on every run and platform.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

fn mutate(base: &[u8], rng: &mut Rng) -> Vec<u8> {
    let mut v = base.to_vec();
    match rng.below(5) {
        0 => {
            for _ in 0..1 + rng.below(8) {
                let i = rng.below(v.len());
                v[i] = rng.next() as u8;
            }
        }
        1 => v.truncate(1 + rng.below(v.len())),
        2 => {
            let start = rng.below(v.len());
            let len = 1 + rng.below(200.min(v.len() - start));
            let chunk = v[start..start + len].to_vec();
            let at = rng.below(v.len());
            v.splice(at..at, chunk);
        }
        3 => {
            // Corrupt numbers: stream lengths, xref offsets, object ids, coordinates.
            for _ in 0..1 + rng.below(6) {
                let i = rng.below(v.len());
                if v[i].is_ascii_digit() {
                    v[i] = b'0' + (rng.next() % 10) as u8;
                }
            }
        }
        _ => {
            let start = rng.below(v.len());
            let len = 1 + rng.below(300.min(v.len() - start));
            v.drain(start..start + len);
        }
    }
    v
}

#[test]
fn mutated_pdfs_never_crash_hang_or_break_the_contract() {
    let bases = [
        fx::one_column().pdf,
        fx::two_column(true).pdf,
        fx::unicode().pdf,
        fx::multi_page().pdf,
        fx::owner_only_encrypted(),
        fx::image_only(),
        fx::active_content().pdf,
    ];
    let mut rng = Rng(0x9E37_79B9_7F4A_7C15);
    let (mut parsed, mut rejected, mut internal) = (0u32, 0u32, 0u32);
    let mut slowest = Duration::ZERO;

    for case in 0..4000 {
        let input = mutate(&bases[case % bases.len()], &mut rng);
        let started = Instant::now();
        // `parse_resume` must return; a panic inside it would fail this test.
        let result = parse_resume(&input, &ParseOptions::default());
        slowest = slowest.max(started.elapsed());
        match result {
            Ok(envelope) => {
                parsed += 1;
                assert_eq!(envelope.resume.check_contract(), Ok(()), "case {case}");
            }
            Err(ParseError::Internal) => internal += 1,
            Err(error) => {
                rejected += 1;
                assert!(
                    matches!(
                        error,
                        ParseError::NotPdf
                            | ParseError::Corrupted
                            | ParseError::Encrypted
                            | ParseError::NoExtractableText
                            | ParseError::TooManyPages
                            | ParseError::TextTooLong
                    ),
                    "case {case}: unexpected {error:?}"
                );
            }
        }
    }

    assert_eq!(parsed + rejected + internal, 4000);
    assert!(parsed > 0 && rejected > 0, "both outcomes are exercised");
    // `Internal` means the PDF library panicked and the parser contained it. That is handled,
    // but a non-zero count is new information about the pinned library version.
    assert_eq!(
        internal, 0,
        "the PDF library panicked on {internal} mutated inputs"
    );
    assert!(
        slowest < Duration::from_secs(5),
        "slowest mutated input took {slowest:?}"
    );
}

#[test]
fn dependency_tree_has_no_network_ai_or_second_pdf_library() {
    // Guard against accidentally enabling known networking dependencies. This is not a
    // network sandbox: std::net and OS APIs do not need a package in Cargo.lock.
    let lock = include_str!("../Cargo.lock");
    let packages: Vec<&str> = lock
        .lines()
        .filter_map(|line| line.strip_prefix("name = \""))
        .filter_map(|rest| rest.strip_suffix('"'))
        .collect();
    assert!(packages.contains(&"pdf-inspector"));

    let forbidden = [
        // HTTP, TLS and async networking
        "ureq",
        "reqwest",
        "hyper",
        "curl",
        "isahc",
        "attohttpc",
        "tokio",
        "async-std",
        "mio",
        "socket2",
        "rustls",
        "native-tls",
        "openssl",
        "openssl-sys",
        "h2",
        "tungstenite",
        // cloud and AI SDKs
        "aws-config",
        "aws-sdk-bedrockruntime",
        "async-openai",
        // OCR / rendering / model runtimes (optional pdf-inspector features that must stay off)
        "ort",
        "oar-ocr",
        "firecrawl-pdfium",
        "pdfium-render",
        "tesseract",
        "pyo3",
        // a second PDF extraction library
        "pdf_oxide",
        "pdf-extract",
        "pdf",
        "mupdf",
        "poppler",
    ];
    for name in forbidden {
        assert!(!packages.contains(&name), "unexpected dependency: {name}");
    }
}
