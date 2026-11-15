//! Wall-clock budget for a unit of work.
//!
//! **This is not a kill switch.** Rust cannot stop a running thread, so on timeout the worker
//! keeps running in the background until it finishes or the process ends. The command-line
//! program (`src/main.rs`) therefore exits the whole process as soon as the deadline passes;
//! that process exit is what actually guarantees the work stops. A server that links this
//! library directly, instead of spawning the program, does NOT get that guarantee.

use std::sync::mpsc;
use std::thread;
use std::time::Duration;

/// Stack for the worker thread. Deeply nested PDF objects recurse inside the PDF library; a
/// roomy stack keeps ordinary documents safe, and a pathological one still ends as a process
/// abort rather than memory corruption.
const WORKER_STACK_BYTES: usize = 16 * 1024 * 1024;

/// Run `work` on a separate thread and wait at most `timeout` for its result.
///
/// Returns `None` when the deadline passes first, when the worker panics, or when the thread
/// cannot be started.
pub fn run_with_deadline<T, F>(timeout: Duration, work: F) -> Option<T>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();
    thread::Builder::new()
        .name("resume-parser-worker".into())
        .stack_size(WORKER_STACK_BYTES)
        .spawn(move || {
            // The receiver may be gone after a timeout; that is fine.
            let _ = sender.send(work());
        })
        .ok()?;
    receiver.recv_timeout(timeout).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn returns_the_result_when_work_finishes_in_time() {
        assert_eq!(
            run_with_deadline(Duration::from_secs(5), || 21 * 2),
            Some(42)
        );
    }

    #[test]
    fn gives_up_at_the_deadline_without_waiting_for_slow_work() {
        let started = Instant::now();
        let result = run_with_deadline(Duration::from_millis(50), || {
            thread::sleep(Duration::from_secs(3));
            1
        });
        assert_eq!(result, None);
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "did not wait for the worker"
        );
    }

    #[test]
    fn a_panicking_worker_is_reported_as_no_result() {
        let result: Option<u8> = run_with_deadline(Duration::from_secs(5), || panic!("synthetic"));
        assert_eq!(result, None);
    }
}
