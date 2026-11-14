// Cost guard for paid Bedrock calls: one SHARED ANONYMOUS budget for all callers.
//
// LOCAL-ONLY PROTECTION. State lives in this Node.js process's memory:
// - each server instance (or serverless cold start) has its own counters, and they reset on restart;
// - there is no per-user fairness: one caller can use up the whole budget for everyone.
// We deliberately do NOT read X-Forwarded-For or similar headers: any client can forge them.
// Production-safe limits need an enforcement point shared by all instances (a trusted gateway/WAF
// or a shared store) plus AWS budget alarms. See docs/security/THREAT_MODEL.md.
//
// Every admitted call counts against the minute and day budgets whether it succeeds or not,
// because a failed or timed-out model call may still be billed.

import { FitApiError } from "./schemas";

export type LimitReason = "concurrency" | "minute" | "day";

export type LimitDecision =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: LimitReason; retryAfterSeconds: number };

export type LimiterOptions = {
  globalPerMinute: number;
  dailyLimit: number;
  maxConcurrent: number;
  now?: () => number;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// A busy slot usually frees up within one model call; suggest a short wait.
const CONCURRENCY_RETRY_SECONDS = 5;

export class FitCallLimiter {
  private inFlight = 0;
  // Start times of admitted calls in the last 24 h (sliding windows). Bounded by dailyLimit.
  private starts: number[] = [];
  private readonly now: () => number;

  constructor(private readonly opts: LimiterOptions) {
    this.now = opts.now ?? (() => Date.now());
  }

  /**
   * Check every limit and, only if all pass, reserve a slot. Synchronous, so check-and-reserve
   * cannot interleave with another request on the single-threaded event loop.
   */
  tryAcquire(): LimitDecision {
    const now = this.now();
    while (this.starts.length && this.starts[0] <= now - DAY_MS) this.starts.shift();

    if (this.starts.length >= this.opts.dailyLimit) {
      return { allowed: false, reason: "day", retryAfterSeconds: secondsUntil(this.starts[0] + DAY_MS, now) };
    }

    const minuteStart = now - MINUTE_MS;
    const lastMinute = this.starts.filter((t) => t > minuteStart);
    if (lastMinute.length >= this.opts.globalPerMinute) {
      // The window frees a slot when the oldest call in it turns one minute old.
      const freeAt = lastMinute[lastMinute.length - this.opts.globalPerMinute] + MINUTE_MS;
      return { allowed: false, reason: "minute", retryAfterSeconds: secondsUntil(freeAt, now) };
    }

    if (this.inFlight >= this.opts.maxConcurrent) {
      return { allowed: false, reason: "concurrency", retryAfterSeconds: CONCURRENCY_RETRY_SECONDS };
    }

    this.starts.push(now);
    this.inFlight++;
    let released = false;
    return {
      allowed: true,
      release: () => {
        // Idempotent: a double release must never free someone else's slot.
        if (released) return;
        released = true;
        this.inFlight--;
      },
    };
  }

  /** For tests and diagnostics only; contains no caller data. */
  stats(): { inFlight: number; callsLast24h: number } {
    return { inFlight: this.inFlight, callsLast24h: this.starts.length };
  }
}

function secondsUntil(at: number, now: number): number {
  return Math.max(1, Math.ceil((at - now) / 1000));
}

// One shared limiter per process. Rebuilt only if the configured limits change.
let shared: { key: string; limiter: FitCallLimiter } | undefined;

export function getSharedFitLimiter(opts: Omit<LimiterOptions, "now">): FitCallLimiter {
  const key = `${opts.globalPerMinute}/${opts.dailyLimit}/${opts.maxConcurrent}`;
  if (shared?.key !== key) shared = { key, limiter: new FitCallLimiter(opts) };
  return shared.limiter;
}

/** Test helper: forget all counters. */
export function resetSharedFitLimiter(): void {
  shared = undefined;
}

export class RateLimitedError extends FitApiError {
  constructor(
    public reason: LimitReason,
    public retryAfterSeconds: number,
  ) {
    // One generic message for every reason, so callers learn nothing about how limits are set.
    super(
      "RATE_LIMITED",
      "Too many analysis requests right now. Please wait and retry, or use the labeled demo.",
      true,
      429,
    );
    this.name = "RateLimitedError";
  }
}
