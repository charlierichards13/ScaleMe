import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { runParser, PROCESS_TIMEOUT_MS, MAX_OUTPUT_BYTES } from "./process";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
let child: EventEmitter & { stdin: PassThrough; stdout: PassThrough; kill: ReturnType<typeof vi.fn> };
const bytes = new TextEncoder().encode("%PDF-1.4\nsynthetic");
const binary = "/private/resume-parser";
const envelope = { resume: { id: "synthetic", text: "EXPERIENCE\nSynthetic work" } };
function start(signal = new AbortController().signal) {
  const release = vi.fn();
  const promise = runParser(bytes, binary, signal, release);
  return { promise, release };
}
function output(value: unknown, code = 0) {
  child.stdout.emit("data", Buffer.from(typeof value === "string" ? value : JSON.stringify(value)));
  child.emit("close", code);
}
beforeEach(() => {
  child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill: vi.fn(() => true) });
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe("bounded parser child", () => {
  it("pipes bytes to a fixed executable, with no shell or inherited secrets", async () => {
    const { promise, release } = start(); output(envelope);
    expect(await promise).toEqual(envelope.resume); expect(release).toHaveBeenCalledOnce();
    const [path, args, options] = vi.mocked(spawn).mock.calls[0];
    expect(path).toBe(binary); expect(args).toEqual(["--timeout-ms", "10000", "--max-memory-mib", "256"]);
    expect(options).toMatchObject({ shell: false, stdio: ["pipe", "pipe", "ignore"] });
    expect(Object.keys(options?.env ?? {})).not.toContain("AWS_ACCESS_KEY_ID");
    expect(child.stdin.read()).toEqual(Buffer.from(bytes));
  });
  it.each(["not json", { resume: { text: "bad" } }, null])("rejects invalid parser output without echoing it", async (data) => {
    const { promise } = start(); output(data); await expect(promise).rejects.toMatchObject({ status: 502, code: "PARSING_FAILED" });
  });
  it.each([["FILE_TOO_LARGE", 413], ["INVALID_FILE_TYPE", 415], ["NO_EXTRACTABLE_TEXT", 422], ["PARSING_FAILED", 422]] as const)("maps %s with a safe message", async (code, status) => {
    const { promise } = start(); output({ error: { code, message: "PRIVATE-CANARY" } }, 1);
    await expect(promise).rejects.toMatchObject({ status });
    await expect(promise).rejects.not.toHaveProperty("message", "PRIVATE-CANARY");
  });
  it("kills on timeout but does not release capacity before close", async () => {
    vi.useFakeTimers(); const { promise, release } = start();
    const assertion = expect(promise).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(PROCESS_TIMEOUT_MS + 1); await assertion;
    expect(child.kill).toHaveBeenCalledWith("SIGKILL"); expect(release).not.toHaveBeenCalled();
    child.emit("close", null); expect(release).toHaveBeenCalledOnce();
  });
  it("kills on caller cancellation and on excess output", async () => {
    const abort = new AbortController(); const a = start(abort.signal);
    abort.abort(); await expect(a.promise).rejects.toMatchObject({ status: 408 }); child.emit("close", null);
    const b = start(); child.stdout.emit("data", Buffer.alloc(MAX_OUTPUT_BYTES + 1));
    await expect(b.promise).rejects.toMatchObject({ status: 502 }); child.emit("close", null);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
  it("maps startup errors and process crashes without raw details", async () => {
    const a = start(); child.emit("error", new Error("PRIVATE-PATH")); child.emit("close", -1);
    await expect(a.promise).rejects.toMatchObject({ status: 503 });
    const b = start(); child.emit("close", null); await expect(b.promise).rejects.toMatchObject({ status: 502 });
  });
  it("fails closed when kill throws and retains the lease until actual close", async () => {
    vi.useFakeTimers(); child.kill.mockImplementation(() => { throw new Error("PRIVATE-OS-CANARY"); });
    const { promise, release } = start(); const assertion = expect(promise).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(PROCESS_TIMEOUT_MS + 1); await assertion;
    expect(release).not.toHaveBeenCalled(); child.emit("close", null); expect(release).toHaveBeenCalledOnce();
  });
  it("rejects relative paths and already-cancelled requests without spawning", async () => {
    const release = vi.fn(); const controller = new AbortController(); controller.abort();
    await expect(runParser(bytes, binary, controller.signal, release)).rejects.toMatchObject({ status: 408 });
    await expect(runParser(bytes, "relative-parser", new AbortController().signal, release)).rejects.toMatchObject({ status: 503 });
    expect(spawn).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledTimes(2);
  });
});
