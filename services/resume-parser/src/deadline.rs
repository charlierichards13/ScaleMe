//! Wall-clock budget for a unit of work.
//!
//! **This is not a kill switch.** Rust cannot stop a running thread, so on timeout the worker
//! keeps running in the background until it finishes or the process ends. The command-line
//! program (`src/main.rs`) therefore exits the whole process as soon as the deadline passes;
//! that process exit is what actually guarantees the work stops. A server that links this
//! library directly, instead of spawning the program, does NOT get that guarantee.

use crate::ParseError;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::Duration;

/// Stack for the worker thread. Deeply nested PDF objects recurse inside the PDF library; a
/// roomy stack keeps ordinary documents safe, and a pathological one still ends as a process
/// abort rather than memory corruption.
const WORKER_STACK_BYTES: usize = 16 * 1024 * 1024;

/// Run `work` on a separate thread and wait at most `timeout` for its result.
///
/// Returns `Timeout` only when the deadline expires. A disconnected worker (including a
/// panic) or failure to start the thread returns the content-free `Internal` error.
pub fn run_with_deadline<T, F>(timeout: Duration, work: F) -> Result<T, ParseError>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    run_with_deadline_using(timeout, work, |worker| {
        thread::Builder::new()
            .name("resume-parser-worker".into())
            .stack_size(WORKER_STACK_BYTES)
            .spawn(worker)
            .map(|_| ())
    })
}

// Inject the spawner privately to test failure without exhausting OS resources.
fn run_with_deadline_using<T, F>(
    timeout: Duration,
    work: F,
    spawn: impl FnOnce(Box<dyn FnOnce() + Send>) -> std::io::Result<()>,
) -> Result<T, ParseError>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();
    spawn(Box::new(move || {
        // The receiver may be gone after a timeout; that is fine.
        let _ = sender.send(work());
    }))
    .map_err(|_| ParseError::Internal)?;
    receiver.recv_timeout(timeout).map_err(|error| match error {
        RecvTimeoutError::Timeout => ParseError::Timeout,
        RecvTimeoutError::Disconnected => ParseError::Internal,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn returns_the_result_when_work_finishes_in_time() {
        assert_eq!(run_with_deadline(Duration::from_secs(5), || 21 * 2), Ok(42));
    }

    #[test]
    fn gives_up_at_the_deadline_without_waiting_for_slow_work() {
        let started = Instant::now();
        let result = run_with_deadline(Duration::from_millis(50), || {
            thread::sleep(Duration::from_secs(3));
            1
        });
        assert_eq!(result, Err(ParseError::Timeout));
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "did not wait for the worker"
        );
    }

    #[test]
    fn a_panicking_worker_is_an_internal_error_without_its_payload() {
        let result: Result<u8, _> =
            run_with_deadline(Duration::from_secs(5), || panic!("PRIVATE-PANIC-CANARY"));
        assert_eq!(result, Err(ParseError::Internal));
        assert!(!serde_json::to_string(&result.unwrap_err().to_api_error())
            .unwrap()
            .contains("PRIVATE-PANIC-CANARY"));
    }

    #[test]
    fn a_spawn_failure_is_an_internal_error_without_os_details() {
        let result: Result<u8, _> = run_with_deadline_using(
            Duration::from_secs(5),
            || panic!("work must not run after spawn failure"),
            |_worker| Err(std::io::Error::other("PRIVATE-SPAWN-CANARY")),
        );
        assert_eq!(result, Err(ParseError::Internal));
        assert!(!serde_json::to_string(&result.unwrap_err().to_api_error())
            .unwrap()
            .contains("PRIVATE-SPAWN-CANARY"));
    }
}
