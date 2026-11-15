//! Turns positioned text fragments into reading-order lines.
//!
//! This is deterministic geometry with no knowledge of PDF internals, so every rule is tested
//! with hand-built fragments. The guiding rule: **never drop a fragment**. When the layout is
//! ambiguous the text is kept in simple top-to-bottom, left-to-right order.
//!
//! Supported layouts:
//! * one column,
//! * two columns separated by a clear vertical gutter, optionally under a full-width header
//!   block (name and contact line) and above a short full-width footer,
//! * rows with a right-aligned part such as dates (kept on the row they belong to).
//!
//! Known limits (see `docs/RESUME_INGESTION.md`): three or more columns, columns that start
//! partway down a page below more than eight full-width rows, and two columns whose lines sit
//! on the same baselines without a recognisable heading on each side are read row by row.

use crate::extract::Fragment;
use crate::sections::lookup_alias;
use std::collections::BTreeMap;

/// One visual line of text.
#[derive(Clone, Debug, PartialEq)]
pub struct Line {
    /// Whitespace-normalized text. Never empty.
    pub text: String,
    pub page: u32,
    /// Left edge of the first fragment.
    pub x: f32,
    /// Baseline.
    pub y: f32,
    /// Font size used by most of the line's characters.
    pub size: f32,
    /// `true` when most of the line's characters are bold.
    pub bold: bool,
    /// Distance to the previous line in the same column, when there is one.
    pub gap_above: Option<f32>,
}

/// Narrowest empty vertical band accepted as a column gutter, in points.
const MIN_GUTTER: f32 = 12.0;
/// A column must have at least this many lines on each side of the gutter.
const MIN_COLUMN_ROWS: usize = 3;
/// Full-width rows that may sit above / below a two-column body.
const MAX_HEADER_ROWS: usize = 8;
const MAX_FOOTER_ROWS: usize = 2;
/// Baselines closer than this (points) count as the same row when comparing two columns.
const SHARED_BASELINE_TOLERANCE: f32 = 0.75;
/// Only the widest few empty bands are considered, which bounds the work on hostile pages.
const MAX_GUTTER_CANDIDATES: usize = 8;

/// Collapse every run of whitespace or control characters into one space and trim the ends.
/// Zero-width space and the byte-order mark are removed. Nothing else is changed: no case
/// folding, no punctuation or ligature rewriting, no Unicode normalization.
pub fn normalize_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut pending_space = false;
    for ch in s.chars() {
        if ch == '\u{200B}' || ch == '\u{FEFF}' {
            continue;
        }
        if ch.is_whitespace() || ch.is_control() {
            pending_space = true;
            continue;
        }
        if pending_space && !out.is_empty() {
            out.push(' ');
        }
        pending_space = false;
        out.push(ch);
    }
    out
}

/// Build reading-order lines for the whole document.
pub fn build_lines(fragments: Vec<Fragment>) -> Vec<Line> {
    let mut pages: BTreeMap<u32, Vec<Fragment>> = BTreeMap::new();
    for f in fragments {
        if normalize_text(&f.text).is_empty() {
            continue; // whitespace-only run: carries no content
        }
        pages.entry(f.page).or_default().push(f);
    }

    let mut lines = Vec::new();
    for (page, frags) in pages {
        let (positioned, loose): (Vec<Fragment>, Vec<Fragment>) =
            frags.into_iter().partition(is_positioned);

        let rows = cluster_rows(positioned);
        match find_columns(&rows) {
            Some(split) => {
                let body_end = rows.len() - split.footer_rows;
                let mut left = Vec::new();
                let mut right = Vec::new();
                for row in &rows[split.header_rows..body_end] {
                    for f in &row.frags {
                        if center(f) < split.gutter {
                            left.push(f.clone());
                        } else {
                            right.push(f.clone());
                        }
                    }
                }
                push_rows(&mut lines, page, &rows[..split.header_rows]);
                push_rows(&mut lines, page, &cluster_rows(left));
                push_rows(&mut lines, page, &cluster_rows(right));
                push_rows(&mut lines, page, &rows[body_end..]);
            }
            None => push_rows(&mut lines, page, &rows),
        }

        // Rotated runs and runs without usable coordinates cannot be placed on a row. They are
        // kept, each on its own line, after the page's ordinary text.
        for f in loose {
            let text = normalize_text(&f.text);
            lines.push(Line {
                text,
                page,
                x: 0.0,
                y: 0.0,
                size: if f.size.is_finite() { f.size } else { 0.0 },
                bold: f.bold,
                gap_above: None,
            });
        }
    }
    lines
}

fn is_positioned(f: &Fragment) -> bool {
    f.horizontal
        && f.x.is_finite()
        && f.y.is_finite()
        && f.width.is_finite()
        && f.size.is_finite()
        && f.size > 0.0
}

/// Advance width, estimated at half an em per character when the font gave none.
fn width_of(f: &Fragment) -> f32 {
    if f.width > 0.0 {
        f.width
    } else {
        0.5 * f.size * f.text.chars().count() as f32
    }
}

fn center(f: &Fragment) -> f32 {
    f.x + width_of(f) / 2.0
}

#[derive(Clone, Debug)]
struct Row {
    y: f32,
    size: f32,
    frags: Vec<Fragment>,
}

/// Group fragments that share a baseline, top row first, each row sorted left to right.
fn cluster_rows(mut frags: Vec<Fragment>) -> Vec<Row> {
    frags.sort_by(|a, b| b.y.total_cmp(&a.y));
    let mut rows: Vec<Row> = Vec::new();
    for f in frags {
        match rows.last_mut() {
            Some(row) if (row.y - f.y).abs() <= (0.35 * row.size.min(f.size)).max(0.5) => {
                row.size = row.size.min(f.size);
                row.frags.push(f);
            }
            _ => rows.push(Row {
                y: f.y,
                size: f.size,
                frags: vec![f],
            }),
        }
    }
    for row in &mut rows {
        row.frags.sort_by(|a, b| a.x.total_cmp(&b.x));
    }
    rows
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct ColumnSplit {
    header_rows: usize,
    footer_rows: usize,
    gutter: f32,
}

/// Look for a two-column body, trying the fewest full-width header/footer rows first.
fn find_columns(rows: &[Row]) -> Option<ColumnSplit> {
    let mut trims: Vec<(usize, usize)> = Vec::new();
    for header in 0..=MAX_HEADER_ROWS {
        for footer in 0..=MAX_FOOTER_ROWS {
            trims.push((header, footer));
        }
    }
    trims.sort_by_key(|&(h, f)| (h + f, f));

    for (header_rows, footer_rows) in trims {
        if header_rows + footer_rows + MIN_COLUMN_ROWS > rows.len() {
            continue; // not enough rows left for two columns
        }
        let body = &rows[header_rows..rows.len() - footer_rows];
        if let Some(gutter) = gutter_for(body) {
            return Some(ColumnSplit {
                header_rows,
                footer_rows,
                gutter,
            });
        }
    }
    None
}

/// Find a vertical band that no fragment touches and that really separates two columns.
fn gutter_for(body: &[Row]) -> Option<f32> {
    let frags: Vec<&Fragment> = body.iter().flat_map(|r| r.frags.iter()).collect();
    if frags.len() < 2 * MIN_COLUMN_ROWS {
        return None;
    }

    // Horizontal extents covered by text, merged.
    let mut spans: Vec<(f32, f32)> = frags.iter().map(|f| (f.x, f.x + width_of(f))).collect();
    spans.sort_by(|a, b| a.0.total_cmp(&b.0));
    let mut merged: Vec<(f32, f32)> = Vec::new();
    for (start, end) in spans {
        match merged.last_mut() {
            Some(last) if start <= last.1 + 1.0 => last.1 = last.1.max(end),
            _ => merged.push((start, end)),
        }
    }

    let mut gaps: Vec<(f32, f32)> = merged
        .windows(2)
        .map(|w| (w[0].1, w[1].0))
        .filter(|(a, b)| b - a >= MIN_GUTTER)
        .collect();
    gaps.sort_by(|a, b| (b.1 - b.0).total_cmp(&(a.1 - a.0))); // widest first

    for (a, b) in gaps.into_iter().take(MAX_GUTTER_CANDIDATES) {
        let gutter = (a + b) / 2.0;
        let (left, right): (Vec<&Fragment>, Vec<&Fragment>) =
            frags.iter().partition(|f| center(f) < gutter);
        let left_rows = cluster_rows(left.into_iter().cloned().collect());
        let right_rows = cluster_rows(right.into_iter().cloned().collect());
        if left_rows.len() < MIN_COLUMN_ROWS || right_rows.len() < MIN_COLUMN_ROWS {
            continue;
        }

        // Right-aligned dates, tab stops and tables also leave an empty band, but there each
        // right-hand piece sits on the same baseline as a left-hand piece. Independent columns
        // rarely line up like that. When most rows do line up, only accept the split if BOTH
        // sides carry a known section heading (a sidebar set on the same line grid).
        let shared = shared_baselines(&left_rows, &right_rows);
        let smaller = left_rows.len().min(right_rows.len());
        let mostly_shared = shared * 10 >= smaller * 6;
        if mostly_shared && !(has_known_heading(&left_rows) && has_known_heading(&right_rows)) {
            continue;
        }
        return Some(gutter);
    }
    None
}

/// Number of left rows that have a right row on (almost) the same baseline. Both inputs are
/// sorted top to bottom, so one pass is enough.
fn shared_baselines(left: &[Row], right: &[Row]) -> usize {
    let (mut l, mut r, mut shared) = (0, 0, 0);
    while l < left.len() && r < right.len() {
        let difference = left[l].y - right[r].y;
        if difference.abs() <= SHARED_BASELINE_TOLERANCE {
            shared += 1;
            l += 1;
        } else if difference > 0.0 {
            l += 1; // the left row is higher on the page
        } else {
            r += 1;
        }
    }
    shared
}

fn has_known_heading(rows: &[Row]) -> bool {
    rows.iter()
        .any(|row| lookup_alias(&row_text(&row.frags)).is_some())
}

/// Join a row's fragments, inserting one space where there is a visible gap.
fn row_text(frags: &[Fragment]) -> String {
    let mut text = String::new();
    let mut prev: Option<&Fragment> = None;
    for f in frags {
        if let Some(p) = prev {
            let size = p.size.min(f.size);
            // The same text painted twice at (almost) the same spot is a fake-bold effect.
            if f.text == p.text && (f.x - p.x).abs() < 0.12 * size {
                continue;
            }
            let gap = f.x - (p.x + width_of(p));
            let touching =
                text.ends_with(char::is_whitespace) || f.text.starts_with(char::is_whitespace);
            if gap > 0.12 * size && !touching {
                text.push(' ');
            }
        }
        text.push_str(&f.text);
        prev = Some(f);
    }
    normalize_text(&text)
}

fn push_rows(lines: &mut Vec<Line>, page: u32, rows: &[Row]) {
    let mut previous_y: Option<f32> = None;
    for row in rows {
        let text = row_text(&row.frags);
        if text.is_empty() {
            continue;
        }
        let (size, bold) = dominant_style(&row.frags);
        lines.push(Line {
            text,
            page,
            x: row.frags.first().map_or(0.0, |f| f.x),
            y: row.y,
            size,
            bold,
            gap_above: previous_y.map(|py| py - row.y),
        });
        previous_y = Some(row.y);
    }
}

/// Font size and weight carried by most of the row's non-space characters.
fn dominant_style(frags: &[Fragment]) -> (f32, bool) {
    let mut by_size: BTreeMap<i32, usize> = BTreeMap::new();
    let (mut bold_chars, mut total_chars) = (0usize, 0usize);
    for f in frags {
        let n = f.text.chars().filter(|c| !c.is_whitespace()).count();
        *by_size.entry((f.size * 2.0).round() as i32).or_default() += n;
        total_chars += n;
        if f.bold {
            bold_chars += n;
        }
    }
    let size_key = by_size
        .iter()
        .max_by_key(|&(key, count)| (*count, *key))
        .map_or(0, |(key, _)| *key);
    (size_key as f32 / 2.0, bold_chars * 2 > total_chars)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frag(page: u32, x: f32, y: f32, text: &str) -> Fragment {
        Fragment {
            page,
            x,
            y,
            // 5 pt per character: close to 10 pt Helvetica.
            width: 5.0 * text.chars().count() as f32,
            size: 10.0,
            bold: false,
            horizontal: true,
            text: text.to_string(),
        }
    }

    fn texts(lines: &[Line]) -> Vec<&str> {
        lines.iter().map(|l| l.text.as_str()).collect()
    }

    #[test]
    fn normalize_collapses_whitespace_and_keeps_everything_else() {
        assert_eq!(normalize_text("  a \t b\u{a0}\u{a0}c \r\n d  "), "a b c d");
        assert_eq!(normalize_text("a\u{0}b\u{7}c"), "a b c"); // control characters
        assert_eq!(normalize_text("zero\u{200B}width\u{FEFF}"), "zerowidth");
        // Punctuation, case, accents, ligatures, emoji and joiners are untouched.
        let kept = "\u{2022} Jos\u{e9} \u{2013} C++/C# \u{fb01}x 100% \u{1f469}\u{200d}\u{1f4bb}";
        assert_eq!(normalize_text(kept), kept);
        assert_eq!(normalize_text(" \t\n"), "");
    }

    #[test]
    fn words_positioned_separately_are_joined_with_single_spaces() {
        let lines = build_lines(vec![
            frag(1, 100.0, 700.0, "Engineering"),
            frag(1, 50.0, 700.0, "Software"),
            frag(1, 160.0, 700.0, "Intern"),
        ]);
        assert_eq!(texts(&lines), ["Software Engineering Intern"]);
    }

    #[test]
    fn adjacent_pieces_of_one_word_are_not_split() {
        // "Soft" ends exactly where "ware" starts (kerned pieces of one word).
        let lines = build_lines(vec![
            frag(1, 50.0, 700.0, "Soft"),
            frag(1, 70.0, 700.0, "ware"),
        ]);
        assert_eq!(texts(&lines), ["Software"]);
    }

    #[test]
    fn existing_spaces_are_not_doubled() {
        let lines = build_lines(vec![
            frag(1, 50.0, 700.0, "Python, "),
            frag(1, 100.0, 700.0, "SQL"),
        ]);
        assert_eq!(texts(&lines), ["Python, SQL"]);
    }

    #[test]
    fn fake_bold_double_painting_is_not_duplicated() {
        let lines = build_lines(vec![
            frag(1, 50.0, 700.0, "EXPERIENCE"),
            frag(1, 50.3, 700.0, "EXPERIENCE"),
        ]);
        assert_eq!(texts(&lines), ["EXPERIENCE"]);
        // The same word twice on a row at different places is real content and is kept.
        let lines = build_lines(vec![
            frag(1, 50.0, 700.0, "very"),
            frag(1, 75.0, 700.0, "very"),
        ]);
        assert_eq!(texts(&lines), ["very very"]);
    }

    #[test]
    fn lines_run_top_to_bottom_and_pages_in_order() {
        let lines = build_lines(vec![
            frag(2, 50.0, 700.0, "page two"),
            frag(1, 50.0, 600.0, "second"),
            frag(1, 50.0, 700.0, "first"),
        ]);
        assert_eq!(texts(&lines), ["first", "second", "page two"]);
        assert_eq!(lines[0].gap_above, None);
        assert_eq!(lines[1].gap_above, Some(100.0));
        assert_eq!(lines[2].gap_above, None); // new page
    }

    #[test]
    fn superscript_sized_baseline_wobble_stays_on_the_row() {
        let lines = build_lines(vec![
            frag(1, 50.0, 700.0, "Dean's List"),
            frag(1, 110.0, 702.0, "(2024)"),
        ]);
        assert_eq!(texts(&lines), ["Dean's List (2024)"]);
    }

    fn two_column_fragments(right_offset: f32) -> Vec<Fragment> {
        let left = ["SKILLS", "Python", "SQL", "Docker"];
        let right = [
            "EXPERIENCE",
            "Backend Intern, Synthetic Systems Co.",
            "Built REST endpoints.",
            "EDUCATION",
        ];
        let mut v = Vec::new();
        // Interleave the two columns the way a row-by-row content stream would.
        for i in 0..4 {
            v.push(frag(1, 40.0, 700.0 - 14.0 * i as f32, left[i]));
            v.push(frag(
                1,
                240.0,
                700.0 - right_offset - 14.0 * i as f32,
                right[i],
            ));
        }
        v
    }

    #[test]
    fn two_columns_are_read_one_after_the_other() {
        let lines = build_lines(two_column_fragments(5.0));
        assert_eq!(
            texts(&lines),
            [
                "SKILLS",
                "Python",
                "SQL",
                "Docker",
                "EXPERIENCE",
                "Backend Intern, Synthetic Systems Co.",
                "Built REST endpoints.",
                "EDUCATION"
            ]
        );
    }

    #[test]
    fn columns_on_the_same_line_grid_split_when_both_have_known_headings() {
        let lines = build_lines(two_column_fragments(0.0));
        assert_eq!(
            texts(&lines)[..5],
            ["SKILLS", "Python", "SQL", "Docker", "EXPERIENCE"]
        );
    }

    #[test]
    fn aligned_columns_without_headings_fall_back_to_rows_and_keep_all_text() {
        // Documented limitation: indistinguishable from a table, so it is read row by row.
        let mut v = Vec::new();
        for (i, (l, r)) in [
            ("Python", "Docker"),
            ("SQL", "Kubernetes"),
            ("Git", "Terraform"),
        ]
        .iter()
        .enumerate()
        {
            v.push(frag(1, 40.0, 700.0 - 14.0 * i as f32, l));
            v.push(frag(1, 240.0, 700.0 - 14.0 * i as f32, r));
        }
        let lines = build_lines(v);
        assert_eq!(
            texts(&lines),
            ["Python Docker", "SQL Kubernetes", "Git Terraform"]
        );
    }

    #[test]
    fn right_aligned_dates_stay_on_their_row() {
        let rows = [
            (
                "Software Engineering Intern, Synthetic Systems Co.",
                Some("Jun 2025 \u{2013} Aug 2025"),
            ),
            ("\u{2022} Built an internal scheduling dashboard.", None),
            (
                "Lab Assistant, Example State University",
                Some("2024 \u{2013} 2025"),
            ),
            ("\u{2022} Maintained lab workstations.", None),
            ("Tutor, Example Public Library", Some("2023 \u{2013} 2024")),
            ("\u{2022} Tutored algebra.", None),
        ];
        let mut v = Vec::new();
        for (i, (left, right)) in rows.iter().enumerate() {
            let y = 700.0 - 14.0 * i as f32;
            v.push(frag(1, 56.0, y, left));
            if let Some(r) = right {
                let w = 5.0 * r.chars().count() as f32;
                v.push(frag(1, 556.0 - w, y, r));
            }
        }
        let lines = build_lines(v);
        assert_eq!(
            texts(&lines),
            [
                "Software Engineering Intern, Synthetic Systems Co. Jun 2025 \u{2013} Aug 2025",
                "\u{2022} Built an internal scheduling dashboard.",
                "Lab Assistant, Example State University 2024 \u{2013} 2025",
                "\u{2022} Maintained lab workstations.",
                "Tutor, Example Public Library 2023 \u{2013} 2024",
                "\u{2022} Tutored algebra."
            ]
        );
    }

    #[test]
    fn full_width_header_and_footer_do_not_hide_the_columns() {
        let mut v = vec![
            frag(
                1,
                40.0,
                760.0,
                "Jordan Example, a deliberately long full-width header line here",
            ),
            frag(
                1,
                40.0,
                746.0,
                "jordan.example@example.com | (555) 010-0199 | Example City, EX",
            ),
        ];
        v.extend(two_column_fragments(5.0));
        v.push(frag(
            1,
            40.0,
            100.0,
            "References available on request from the fictional candidate.",
        ));
        let lines = build_lines(v);
        let t = texts(&lines);
        assert!(t[0].starts_with("Jordan Example"));
        assert!(t[1].starts_with("jordan.example@"));
        assert_eq!(t[2..6], ["SKILLS", "Python", "SQL", "Docker"]);
        assert_eq!(t[6], "EXPERIENCE");
        assert!(t.last().unwrap().starts_with("References available"));
        assert_eq!(t.len(), 11);
    }

    #[test]
    fn rotated_and_unpositioned_runs_are_kept_not_dropped() {
        let mut rotated = frag(1, 20.0, 400.0, "Rotated margin note");
        rotated.horizontal = false;
        let mut nan = frag(1, f32::NAN, 500.0, "No usable position");
        nan.width = 10.0;
        let mut zero_size = frag(1, 50.0, 300.0, "Zero size");
        zero_size.size = 0.0;
        let lines = build_lines(vec![rotated, nan, frag(1, 50.0, 700.0, "Body"), zero_size]);
        assert_eq!(
            texts(&lines),
            [
                "Body",
                "Rotated margin note",
                "No usable position",
                "Zero size"
            ]
        );
    }

    #[test]
    fn whitespace_only_fragments_produce_no_lines() {
        assert!(build_lines(vec![
            frag(1, 50.0, 700.0, "   "),
            frag(1, 50.0, 680.0, "\u{a0}")
        ])
        .is_empty());
        assert!(build_lines(Vec::new()).is_empty());
    }

    #[test]
    fn line_style_follows_most_of_its_characters() {
        let mut title = frag(1, 56.0, 700.0, "Software Engineering Intern");
        title.bold = true;
        let date = frag(1, 500.0, 700.0, "2025");
        let lines = build_lines(vec![title, date]);
        assert!(lines[0].bold);
        assert_eq!(lines[0].size, 10.0);
    }

    #[test]
    fn every_non_space_character_survives_layout() {
        let mut frags = two_column_fragments(5.0);
        frags.push(frag(2, 50.0, 700.0, "\u{2022} caf\u{e9} \u{1f680}"));
        let count = |s: &str| s.chars().filter(|c| !c.is_whitespace()).count();
        let before: usize = frags.iter().map(|f| count(&f.text)).sum();
        let after: usize = build_lines(frags).iter().map(|l| count(&l.text)).sum();
        assert_eq!(before, after);
    }
}
