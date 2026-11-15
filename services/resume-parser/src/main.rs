//! `resume-parser`: PDF in, Resume JSON out. One document per process.
//!
//! Running each parse in its own short-lived process is the isolation boundary for untrusted
//! PDFs: this program enforces a wall-clock deadline by exiting, and a heap budget through a
//! counting allocator. See `docs/RESUME_INGESTION.md`.
//!
//! ```text
//! resume-parser [OPTIONS] < resume.pdf > resume.json
//!
//!   --input <PATH>         read the PDF from PATH instead of standard input
//!   --output <PATH>        write the JSON to a NEW file at PATH instead of standard output
//!   --filename <NAME>      display name to record as resume.filename
//!   --id <ID>              opaque id to use instead of a random one
//!   --timeout-ms <N>       time budget, 1..=60000 (default 10000)
//!   --max-memory-mib <N>   heap budget, 1..=1024 (default 256)
//!   --pretty               indent the JSON
//!   --help, --version
//! ```
//!
//! Exit status: `0` parsed (Resume JSON written); `1` document rejected (ApiError JSON
//! written); `2` usage or I/O problem (nothing written); `3` timed out (ApiError JSON
//! written). Any other status, or death by signal, means the process was aborted (for example
//! the heap budget was exceeded) and must be treated as `PARSING_FAILED`.
//!
//! Standard error only ever carries fixed diagnostic words (a reason slug or a usage hint):
//! never document text, a file name or a path.

use resume_parser::limits::{
    DEFAULT_MAX_MEMORY_MIB, DEFAULT_TIMEOUT_MS, MAX_MEMORY_MIB, MAX_PDF_BYTES, MAX_TIMEOUT_MS,
};
use resume_parser::{parse_resume_with_deadline, ParseError, ParseOptions};
use std::fs::{File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

mod heap_budget {
    //! A global allocator that refuses allocations beyond a fixed budget. A refused allocation
    //! makes Rust abort the process, which is the intended outcome for a PDF that tries to
    //! exhaust memory (for example a decompression bomb).
    #![allow(unsafe_code)]

    use std::alloc::{GlobalAlloc, Layout, System};
    use std::sync::atomic::{AtomicUsize, Ordering};

    static USED: AtomicUsize = AtomicUsize::new(0);
    static LIMIT: AtomicUsize = AtomicUsize::new(usize::MAX);

    pub struct Budgeted;

    pub fn set_limit_bytes(bytes: usize) {
        LIMIT.store(bytes, Ordering::Relaxed);
    }

    // SAFETY: every call is forwarded unchanged to the system allocator; this wrapper only
    // counts bytes and may return null, which `GlobalAlloc` permits to signal failure.
    unsafe impl GlobalAlloc for Budgeted {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            let size = layout.size();
            let before = USED.fetch_add(size, Ordering::Relaxed);
            if before.saturating_add(size) > LIMIT.load(Ordering::Relaxed) {
                USED.fetch_sub(size, Ordering::Relaxed);
                return std::ptr::null_mut();
            }
            // SAFETY: `layout` comes straight from the caller of `alloc`.
            let pointer = unsafe { System.alloc(layout) };
            if pointer.is_null() {
                USED.fetch_sub(size, Ordering::Relaxed);
            }
            pointer
        }

        unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
            // SAFETY: `pointer` was returned by `System.alloc` with this same `layout`.
            unsafe { System.dealloc(pointer, layout) };
            USED.fetch_sub(layout.size(), Ordering::Relaxed);
        }
    }
}

#[global_allocator]
static ALLOCATOR: heap_budget::Budgeted = heap_budget::Budgeted;

const EXIT_OK: u8 = 0;
const EXIT_REJECTED: u8 = 1;
const EXIT_USAGE: u8 = 2;
const EXIT_TIMEOUT: u8 = 3;

const USAGE: &str = "\
usage: resume-parser [--input PATH] [--output PATH] [--filename NAME] [--id ID]
                     [--timeout-ms N] [--max-memory-mib N] [--pretty]
Reads one PDF (standard input by default) and writes Resume JSON (standard output by default).
Exit status: 0 parsed, 1 document rejected, 2 usage or I/O problem, 3 timed out.";

struct Cli {
    input: Option<PathBuf>,
    output: Option<PathBuf>,
    options: ParseOptions,
    timeout: Duration,
    memory_bytes: usize,
    pretty: bool,
}

enum CliRequest {
    Run(Box<Cli>),
    Help,
    Version,
}

/// A usage problem, described with fixed words only (never the offending value).
struct UsageError(&'static str);

fn parse_args(args: impl Iterator<Item = String>) -> Result<CliRequest, UsageError> {
    let mut cli = Cli {
        input: None,
        output: None,
        options: ParseOptions::new(),
        timeout: Duration::from_millis(DEFAULT_TIMEOUT_MS),
        memory_bytes: DEFAULT_MAX_MEMORY_MIB * 1024 * 1024,
        pretty: false,
    };
    let mut args = args;
    while let Some(arg) = args.next() {
        let mut value = |missing: &'static str| args.next().ok_or(UsageError(missing));
        match arg.as_str() {
            "--help" | "-h" => return Ok(CliRequest::Help),
            "--version" | "-V" => return Ok(CliRequest::Version),
            "--pretty" => cli.pretty = true,
            "--input" => cli.input = Some(PathBuf::from(value("--input needs a path")?)),
            "--output" => cli.output = Some(PathBuf::from(value("--output needs a path")?)),
            "--filename" => {
                let name = value("--filename needs a name")?;
                cli.options = cli.options.with_filename(&name);
            }
            "--id" => {
                let id = value("--id needs a value")?;
                cli.options = cli.options.with_id(&id).map_err(|_| {
                    UsageError("--id must be 1 to 100 characters from A-Z a-z 0-9 . _ -")
                })?;
            }
            "--timeout-ms" => {
                let n: u64 = value("--timeout-ms needs a number")?
                    .parse()
                    .map_err(|_| UsageError("--timeout-ms needs a whole number"))?;
                if !(1..=MAX_TIMEOUT_MS).contains(&n) {
                    return Err(UsageError("--timeout-ms must be between 1 and 60000"));
                }
                cli.timeout = Duration::from_millis(n);
            }
            "--max-memory-mib" => {
                let n: usize = value("--max-memory-mib needs a number")?
                    .parse()
                    .map_err(|_| UsageError("--max-memory-mib needs a whole number"))?;
                if !(1..=MAX_MEMORY_MIB).contains(&n) {
                    return Err(UsageError("--max-memory-mib must be between 1 and 1024"));
                }
                cli.memory_bytes = n * 1024 * 1024;
            }
            _ => return Err(UsageError("unknown argument")),
        }
    }
    Ok(CliRequest::Run(Box::new(cli)))
}

/// Read at most the size limit plus one byte, so an oversized stream is detected without
/// buffering all of it.
fn read_bounded(reader: impl Read) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    match reader
        .take(MAX_PDF_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
    {
        Ok(_) => Ok(bytes),
        // The heap budget is smaller than the upload. Same outcome as running out of budget
        // later, inside the PDF library: the process is aborted.
        Err(error) if error.kind() == io::ErrorKind::OutOfMemory => {
            eprintln!("resume-parser: heap budget exceeded");
            std::process::abort()
        }
        Err(error) => Err(error),
    }
}

fn read_input(cli: &Cli) -> Result<Vec<u8>, &'static str> {
    match &cli.input {
        None => read_bounded(io::stdin().lock()).map_err(|_| "cannot read standard input"),
        Some(path) => {
            let file = File::open(path).map_err(|_| "cannot open the input file")?;
            let metadata = file
                .metadata()
                .map_err(|_| "cannot inspect the input file")?;
            if !metadata.is_file() {
                return Err("the input path is not a regular file");
            }
            read_bounded(file).map_err(|_| "cannot read the input file")
        }
    }
}

/// Write the JSON document. `--output` only ever creates a new file; it never overwrites.
fn write_output(cli: &Cli, json: &str) -> Result<(), &'static str> {
    match &cli.output {
        None => {
            let mut out = io::stdout().lock();
            out.write_all(json.as_bytes())
                .and_then(|()| out.write_all(b"\n"))
                .and_then(|()| out.flush())
                .map_err(|_| "cannot write to standard output")
        }
        Some(path) => {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(|_| "cannot create the output file (it must not already exist)")?;
            file.write_all(json.as_bytes())
                .and_then(|()| file.write_all(b"\n"))
                .map_err(|_| "cannot write the output file")
        }
    }
}

fn to_json<T: serde::Serialize>(value: &T, pretty: bool) -> Option<String> {
    if pretty {
        serde_json::to_string_pretty(value).ok()
    } else {
        serde_json::to_string(value).ok()
    }
}

fn usage_failure(message: &str) -> ExitCode {
    eprintln!("resume-parser: {message}");
    ExitCode::from(EXIT_USAGE)
}

fn main() -> ExitCode {
    // A panic message could quote document content; keep panics silent. Panics inside the PDF
    // library are caught by the parser and reported as PARSING_FAILED.
    std::panic::set_hook(Box::new(|_| {}));

    let cli = match parse_args(std::env::args().skip(1)) {
        Ok(CliRequest::Run(cli)) => cli,
        Ok(CliRequest::Help) => {
            println!("{USAGE}");
            return ExitCode::from(EXIT_OK);
        }
        Ok(CliRequest::Version) => {
            println!("resume-parser {}", env!("CARGO_PKG_VERSION"));
            return ExitCode::from(EXIT_OK);
        }
        Err(UsageError(message)) => {
            eprintln!("resume-parser: {message}\n{USAGE}");
            return ExitCode::from(EXIT_USAGE);
        }
    };

    heap_budget::set_limit_bytes(cli.memory_bytes);

    let bytes = match read_input(&cli) {
        Ok(bytes) => bytes,
        Err(message) => return usage_failure(message),
    };

    let outcome = parse_resume_with_deadline(bytes, cli.options.clone(), cli.timeout);
    let (json, status, reason) = match &outcome {
        Ok(envelope) => (to_json(envelope, cli.pretty), EXIT_OK, None),
        Err(error) => {
            let status = if *error == ParseError::Timeout {
                EXIT_TIMEOUT
            } else {
                EXIT_REJECTED
            };
            (
                to_json(&error.to_api_error(), cli.pretty),
                status,
                Some(error.reason()),
            )
        }
    };
    let Some(json) = json else {
        return usage_failure("cannot serialize the result");
    };
    if let Err(message) = write_output(&cli, &json) {
        return usage_failure(message);
    }
    if let Some(reason) = reason {
        eprintln!("resume-parser: rejected: {reason}");
    }
    // Returning from `main` ends the process, which also ends a worker that overran its
    // deadline. `std::process::exit` makes that explicit and skips waiting for anything.
    std::process::exit(i32::from(status));
}
