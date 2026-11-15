//! Valid, text-based resumes: extraction, reading order and section grouping.
//! All documents are synthetic and generated in memory (see `tests/support`).

mod support;

use resume_parser::{parse_resume, ParseOptions, Resume};
use support::fixtures::{self as fx, Fixture};

fn parse(pdf: &[u8]) -> Resume {
    parse_resume(pdf, &ParseOptions::default())
        .expect("synthetic fixture should parse")
        .resume
}

fn text_lines(resume: &Resume) -> Vec<&str> {
    resume.text.split('\n').collect()
}

/// `(heading, text)` pairs.
fn sections(resume: &Resume) -> Vec<(&str, &str)> {
    resume
        .sections
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(|s| (s.heading.as_str(), s.text.as_str()))
        .collect()
}

fn headings(resume: &Resume) -> Vec<&str> {
    sections(resume).into_iter().map(|(h, _)| h).collect()
}

/// The extracted text is exactly the lines the fixture drew, in reading order: nothing lost,
/// nothing added, nothing reordered.
fn assert_text_matches(fixture: &Fixture, resume: &Resume) {
    let expected: Vec<&str> = fixture.lines.iter().map(String::as_str).collect();
    assert_eq!(text_lines(resume), expected, "fixture {}", fixture.name);
}

fn page_count(pdf: &[u8]) -> usize {
    let haystack = String::from_utf8_lossy(pdf);
    haystack.matches("/Type /Page ").count()
}

#[test]
fn standard_one_column_resume() {
    let fixture = fx::one_column();
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    assert_eq!(
        sections(&resume),
        [
            (
                "Education",
                "Example State University, B.S. Computer Science, May 2026\n\
                 Relevant coursework: Data Structures, Databases, Operating Systems"
            ),
            (
                "Experience",
                "Software Engineering Intern, Synthetic Systems Co. Jun 2025 \u{2013} Aug 2025\n\
                 \u{2022} Built an internal scheduling dashboard with Python and SQL.\n\
                 \u{2022} Wrote unit tests for the reporting service."
            ),
            (
                "Projects",
                "Campus Events Finder\n\u{2022} Developed a web app that lists student club events."
            ),
            ("Skills", "Python, SQL, Git, TypeScript"),
            (
                "Certifications",
                "Example Cloud Practitioner (fictional), 2025"
            ),
        ]
    );
    // Name and contact line precede the first heading: in the text, in no section.
    assert_eq!(text_lines(&resume)[0], "Jordan Example");
    assert!(resume.filename.is_none());
}

#[test]
fn same_resume_written_three_different_ways_gives_identical_output() {
    let reference = parse(&fx::one_column().pdf);
    for variant in [fx::one_column_word_positioned(), fx::one_column_kerned()] {
        let resume = parse(&variant.pdf);
        assert_eq!(resume.text, reference.text, "{}", variant.name);
        assert_eq!(resume.sections, reference.sections, "{}", variant.name);
    }
}

#[test]
fn two_column_resume_reads_each_column_separately() {
    for interleaved in [false, true] {
        let fixture = fx::two_column(interleaved);
        let resume = parse(&fixture.pdf);
        // Sidebar first, then the main column; no line mixes text from both columns.
        assert_text_matches(&fixture, &resume);
        assert_eq!(
            sections(&resume),
            [
                ("Contact", "jordan.example@example.com\n(555) 010-0199"),
                ("Skills", "Python\nSQL\nDocker"),
                // The name tops the main column; it is a title, not part of the sidebar.
                ("Certifications", "Example Cloud Cert (fictional)"),
                (
                    "Experience",
                    "Backend Intern, Synthetic Systems Co. 2025\n\
                     \u{2022} Designed REST endpoints for a scheduling tool.\n\
                     \u{2022} Reduced manual data entry for the operations team."
                ),
                (
                    "Education",
                    "Example State University, B.S. Computer Science"
                ),
                ("Projects", "Campus Events Finder, a club event web app"),
            ],
            "interleaved={interleaved}"
        );
    }
}

#[test]
fn multi_page_resume_keeps_a_section_together_across_page_breaks() {
    let fixture = fx::multi_page();
    assert!(
        page_count(&fixture.pdf) >= 3,
        "fixture must span three pages"
    );
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    assert_eq!(
        headings(&resume),
        ["Summary", "Experience", "Education", "Skills", "Projects"]
    );
    let experience = sections(&resume)[1].1;
    assert_eq!(
        experience.lines().count(),
        84,
        "14 roles x (1 title + 5 bullets)"
    );
    assert!(experience.starts_with("Engineering Role 1, Fictional Company 1."));
    assert!(experience.contains("Engineering Role 14, Fictional Company 14."));
    assert!(experience
        .ends_with("Responsibility 5 for role 14: maintained a synthetic service component."));
}

#[test]
fn alias_mixed_case_and_unknown_headings() {
    let fixture = fx::alias_headings();
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    assert_eq!(
        sections(&resume),
        [
            (
                "Professional Experience",
                "Data Analyst Intern, Placeholder Analytics LLC. 2024 \u{2013} 2025\n\
                 \u{2022} Cleaned survey datasets in pandas."
            ),
            (
                "Academic Background",
                "Example Community College, A.S. Mathematics, 2024"
            ),
            // Sentence case is kept exactly as written.
            ("Technical skills", "R, Python, Excel, Tableau"),
            (
                "Selected Projects",
                "Budget Tracker \u{2013} personal finance app"
            ),
            // A known heading in capitals is shown in title case.
            (
                "Licenses & Certifications",
                "Example Data Fundamentals Certificate (fictional)"
            ),
            // Not in any alias list: accepted because it is set like the other headings.
            (
                "Things I Built",
                "A fictional weather station made from spare parts"
            ),
            // Trailing colon removed from the heading.
            (
                "Volunteer Work",
                "Tutor, Example Public Library, 2023 \u{2013} present"
            ),
        ]
    );
    // The headings as the candidate wrote them are still in the full text.
    assert!(resume.text.contains("LICENSES & CERTIFICATIONS"));
    assert!(resume.text.contains("Volunteer Work:"));
}

#[test]
fn bullets_dates_and_wrapped_lines_are_preserved() {
    let fixture = fx::dates_and_wrapped_bullets();
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    let lines = text_lines(&resume);
    // A right-aligned date stays on the row of the job it belongs to.
    assert!(lines.contains(
        &"Software Engineering Intern, Synthetic Systems Co. Jun 2025 \u{2013} Aug 2025"
    ));
    assert!(lines.contains(&"Lab Assistant, Example State University 2024 \u{2013} 2025"));
    assert!(lines.contains(&"Example State University, B.S. Computer Science May 2026"));
    // A wrapped bullet keeps its visual line break; the continuation follows it directly.
    let bullet = lines
        .iter()
        .position(|l| l.starts_with("\u{2022} Built an internal scheduling dashboard"))
        .unwrap();
    assert_eq!(lines[bullet + 1], "operations team used every week.");
    assert_eq!(resume.text.matches('\u{2022}').count(), 2);
    assert_eq!(headings(&resume), ["Experience", "Education"]);
}

#[test]
fn bullet_lists_survive_across_three_pages() {
    let fixture = fx::multi_page();
    let resume = parse(&fixture.pdf);
    let drawn = fixture
        .lines
        .iter()
        .filter(|l| l.starts_with('\u{2022}'))
        .count();
    assert_eq!(drawn, 82);
    let extracted = text_lines(&resume)
        .iter()
        .filter(|l| l.starts_with("\u{2022} "))
        .count();
    assert_eq!(extracted, drawn);
}

#[test]
fn resume_without_headings_returns_full_text_and_no_sections() {
    let fixture = fx::no_headings();
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    assert!(resume.sections.is_none(), "uncertain structure is omitted");
    let json = serde_json::to_value(&resume).unwrap();
    assert!(json.get("sections").is_none(), "omitted, not null");
}

#[test]
fn section_keywords_inside_sentences_do_not_start_sections() {
    let fixture = fx::misleading_keywords();
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    assert_eq!(headings(&resume), ["Summary", "Experience"]);
    let summary = sections(&resume)[0].1;
    // "Education" alone on a line, but it starts a wrapped sentence: it stays in Summary.
    assert_eq!(
        summary,
        "I have experience with Python and an interest in education technology.\n\
         Skills I am building include public speaking and project planning.\n\
         Education\n\
         matters to me, so I mentor first-year students."
    );
    let experience = sections(&resume)[1].1;
    assert!(experience.contains("\u{2022} Experience design workshop"));
    assert!(experience.contains("\u{2022} Projects review"));
}

#[test]
fn unusual_unicode_is_extracted_unchanged() {
    let fixture = fx::unicode();
    let resume = parse(&fixture.pdf);
    assert_text_matches(&fixture, &resume);
    for expected in [
        "Jos\u{e9} Ni\u{f1}o Ex\u{e1}mple",             // Latin-1 accents
        "\u{6771}\u{4eac}\u{5927}\u{5b66} (fictional)", // CJK
        "\u{25aa} C++ \u{2192} Rust",                   // symbols outside WinAnsi
        "\u{3b1}\u{3b2}\u{3b3} testing",                // Greek
        "\u{1f680} launch prep",                        // astral-plane emoji
    ] {
        assert!(resume.text.contains(expected), "missing {expected:?}");
    }
    assert_eq!(headings(&resume), ["Education", "Skills"]);
    // Survives a JSON round trip byte for byte.
    let json = serde_json::to_string(&resume).unwrap();
    let back: Resume = serde_json::from_str(&json).unwrap();
    assert_eq!(back, resume);
}

#[test]
fn pdf_that_opens_without_a_password_is_parsed_even_if_owner_restricted() {
    // Documented policy: only PDFs that need a password to OPEN are rejected.
    let resume = parse(&fx::owner_only_encrypted());
    assert_eq!(text_lines(&resume)[0], "Jordan Example");
    assert_eq!(
        sections(&resume),
        [("Education", "Example State University")]
    );
}

#[test]
fn nothing_is_fabricated() {
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
        let resume = parse(&fixture.pdf);
        let source = fixture.lines.join("\n");
        let source_words: std::collections::HashSet<&str> = source.split_whitespace().collect();

        // Every word of the output was drawn in the PDF.
        for word in resume.text.split_whitespace() {
            assert!(
                source_words.contains(word),
                "{}: invented {word:?}",
                fixture.name
            );
        }
        // Same number of non-space characters in and out: nothing dropped either.
        let visible = |s: &str| s.chars().filter(|c| !c.is_whitespace()).count();
        assert_eq!(visible(&resume.text), visible(&source), "{}", fixture.name);

        for (heading, text) in sections(&resume) {
            // Section bodies are verbatim slices of the full text...
            assert!(resume.text.contains(text), "{}: {heading}", fixture.name);
            // ...and every heading is a line of the document (ignoring case and a colon).
            assert!(
                text_lines(&resume).iter().any(|line| {
                    line.trim_end_matches(':').to_lowercase() == heading.to_lowercase()
                }),
                "{}: heading {heading:?} is not a line of the resume",
                fixture.name
            );
        }
    }
}

#[test]
fn parsing_is_deterministic_and_ids_are_request_specific() {
    let pdf = fx::two_column(true).pdf;
    let a = parse(&pdf);
    let b = parse(&pdf);
    assert_eq!(a.text, b.text);
    assert_eq!(a.sections, b.sections);
    assert_ne!(
        a.id, b.id,
        "ids are random per request, not derived from content"
    );
    assert!(a.id.starts_with("resume-"));
}

#[test]
fn caller_supplied_id_and_filename_are_used_after_validation() {
    let options = ParseOptions::new()
        .with_id("resume-demo-001")
        .unwrap()
        .with_filename("C:\\private\\folder\\synthetic-resume.pdf");
    let resume = parse_resume(&fx::one_column().pdf, &options)
        .unwrap()
        .resume;
    assert_eq!(resume.id, "resume-demo-001");
    // Only the base name is kept; the directory is never echoed.
    assert_eq!(resume.filename.as_deref(), Some("synthetic-resume.pdf"));
}
