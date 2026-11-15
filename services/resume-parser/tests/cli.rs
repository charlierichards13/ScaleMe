//! Process-level behaviour of the `resume-parser` program: the documented stdin/stdout
//! interface, exit statuses, resource budgets, and the absence of side effects.

mod support;

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use support::fixtures as fx;

const BIN: &str = env!("CARGO_BIN_EXE_resume-parser");

/// A fresh, empty directory under Cargo's per-target temporary area.
fn scratch_dir(name: &str) -> PathBuf {
    let dir = Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("cli-{name}"));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

/// Run the program with `stdin` piped in. The working directory and every temp-dir variable
/// point at `dir`, so any file the program wrote would show up there.
fn run_in(dir: &Path, args: &[&str], stdin: &[u8]) -> Output {
    let mut child = Command::new(BIN)
        .args(args)
        .current_dir(dir)
        .env("TMP", dir)
        .env("TEMP", dir)
        .env("TMPDIR", dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("resume-parser should start");
    let mut pipe = child.stdin.take().unwrap();
    let input = stdin.to_vec();
    // Feed stdin from another thread: the program may stop reading early (size limit).
    let writer = std::thread::spawn(move || {
        let _ = pipe.write_all(&input);
    });
    let output = child.wait_with_output().unwrap();
    let _ = writer.join();
    output
}

fn stdout_json(output: &Output) -> serde_json::Value {
    serde_json::from_slice(&output.stdout).expect("stdout should be one JSON document")
}

fn stderr_text(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

fn entries(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

#[test]
fn pdf_on_stdin_gives_resume_json_on_stdout() {
    let dir = scratch_dir("stdin-stdout");
    let output = run_in(
        &dir,
        &[
            "--id",
            "resume-demo-001",
            "--filename",
            "synthetic-resume.pdf",
        ],
        &fx::one_column().pdf,
    );
    assert_eq!(output.status.code(), Some(0));
    assert!(output.stderr.is_empty(), "no diagnostics on success");

    let json = stdout_json(&output);
    // The web contract test validates this exact JSON against the current ResumeSchema.
    let golden: serde_json::Value =
        serde_json::from_str(include_str!("golden/synthetic-one-column.json")).unwrap();
    assert_eq!(
        json, golden,
        "the actual CLI output must match the Zod-checked fixture"
    );
    assert_eq!(json.as_object().unwrap().len(), 1);
    let resume = &json["resume"];
    assert_eq!(resume["id"], "resume-demo-001");
    assert_eq!(resume["filename"], "synthetic-resume.pdf");
    assert!(resume["text"]
        .as_str()
        .unwrap()
        .starts_with("Jordan Example\n"));
    assert_eq!(resume["sections"][0]["heading"], "Education");
    assert_eq!(resume["sections"].as_array().unwrap().len(), 5);
    // Compact by default: exactly one line.
    assert_eq!(
        String::from_utf8_lossy(&output.stdout)
            .trim_end()
            .lines()
            .count(),
        1
    );
}

#[test]
fn nothing_is_written_to_disk_unless_an_output_path_is_given() {
    let dir = scratch_dir("no-persistence");
    for (input, expected_status) in [
        (fx::one_column().pdf, 0),
        (fx::multi_page().pdf, 0),
        (fx::image_only(), 1),
        (fx::truncated(), 1),
        (b"not a pdf".to_vec(), 1),
    ] {
        let output = run_in(&dir, &[], &input);
        assert_eq!(output.status.code(), Some(expected_status));
        assert_eq!(
            entries(&dir),
            Vec::<String>::new(),
            "working and temp directories must stay empty"
        );
    }
}

#[test]
fn explicit_input_and_output_paths() {
    let dir = scratch_dir("files");
    let input = dir.join("synthetic-input.pdf");
    fs::write(&input, fx::one_column().pdf).unwrap();

    let output = run_in(
        &dir,
        &[
            "--input",
            "synthetic-input.pdf",
            "--output",
            "result.json",
            "--pretty",
        ],
        b"",
    );
    assert_eq!(output.status.code(), Some(0));
    assert!(
        output.stdout.is_empty(),
        "JSON went to the file, not stdout"
    );
    assert_eq!(entries(&dir), ["result.json", "synthetic-input.pdf"]);

    let written = fs::read_to_string(dir.join("result.json")).unwrap();
    let json: serde_json::Value = serde_json::from_str(&written).unwrap();
    assert_eq!(json["resume"]["sections"][1]["heading"], "Experience");
    // The input path is NOT copied into the output unless --filename is given.
    assert!(json["resume"].get("filename").is_none());
    assert!(written.lines().count() > 5, "--pretty indents");

    // A second run must not overwrite the existing file.
    let again = run_in(
        &dir,
        &["--input", "synthetic-input.pdf", "--output", "result.json"],
        b"",
    );
    assert_eq!(again.status.code(), Some(2));
    assert!(stderr_text(&again).contains("must not already exist"));
    assert_eq!(
        fs::read_to_string(dir.join("result.json")).unwrap(),
        written
    );
}

#[test]
fn rejected_documents_exit_1_with_an_api_error() {
    let dir = scratch_dir("rejected");
    let cases: [(Vec<u8>, &str, &str); 7] = [
        (Vec::new(), "INVALID_FILE_TYPE", "empty_file"),
        (
            b"plain text resume".to_vec(),
            "INVALID_FILE_TYPE",
            "not_a_pdf",
        ),
        (fx::truncated(), "PARSING_FAILED", "corrupted_pdf"),
        (
            fx::image_only(),
            "NO_EXTRACTABLE_TEXT",
            "no_extractable_text",
        ),
        (fx::password_protected(), "PARSING_FAILED", "encrypted_pdf"),
        (fx::many_pages(21), "FILE_TOO_LARGE", "too_many_pages"),
        (fx::long_text(31_000), "FILE_TOO_LARGE", "text_too_long"),
    ];
    for (input, code, reason) in cases {
        let output = run_in(&dir, &[], &input);
        assert_eq!(output.status.code(), Some(1), "{reason}");
        let json = stdout_json(&output);
        assert_eq!(json["error"]["code"], code, "{reason}");
        assert_eq!(json["error"]["retryable"], false);
        assert!(json["error"]["message"]
            .as_str()
            .is_some_and(|m| !m.is_empty()));
        assert!(json.get("resume").is_none());
        // Standard error is exactly one fixed line naming the reason.
        assert_eq!(
            stderr_text(&output).trim_end(),
            format!("resume-parser: rejected: {reason}")
        );
    }
}

#[test]
fn oversized_stdin_is_rejected_without_reading_it_all() {
    let dir = scratch_dir("oversized");
    // 6 MiB of valid-looking PDF: one megabyte past the limit.
    let big = fx::padded_to(6 * 1024 * 1024);
    let output = run_in(&dir, &[], &big);
    assert_eq!(output.status.code(), Some(1));
    assert_eq!(stdout_json(&output)["error"]["code"], "FILE_TOO_LARGE");
    assert_eq!(
        stderr_text(&output).trim_end(),
        "resume-parser: rejected: file_too_large"
    );
}

#[test]
fn output_never_leaks_content_of_a_rejected_document() {
    let dir = scratch_dir("leak");
    // Over the text limit: every line of this document is unique synthetic filler.
    let output = run_in(
        &dir,
        &["--filename", "private-name-CANARY.pdf"],
        &fx::long_text(31_000),
    );
    assert_eq!(output.status.code(), Some(1));
    let all = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        stderr_text(&output)
    );
    assert!(
        !all.contains("Synthetic filler sentence"),
        "document text leaked"
    );
    assert!(!all.contains("CANARY"), "file name leaked");
}

#[test]
fn filename_flag_is_reduced_to_a_base_name() {
    let dir = scratch_dir("filename");
    let output = run_in(
        &dir,
        &["--filename", "../../secret/dir/Jordan Example Resume.pdf"],
        &fx::no_headings().pdf,
    );
    assert_eq!(output.status.code(), Some(0));
    let json = stdout_json(&output);
    assert_eq!(json["resume"]["filename"], "Jordan Example Resume.pdf");
    assert!(json["resume"].get("sections").is_none());
    // The name is only echoed; nothing was created from it.
    assert_eq!(entries(&dir), Vec::<String>::new());
}

#[test]
fn usage_errors_exit_2_and_never_echo_the_bad_value() {
    let dir = scratch_dir("usage");
    for args in [
        vec!["--bogus-SECRETVALUE"],
        vec!["--id", "bad id SECRETVALUE"],
        vec!["--timeout-ms", "0"],
        vec!["--timeout-ms", "SECRETVALUE"],
        vec!["--max-memory-mib", "999999"],
        vec!["--input"],
        vec!["--input", "missing-SECRETVALUE.pdf"],
    ] {
        let output = run_in(&dir, &args, b"");
        assert_eq!(output.status.code(), Some(2), "{args:?}");
        assert!(output.stdout.is_empty());
        let stderr = stderr_text(&output);
        assert!(stderr.starts_with("resume-parser: "));
        assert!(!stderr.contains("SECRETVALUE"), "{stderr}");
    }
    assert_eq!(entries(&dir), Vec::<String>::new());
}

#[test]
fn help_and_version() {
    let dir = scratch_dir("help");
    let help = run_in(&dir, &["--help"], b"");
    assert_eq!(help.status.code(), Some(0));
    assert!(String::from_utf8_lossy(&help.stdout).contains("usage: resume-parser"));
    let version = run_in(&dir, &["--version"], b"");
    assert_eq!(version.status.code(), Some(0));
    assert!(String::from_utf8_lossy(&version.stdout).starts_with("resume-parser 0."));
}

#[test]
fn time_budget_ends_the_process_with_status_3() {
    let dir = scratch_dir("timeout");
    // About 28,000 characters of text cannot be parsed in one millisecond.
    let output = run_in(&dir, &["--timeout-ms", "1"], &fx::long_text(28_000));
    assert_eq!(output.status.code(), Some(3));
    let json = stdout_json(&output);
    assert_eq!(json["error"]["code"], "PARSING_FAILED");
    assert_eq!(
        stderr_text(&output).trim_end(),
        "resume-parser: rejected: timeout"
    );
    assert_eq!(entries(&dir), Vec::<String>::new());
}

#[test]
fn heap_budget_aborts_the_process_instead_of_growing() {
    let dir = scratch_dir("memory");
    // A 3 MiB upload cannot even be buffered inside a 1 MiB heap budget.
    let output = run_in(
        &dir,
        &["--max-memory-mib", "1"],
        &fx::padded_to(3 * 1024 * 1024),
    );
    assert!(!output.status.success());
    assert!(
        !matches!(output.status.code(), Some(0..=3)),
        "an aborted process must not look like a normal result: {:?}",
        output.status
    );
    assert!(output.stdout.is_empty(), "no partial JSON");
    assert!(
        !stderr_text(&output).contains("padding"),
        "no document content in diagnostics"
    );

    // The same document parses under the default budget.
    let ok = run_in(&dir, &[], &fx::padded_to(3 * 1024 * 1024));
    assert_eq!(ok.status.code(), Some(0));
    assert_eq!(entries(&dir), Vec::<String>::new());
}

#[test]
fn heap_budget_also_stops_the_pdf_library_mid_parse() {
    let dir = scratch_dir("memory-parse");
    // Small enough to be read into a 1 MiB budget (about 120 KB), but its 800 objects need
    // more than that once the PDF library builds its object table.
    let many_objects = fx::many_pages(400);
    assert!(many_objects.len() < 200 * 1024);

    let output = run_in(&dir, &["--max-memory-mib", "1"], &many_objects);
    assert!(
        !matches!(output.status.code(), Some(0..=3)),
        "expected an abort, got {:?}",
        output.status
    );
    assert!(output.stdout.is_empty(), "no partial JSON");
    assert!(stderr_text(&output).contains("memory allocation"));
    assert!(!stderr_text(&output).contains("Synthetic page"));

    // With the default budget the same file gets an ordinary, explained rejection.
    let normal = run_in(&dir, &[], &many_objects);
    assert_eq!(normal.status.code(), Some(1));
    assert_eq!(
        stderr_text(&normal).trim_end(),
        "resume-parser: rejected: too_many_pages"
    );
}
