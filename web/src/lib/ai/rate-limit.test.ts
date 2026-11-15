import { beforeEach, describe, expect, it } from "vitest";
import { FitCallLimiter, getSharedFitLimiter, RateLimitedError, resetSharedFitLimiter } from "./rate-limit";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function limiter(opts: Partial<{ globalPerMinute: number; dailyLimit: number; maxConcurrent: number }> = {}) {
  const clock = { t: 1_000_000 };
  const l = new FitCallLimiter({
    globalPerMinute: 10,
    dailyLimit: 50,
    maxConcurrent: 2,
    ...opts,
    now: () => clock.t,
  });
  return { l, clock };
}

// Acquire and immediately release (a completed call).
function completeCall(l: FitCallLimiter) {
  const d = l.tryAcquire();
  if (d.allowed) d.release();
  return d;
}

describe("FitCallLimiter", () => {
  it("allows a burst up to the per-minute limit, then rejects with a Retry-After", () => {
    const { l } = limiter();
    for (let i = 0; i < 10; i++) expect(completeCall(l).allowed).toBe(true);
    const d = l.tryAcquire();
    expect(d).toMatchObject({ allowed: false, reason: "minute" });
    if (!d.allowed) expect(d.retryAfterSeconds).toBe(60);
  });

  it("uses a sliding minute window: a slot frees exactly when the oldest call ages out", () => {
    const { l, clock } = limiter({ globalPerMinute: 2 });
    completeCall(l); // t0
    clock.t += 20_000;
    completeCall(l); // t0 + 20 s
    clock.t += 10_000; // t0 + 30 s
    const d = l.tryAcquire();
    expect(d).toMatchObject({ allowed: false, reason: "minute", retryAfterSeconds: 30 });
    clock.t += 30_000; // t0 + 60 s: first call has left the window
    expect(completeCall(l).allowed).toBe(true);
    expect(l.tryAcquire()).toMatchObject({ allowed: false, reason: "minute" });
  });

  it("enforces the daily cap across minutes and resets after 24 hours", () => {
    const { l, clock } = limiter({ dailyLimit: 3 });
    for (let i = 0; i < 3; i++) {
      expect(completeCall(l).allowed).toBe(true);
      clock.t += 2 * MIN;
    }
    const d = l.tryAcquire();
    expect(d).toMatchObject({ allowed: false, reason: "day" });
    if (!d.allowed) expect(d.retryAfterSeconds).toBe((DAY - 6 * MIN) / 1000);
    clock.t += DAY;
    expect(completeCall(l).allowed).toBe(true);
    expect(l.stats().callsLast24h).toBe(1); // old entries were evicted (bounded memory)
  });

  it("caps concurrent calls and frees a slot on release", () => {
    const { l } = limiter({ maxConcurrent: 2 });
    const a = l.tryAcquire();
    const b = l.tryAcquire();
    expect(a.allowed && b.allowed).toBe(true);
    expect(l.tryAcquire()).toMatchObject({ allowed: false, reason: "concurrency", retryAfterSeconds: 5 });
    if (a.allowed) a.release();
    expect(l.tryAcquire().allowed).toBe(true);
  });

  it("release is idempotent: a double release cannot free another caller's slot", () => {
    const { l } = limiter({ maxConcurrent: 1 });
    const a = l.tryAcquire();
    if (!a.allowed) throw new Error("expected allowed");
    a.release();
    a.release();
    expect(l.stats().inFlight).toBe(0);
    const b = l.tryAcquire();
    expect(b.allowed).toBe(true);
    a.release(); // stale release while b is running
    expect(l.tryAcquire()).toMatchObject({ allowed: false, reason: "concurrency" });
  });

  it("rejected attempts do not use up any budget", () => {
    const { l } = limiter({ maxConcurrent: 1, dailyLimit: 2 });
    const a = l.tryAcquire();
    for (let i = 0; i < 20; i++) expect(l.tryAcquire().allowed).toBe(false);
    expect(l.stats()).toEqual({ inFlight: 1, callsLast24h: 1 });
    if (a.allowed) a.release();
    expect(completeCall(l).allowed).toBe(true);
  });

  it("checks the daily cap before the minute and concurrency limits", () => {
    const { l } = limiter({ dailyLimit: 1, globalPerMinute: 1, maxConcurrent: 1 });
    l.tryAcquire(); // holds the only slot
    expect(l.tryAcquire()).toMatchObject({ allowed: false, reason: "day" });
  });
});

describe("shared limiter", () => {
  beforeEach(() => resetSharedFitLimiter());

  it("is shared across calls and rebuilt only when limits change", () => {
    const opts = { globalPerMinute: 10, dailyLimit: 50, maxConcurrent: 2 };
    const a = getSharedFitLimiter(opts);
    expect(getSharedFitLimiter({ ...opts })).toBe(a);
    expect(getSharedFitLimiter({ ...opts, dailyLimit: 5 })).not.toBe(a);
  });

  it("RateLimitedError is a safe, generic, retryable 429", () => {
    const day = new RateLimitedError("day", 100);
    const conc = new RateLimitedError("concurrency", 5);
    expect(day).toMatchObject({ code: "RATE_LIMITED", status: 429, retryable: true });
    expect(day.message).toBe(conc.message); // reason is not revealed to the caller
  });
});
