//! Deterministic heading detection and section grouping.
//!
//! A keyword alone never makes a heading. A line is accepted as a section heading only when
//!
//! 1. it has the *shape* of a heading (short, on its own line, not a bullet, no sentence
//!    punctuation, no digits), and
//! 2. the whole line is a known heading name or alias (`PROFESSIONAL EXPERIENCE`,
//!    `Technical Skills`, ...), and
//! 3. independent layout evidence adds up: bold or larger type than the body text, capitals,
//!    extra space above, a trailing colon. A following line that starts in lower case counts
//!    against it (the "heading" was the start of a wrapped sentence).
//!
//! Unknown headings ("Things I Built") are accepted only when they are set in exactly the same
//! larger-than-body style as at least two confirmed headings.
//!
//! A line set in larger type than every heading is a document title (usually the candidate's
//! name). It ends the section above it, and the lines after it belong to no section until the
//! next heading. This matters in two-column resumes, where the name tops the second column.
//!
//! When no line qualifies, no sections are returned and the caller keeps the full text only.
//! Nothing here rewrites, infers or invents resume content: section text is the original
//! lines between two headings, joined with `\n`.

use crate::layout::{normalize_text, Line};
use crate::limits::MAX_SECTIONS;

/// What a recognised heading is about. Internal: the v0.1 contract has no field for it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SectionKind {
    Summary,
    Experience,
    Education,
    Projects,
    Skills,
    Certifications,
    Awards,
    Publications,
    Volunteering,
    Activities,
    Languages,
    Interests,
    References,
    Coursework,
    Contact,
}

/// A detected section: its heading line and the lines under it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DetectedSection {
    /// `None` for an unknown heading accepted by style alone.
    pub kind: Option<SectionKind>,
    /// Heading for display (see [`display_heading`]).
    pub heading: String,
    /// Index of the heading line in the input.
    pub heading_line: usize,
    /// The section's body: the original lines up to the next heading, joined with `\n`.
    pub text: String,
}

use SectionKind::*;

/// Known heading names, already normalized by [`normalize_heading`].
const ALIASES: &[(&str, SectionKind)] = &[
    ("summary", Summary),
    ("professional summary", Summary),
    ("career summary", Summary),
    ("executive summary", Summary),
    ("summary of qualifications", Summary),
    ("qualifications summary", Summary),
    ("profile", Summary),
    ("professional profile", Summary),
    ("career profile", Summary),
    ("about", Summary),
    ("about me", Summary),
    ("objective", Summary),
    ("career objective", Summary),
    ("overview", Summary),
    ("experience", Experience),
    ("work experience", Experience),
    ("professional experience", Experience),
    ("relevant experience", Experience),
    ("industry experience", Experience),
    ("internship experience", Experience),
    ("internships", Experience),
    ("research experience", Experience),
    ("teaching experience", Experience),
    ("employment", Experience),
    ("employment history", Experience),
    ("employment experience", Experience),
    ("work history", Experience),
    ("career history", Experience),
    ("professional background", Experience),
    ("education", Education),
    ("education and training", Education),
    ("education and certifications", Education),
    ("educational background", Education),
    ("academic background", Education),
    ("academic history", Education),
    ("academic qualifications", Education),
    ("academics", Education),
    ("projects", Projects),
    ("selected projects", Projects),
    ("personal projects", Projects),
    ("academic projects", Projects),
    ("technical projects", Projects),
    ("key projects", Projects),
    ("notable projects", Projects),
    ("side projects", Projects),
    ("project experience", Projects),
    ("skills", Skills),
    ("technical skills", Skills),
    ("core skills", Skills),
    ("key skills", Skills),
    ("skills and tools", Skills),
    ("skills and technologies", Skills),
    ("skills and abilities", Skills),
    ("technical skills and tools", Skills),
    ("tools and technologies", Skills),
    ("technologies", Skills),
    ("technical proficiencies", Skills),
    ("technical expertise", Skills),
    ("core competencies", Skills),
    ("competencies", Skills),
    ("areas of expertise", Skills),
    ("certifications", Certifications),
    ("certificates", Certifications),
    ("professional certifications", Certifications),
    ("licenses", Certifications),
    ("licenses and certifications", Certifications),
    ("certifications and licenses", Certifications),
    ("certifications and training", Certifications),
    ("courses and certifications", Certifications),
    ("training", Certifications),
    ("awards", Awards),
    ("honors", Awards),
    ("honors and awards", Awards),
    ("awards and honors", Awards),
    ("awards and achievements", Awards),
    ("honors and achievements", Awards),
    ("achievements", Awards),
    ("accomplishments", Awards),
    ("scholarships", Awards),
    ("publications", Publications),
    ("research", Publications),
    ("research and publications", Publications),
    ("publications and presentations", Publications),
    ("presentations", Publications),
    ("patents", Publications),
    ("volunteer", Volunteering),
    ("volunteering", Volunteering),
    ("volunteer work", Volunteering),
    ("volunteer experience", Volunteering),
    ("community service", Volunteering),
    ("community involvement", Volunteering),
    ("activities", Activities),
    ("extracurricular activities", Activities),
    ("leadership", Activities),
    ("leadership experience", Activities),
    ("leadership and activities", Activities),
    ("activities and leadership", Activities),
    ("involvement", Activities),
    ("campus involvement", Activities),
    ("organizations", Activities),
    ("affiliations", Activities),
    ("professional affiliations", Activities),
    ("memberships", Activities),
    ("languages", Languages),
    ("interests", Interests),
    ("hobbies", Interests),
    ("hobbies and interests", Interests),
    ("interests and hobbies", Interests),
    ("references", References),
    ("coursework", Coursework),
    ("relevant coursework", Coursework),
    ("courses", Coursework),
    ("contact", Contact),
    ("contact information", Contact),
    ("contact details", Contact),
    ("contact info", Contact),
    ("personal information", Contact),
    ("personal details", Contact),
];

/// Lower-case the line, turn `&` into "and", drop punctuation and collapse spaces. Letter-spaced
/// headings (`E X P E R I E N C E`) are closed up.
pub fn normalize_heading(text: &str) -> String {
    let mut cleaned = String::with_capacity(text.len());
    for ch in text.chars() {
        if ch == '&' {
            cleaned.push_str(" and ");
        } else if ch.is_alphanumeric() {
            cleaned.extend(ch.to_lowercase());
        } else if ch == '\'' || ch == '\u{2019}' {
            // apostrophes vanish: "Dean's" -> "deans"
        } else {
            cleaned.push(' ');
        }
    }
    let words: Vec<&str> = cleaned.split_whitespace().collect();
    if words.len() >= 4 && words.iter().all(|w| w.chars().count() == 1) {
        return words.concat();
    }
    words.join(" ")
}

/// The section kind when the WHOLE line is a known heading name, otherwise `None`.
/// `I have experience with Python` is not a match; `Work Experience:` is.
pub fn lookup_alias(text: &str) -> Option<SectionKind> {
    let key = normalize_heading(text);
    ALIASES
        .iter()
        .find(|(alias, _)| *alias == key)
        .map(|(_, kind)| *kind)
}

/// Whether the line could be a heading at all, whatever it says.
fn has_heading_shape(text: &str) -> bool {
    let trimmed = text.trim_end_matches(':').trim();
    let chars = trimmed.chars().count();
    let words = trimmed.split_whitespace().count();
    let letters = trimmed.chars().filter(|c| c.is_alphabetic()).count();
    let starts_like_bullet = trimmed.chars().next().is_some_and(|c| !c.is_alphanumeric());
    let sentence_end = trimmed.ends_with(['.', ',', ';', '!', '?']);
    (2..=48).contains(&chars)
        && words <= 6
        && letters >= 2
        && !starts_like_bullet
        && !sentence_end
        && !trimmed.chars().any(|c| c.is_ascii_digit())
}

fn is_all_caps(text: &str) -> bool {
    let cased: Vec<char> = text.chars().filter(|c| c.is_alphabetic()).collect();
    cased.len() >= 3
        && cased.iter().all(|c| !c.is_lowercase())
        && cased.iter().any(|c| c.is_uppercase())
}

/// First word and every word of four or more letters start with a capital.
fn is_title_case(text: &str) -> bool {
    let mut words = text
        .split_whitespace()
        .filter(|w| w.chars().any(char::is_alphabetic))
        .peekable();
    if words.peek().is_none() {
        return false;
    }
    words.enumerate().all(|(i, word)| {
        let first = word.chars().find(|c| c.is_alphabetic());
        let significant = i == 0 || word.chars().filter(|c| c.is_alphabetic()).count() >= 4;
        !significant || first.is_some_and(char::is_uppercase)
    })
}

fn starts_lowercase(text: &str) -> bool {
    text.chars().next().is_some_and(char::is_lowercase)
}

/// Font-size key in half points.
fn size_key(size: f32) -> i32 {
    (size * 2.0).round() as i32
}

struct BodyStyle {
    size_key: i32,
    bold: bool,
    /// Typical distance between consecutive lines.
    line_pitch: f32,
}

fn body_style(lines: &[Line]) -> BodyStyle {
    use std::collections::BTreeMap;
    let mut by_style: BTreeMap<(i32, bool), usize> = BTreeMap::new();
    for line in lines {
        *by_style
            .entry((size_key(line.size), line.bold))
            .or_default() += line.text.chars().count();
    }
    let (size_key, bold) = by_style
        .iter()
        .max_by_key(|&(style, count)| (*count, *style))
        .map_or((0, false), |(style, _)| *style);

    let mut gaps: Vec<f32> = lines
        .iter()
        .filter_map(|l| l.gap_above)
        .filter(|g| g.is_finite() && *g > 0.0)
        .collect();
    gaps.sort_by(f32::total_cmp);
    // Lower median: with equal numbers of body and heading gaps, the body pitch wins.
    let line_pitch = gaps
        .get(gaps.len().saturating_sub(1) / 2)
        .copied()
        .unwrap_or(0.0);

    BodyStyle {
        size_key,
        bold,
        line_pitch,
    }
}

/// Layout evidence for line `i`, excluding what the words say.
fn layout_score(lines: &[Line], i: usize, body: &BodyStyle) -> i32 {
    let line = &lines[i];
    let mut score = 0;
    if line.bold && !body.bold {
        score += 2;
    }
    if is_larger_than_body(line, body) {
        score += 2;
    }
    if is_all_caps(&line.text) {
        score += 2;
    } else if is_title_case(&line.text) {
        score += 1;
    }
    if body.line_pitch > 0.0
        && line
            .gap_above
            .is_some_and(|gap| gap >= 1.3 * body.line_pitch)
    {
        score += 1;
    }
    if line.text.trim_end().ends_with(':') {
        score += 1;
    }
    if lines
        .get(i + 1)
        .is_some_and(|next| starts_lowercase(&next.text))
    {
        score -= 2;
    }
    score
}

fn is_larger_than_body(line: &Line, body: &BodyStyle) -> bool {
    // PDF font sizes are untrusted. Float-to-i32 conversion saturates, but multiplying that
    // saturated key in i32 would still overflow on extreme values.
    body.size_key > 0 && i64::from(size_key(line.size)) * 10 >= i64::from(body.size_key) * 11
}

/// Evidence needed on top of an exact heading-name match.
const MIN_LAYOUT_SCORE: i32 = 2;

/// Indices of heading lines with their kind (`None` for unknown headings accepted by style).
pub fn find_headings(lines: &[Line]) -> Vec<(usize, Option<SectionKind>)> {
    let body = body_style(lines);

    let mut headings: Vec<(usize, Option<SectionKind>)> = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        if !has_heading_shape(&line.text) {
            continue;
        }
        if let Some(kind) = lookup_alias(&line.text) {
            if layout_score(lines, i, &body) >= MIN_LAYOUT_SCORE {
                headings.push((i, Some(kind)));
            }
        }
    }

    // Unknown headings: same larger-than-body style as two or more confirmed headings, and
    // only after the first confirmed heading (so the candidate's name is not mistaken for one).
    let style_of = |l: &Line| (size_key(l.size), l.bold, is_all_caps(&l.text));
    let mut styles: Vec<(i32, bool, bool)> =
        headings.iter().map(|(i, _)| style_of(&lines[*i])).collect();
    styles.sort_unstable();
    let shared_style = styles
        .chunk_by(|a, b| a == b)
        .filter(|group| group.len() >= 2)
        .max_by_key(|group| group.len())
        .map(|group| group[0]);

    if let (Some(style), Some(&(first, _))) = (shared_style, headings.first()) {
        let mut confirmed = vec![false; lines.len()];
        for (i, _) in &headings {
            confirmed[*i] = true;
        }
        for (i, line) in lines.iter().enumerate().skip(first + 1) {
            if confirmed[i]
                || style_of(line) != style
                || !is_larger_than_body(line, &body)
                || !has_heading_shape(&line.text)
                || lines
                    .get(i + 1)
                    .is_some_and(|next| starts_lowercase(&next.text))
            {
                continue;
            }
            headings.push((i, None));
        }
        headings.sort_unstable_by_key(|(i, _)| *i);
    }
    headings
}

/// Heading text for `sections[].heading`.
///
/// The candidate's own wording is kept. Only two things change: a trailing colon is removed,
/// and a KNOWN heading written in capitals is shown in title case (`EDUCATION` -> `Education`,
/// `LICENSES & CERTIFICATIONS` -> `Licenses & Certifications`), matching the contract example.
/// Unknown headings are never re-cased, so acronyms in them are safe.
pub fn display_heading(text: &str, kind: Option<SectionKind>) -> String {
    let trimmed = normalize_text(text.trim().trim_end_matches(':'));
    if kind.is_none() || !is_all_caps(&trimmed) {
        return trimmed;
    }
    let mut words: Vec<String> = trimmed.split_whitespace().map(str::to_string).collect();
    if words.len() >= 4 && words.iter().all(|w| w.chars().count() == 1) {
        words = vec![words.concat()]; // letter-spaced: "S K I L L S"
    }
    words
        .iter()
        .enumerate()
        .map(|(i, word)| {
            let lower = word.to_lowercase();
            if i > 0 && matches!(lower.as_str(), "and" | "of" | "the" | "in" | "for" | "to") {
                return lower;
            }
            let mut chars = lower.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => lower,
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Group lines under detected headings. Returns `None` when no heading was found or when there
/// are more sections than the contract allows (detection is then treated as unreliable).
///
/// Lines before the first heading (typically the name and contact details) and lines after a
/// title line belong to no section; they are still in the full text.
pub fn detect_sections(lines: &[Line]) -> Option<Vec<DetectedSection>> {
    let headings = find_headings(lines);
    if headings.is_empty() || headings.len() > MAX_SECTIONS {
        return None;
    }
    // Largest type used by any heading; anything larger is a title, not section content.
    let heading_size = headings
        .iter()
        .map(|(i, _)| size_key(lines[*i].size))
        .max()
        .unwrap_or(i32::MAX);
    let mut sections = Vec::with_capacity(headings.len());
    for (n, &(index, kind)) in headings.iter().enumerate() {
        let next_heading = headings.get(n + 1).map_or(lines.len(), |(next, _)| *next);
        let end = (index + 1..next_heading)
            .find(|&i| size_key(lines[i].size) > heading_size)
            .unwrap_or(next_heading);
        let text = lines[index + 1..end]
            .iter()
            .map(|l| l.text.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        sections.push(DetectedSection {
            kind,
            heading: display_heading(&lines[index].text, kind),
            heading_line: index,
            text,
        });
    }
    Some(sections)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Body line: 10 pt regular, normal spacing.
    fn body(text: &str) -> Line {
        Line {
            text: text.to_string(),
            page: 1,
            x: 56.0,
            y: 0.0,
            size: 10.0,
            bold: false,
            gap_above: Some(13.5),
        }
    }

    /// Typical heading: 12 pt bold with extra space above.
    fn styled(text: &str) -> Line {
        Line {
            size: 12.0,
            bold: true,
            gap_above: Some(24.0),
            ..body(text)
        }
    }

    fn headings_of(lines: &[Line]) -> Vec<&str> {
        find_headings(lines)
            .iter()
            .map(|(i, _)| lines[*i].text.as_str())
            .collect()
    }

    #[test]
    fn extreme_font_sizes_do_not_overflow_heading_detection() {
        let lines = [
            Line {
                size: f32::MAX,
                ..styled("EXPERIENCE")
            },
            Line {
                size: f32::MAX,
                ..body("Synthetic work description")
            },
        ];
        let sections = detect_sections(&lines).unwrap();
        assert_eq!(sections[0].text, "Synthetic work description");
    }

    #[test]
    fn alias_lookup_needs_the_whole_line() {
        assert_eq!(lookup_alias("EXPERIENCE"), Some(Experience));
        assert_eq!(lookup_alias("Work Experience:"), Some(Experience));
        assert_eq!(
            lookup_alias("  professional   experience "),
            Some(Experience)
        );
        assert_eq!(
            lookup_alias("Licenses & Certifications"),
            Some(Certifications)
        );
        assert_eq!(lookup_alias("Technical Skills"), Some(Skills));
        assert_eq!(lookup_alias("E D U C A T I O N"), Some(Education));
        assert_eq!(lookup_alias("Projects"), Some(Projects));
        assert_eq!(lookup_alias("I have experience with Python"), None);
        assert_eq!(lookup_alias("Experience with Python"), None);
        assert_eq!(lookup_alias("Education matters"), None);
        assert_eq!(lookup_alias("Skills: Python, SQL"), None);
        assert_eq!(lookup_alias(""), None);
    }

    #[test]
    fn styled_headings_are_detected_and_grouped() {
        let lines = vec![
            Line {
                size: 18.0,
                bold: true,
                gap_above: None,
                ..body("Jordan Example")
            },
            body("jordan.example@example.com"),
            styled("EDUCATION"),
            body("B.S. Computer Science"),
            styled("PROFESSIONAL EXPERIENCE"),
            body("Intern, Synthetic Systems Co."),
            body("\u{2022} Built a dashboard."),
            styled("Technical Skills"),
            body("Python, SQL"),
        ];
        let sections = detect_sections(&lines).unwrap();
        let summary: Vec<(&str, &str, Option<SectionKind>)> = sections
            .iter()
            .map(|s| (s.heading.as_str(), s.text.as_str(), s.kind))
            .collect();
        assert_eq!(
            summary,
            [
                ("Education", "B.S. Computer Science", Some(Education)),
                (
                    "Professional Experience",
                    "Intern, Synthetic Systems Co.\n\u{2022} Built a dashboard.",
                    Some(Experience)
                ),
                ("Technical Skills", "Python, SQL", Some(Skills)),
            ]
        );
    }

    #[test]
    fn keyword_inside_a_sentence_is_not_a_heading() {
        let lines = vec![
            styled("SUMMARY"),
            body("I have experience with Python and SQL."),
            body("My education focused on databases"),
            body("Skills I am building include public speaking"),
            body("\u{2022} Experience design workshop for students"),
            body("Projects: reviewed student code."),
        ];
        assert_eq!(headings_of(&lines), ["SUMMARY"]);
    }

    #[test]
    fn a_bare_keyword_without_layout_evidence_is_not_a_heading() {
        // One-word-per-line skill list in body style: "Leadership" and "Research" are also
        // heading names, but nothing sets them apart from their neighbours.
        let lines = vec![
            styled("SKILLS"),
            body("Python"),
            body("Leadership"),
            body("Research"),
            body("Training"),
        ];
        assert_eq!(headings_of(&lines), ["SKILLS"]);
    }

    #[test]
    fn a_keyword_that_starts_a_wrapped_sentence_is_not_a_heading() {
        let lines = vec![
            body("Jordan Example"),
            Line {
                gap_above: Some(24.0),
                ..body("Education")
            },
            body("matters to me, so I mentor first-year students."),
        ];
        assert!(find_headings(&lines).is_empty());
        assert_eq!(detect_sections(&lines), None);
    }

    #[test]
    fn plain_text_resume_headings_need_capitals_or_spacing() {
        // Same font everywhere. ALL CAPS on its own line is enough...
        let caps = vec![
            body("Jordan Example"),
            body("EDUCATION"),
            body("B.S. Computer Science"),
        ];
        assert_eq!(headings_of(&caps), ["EDUCATION"]);
        // ...so is Title Case with clear space above...
        let spaced = vec![
            body("Jordan Example"),
            body("Example City"),
            Line {
                gap_above: Some(27.0),
                ..body("Education")
            },
            body("B.S. Computer Science"),
        ];
        assert_eq!(headings_of(&spaced), ["Education"]);
        // ...and so is a trailing colon. Title Case alone is not.
        let colon = vec![body("Jordan Example"), body("Skills:"), body("Python, SQL")];
        assert_eq!(headings_of(&colon), ["Skills:"]);
        let bare = vec![body("Jordan Example"), body("Skills"), body("Python, SQL")];
        assert!(find_headings(&bare).is_empty());
    }

    #[test]
    fn unknown_headings_need_the_style_of_two_confirmed_headings() {
        let lines = vec![
            Line {
                size: 12.0,
                bold: true,
                gap_above: None,
                ..body("Jordan Example")
            },
            styled("Experience"),
            body("Intern, Synthetic Systems Co."),
            styled("Things I Built"),
            body("Campus Events Finder"),
            styled("Education"),
            body("Example State University"),
        ];
        // "Jordan Example" has the same style but comes before the first confirmed heading.
        assert_eq!(
            find_headings(&lines),
            [(1, Some(Experience)), (3, None), (5, Some(Education))]
        );
        let sections = detect_sections(&lines).unwrap();
        assert_eq!(sections[1].heading, "Things I Built");
        assert_eq!(sections[1].text, "Campus Events Finder");

        // With only ONE confirmed heading there is no style to compare against.
        let single = &lines[..5];
        assert_eq!(find_headings(single), [(1, Some(Experience))]);
    }

    #[test]
    fn bold_body_sized_lines_are_not_promoted_to_unknown_headings() {
        // Headings are bold caps at body size; bold job titles must not become sections.
        let heading = |t: &str| Line {
            bold: true,
            gap_above: Some(24.0),
            ..body(t)
        };
        let lines = vec![
            heading("EXPERIENCE"),
            Line {
                bold: true,
                ..body("SENIOR ENGINEER")
            },
            body("Did synthetic work for a fictional company over a long period of time."),
            heading("EDUCATION"),
            body("Example State University, with a long descriptive line of body text."),
        ];
        assert_eq!(headings_of(&lines), ["EXPERIENCE", "EDUCATION"]);
    }

    #[test]
    fn heading_shape_rejects_bullets_sentences_digits_and_long_lines() {
        assert!(has_heading_shape("EXPERIENCE"));
        assert!(has_heading_shape("Licenses & Certifications:"));
        assert!(!has_heading_shape("\u{2022} Experience"));
        assert!(!has_heading_shape("- Projects"));
        assert!(!has_heading_shape("Experience."));
        assert!(!has_heading_shape("Experience 2024"));
        assert!(!has_heading_shape("X"));
        assert!(!has_heading_shape(
            "This is far too long to be a section heading in any resume at all"
        ));
    }

    #[test]
    fn display_heading_keeps_wording_and_only_fixes_known_capitals() {
        assert_eq!(display_heading("EDUCATION", Some(Education)), "Education");
        assert_eq!(
            display_heading("LICENSES & CERTIFICATIONS:", Some(Certifications)),
            "Licenses & Certifications"
        );
        assert_eq!(
            display_heading("SUMMARY OF QUALIFICATIONS", Some(Summary)),
            "Summary of Qualifications"
        );
        assert_eq!(display_heading("S K I L L S", Some(Skills)), "Skills");
        assert_eq!(
            display_heading("Technical skills", Some(Skills)),
            "Technical skills"
        );
        // Unknown headings are never re-cased.
        assert_eq!(display_heading("AWS & GCP LABS", None), "AWS & GCP LABS");
    }

    #[test]
    fn a_title_larger_than_the_headings_ends_the_section_above_it() {
        // Reading order of a two-column resume: sidebar, then the main column whose first
        // line is the candidate's name.
        let lines = vec![
            styled("SKILLS"),
            body("Python"),
            Line {
                size: 18.0,
                bold: true,
                gap_above: None,
                ..body("Jordan Example")
            },
            body("Backend developer"),
            styled("EXPERIENCE"),
            body("Intern, Synthetic Systems Co."),
        ];
        let sections = detect_sections(&lines).unwrap();
        let pairs: Vec<(&str, &str)> = sections
            .iter()
            .map(|s| (s.heading.as_str(), s.text.as_str()))
            .collect();
        // Neither the name nor the tagline under it is filed under Skills.
        assert_eq!(
            pairs,
            [
                ("Skills", "Python"),
                ("Experience", "Intern, Synthetic Systems Co.")
            ]
        );
    }

    #[test]
    fn no_headings_means_no_sections() {
        let lines = vec![
            body("Jordan Example"),
            body("I am a student."),
            body("I like Python."),
        ];
        assert_eq!(detect_sections(&lines), None);
        assert_eq!(detect_sections(&[]), None);
    }

    #[test]
    fn empty_and_repeated_sections_are_kept_as_written() {
        let lines = vec![
            styled("EXPERIENCE"),
            styled("EDUCATION"),
            body("B.S."),
            styled("EXPERIENCE"),
        ];
        let sections = detect_sections(&lines).unwrap();
        let pairs: Vec<(&str, &str)> = sections
            .iter()
            .map(|s| (s.heading.as_str(), s.text.as_str()))
            .collect();
        assert_eq!(
            pairs,
            [
                ("Experience", ""),
                ("Education", "B.S."),
                ("Experience", "")
            ]
        );
    }

    #[test]
    fn too_many_sections_are_treated_as_unreliable() {
        let mut lines = Vec::new();
        for _ in 0..=MAX_SECTIONS {
            lines.push(styled("PROJECTS"));
            lines.push(body("A fictional project."));
        }
        assert_eq!(find_headings(&lines).len(), MAX_SECTIONS + 1);
        assert_eq!(detect_sections(&lines), None);
    }
}
