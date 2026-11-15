//! Compatibility with the v0.1 `Resume` contract (`docs/api-contract.md`,
//! `web/src/lib/ai/schemas.ts`).
//!
//! `tests/golden/synthetic-one-column.json` is the parser's real output for a synthetic
//! resume. This test keeps it in sync with the parser; the web test
//! `web/src/lib/resume/parser-contract.test.ts` validates the same file against the actual
//! Zod `ResumeSchema`, so the two sides cannot drift apart unnoticed.

mod support;

use resume_parser::limits::{MAX_HEADING_UTF16, MAX_SECTIONS, MAX_TEXT_UTF16};
use resume_parser::{parse_resume, ParseOptions, ResumeEnvelope};
use std::path::Path;
use support::fixtures as fx;

const GOLDEN: &str = "tests/golden/synthetic-one-column.json";

fn golden_options() -> ParseOptions {
    ParseOptions::new()
        .with_id("resume-demo-001")
        .unwrap()
        .with_filename("synthetic-resume.pdf")
}

#[test]
fn golden_json_matches_parser_output() {
    let envelope = parse_resume(&fx::one_column().pdf, &golden_options()).unwrap();
    let actual = serde_json::to_string_pretty(&envelope).unwrap() + "\n";
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(GOLDEN);

    // `UPDATE_GOLDEN=1 cargo test --test contract` rewrites the file after an intended change.
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::write(&path, &actual).unwrap();
    }
    let expected = std::fs::read_to_string(&path)
        .expect("golden file is checked in")
        .replace("\r\n", "\n");
    assert_eq!(
        actual, expected,
        "run with UPDATE_GOLDEN=1 if the change is intended"
    );
}

#[test]
fn every_parsed_fixture_satisfies_the_contract() {
    let fixtures = [
        fx::one_column(),
        fx::one_column_word_positioned(),
        fx::one_column_kerned(),
        fx::dates_and_wrapped_bullets(),
        fx::alias_headings(),
        fx::two_column(false),
        fx::two_column(true),
        fx::multi_page(),
        fx::no_headings(),
        fx::misleading_keywords(),
        fx::unicode(),
        fx::active_content(),
    ];
    for fixture in fixtures {
        let envelope = parse_resume(&fixture.pdf, &ParseOptions::default()).unwrap();
        assert_eq!(envelope.resume.check_contract(), Ok(()), "{}", fixture.name);

        let json = serde_json::to_value(&envelope).unwrap();
        let top: Vec<&String> = json.as_object().unwrap().keys().collect();
        assert_eq!(top, ["resume"], "{}", fixture.name);

        let resume = json["resume"].as_object().unwrap();
        for key in resume.keys() {
            assert!(
                ["id", "filename", "text", "sections"].contains(&key.as_str()),
                "{}: unexpected field {key}",
                fixture.name
            );
        }
        assert!(resume["id"].is_string());
        let text = resume["text"].as_str().unwrap();
        assert!(!text.trim().is_empty());
        assert!(text.encode_utf16().count() <= MAX_TEXT_UTF16);
        assert_eq!(text, text.trim(), "no leading or trailing whitespace");

        if let Some(sections) = resume.get("sections") {
            let sections = sections.as_array().unwrap();
            assert!(!sections.is_empty() && sections.len() <= MAX_SECTIONS);
            for section in sections {
                let section = section.as_object().unwrap();
                let mut keys: Vec<&str> = section.keys().map(String::as_str).collect();
                keys.sort_unstable();
                assert_eq!(keys, ["heading", "text"]);
                let heading = section["heading"].as_str().unwrap();
                assert!(!heading.is_empty());
                assert!(heading.encode_utf16().count() <= MAX_HEADING_UTF16);
                assert!(section["text"].as_str().unwrap().encode_utf16().count() <= MAX_TEXT_UTF16);
            }
        }

        // Strict round trip: unknown fields would be rejected.
        let back: ResumeEnvelope = serde_json::from_value(json).unwrap();
        assert_eq!(back, envelope);
    }
}

#[test]
fn text_uses_single_newlines_and_single_spaces_only() {
    for fixture in [
        fx::one_column(),
        fx::two_column(true),
        fx::multi_page(),
        fx::unicode(),
    ] {
        let text = parse_resume(&fixture.pdf, &ParseOptions::default())
            .unwrap()
            .resume
            .text;
        assert!(!text.contains("\n\n"), "{}", fixture.name);
        assert!(!text.contains("  "), "{}", fixture.name);
        assert!(
            !text.contains('\r') && !text.contains('\t'),
            "{}",
            fixture.name
        );
        assert!(
            text.lines().all(|l| l == l.trim() && !l.is_empty()),
            "{}",
            fixture.name
        );
    }
}
