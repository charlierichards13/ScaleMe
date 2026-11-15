import { afterEach, describe, expect, it, vi } from "vitest";
import { createUploadTask } from "./upload-task";
import type { Resume } from "@/lib/ai/schemas";
import type { uploadResume } from "./client";

const pdf = () => new File(["%PDF-1.7\nsynthetic"], "synthetic.pdf", { type: "application/pdf" });
const parsed: Resume = { id: "synthetic", text: "EXPERIENCE\nBuilt a fictional tool", sections: [{ heading: "Experience", text: "Built a fictional tool" }] };
afterEach(() => vi.useRealTimers());

describe("shared explicit upload operation", () => {
  it("selects locally, publishes only after explicit extraction, and clears on replacement/removal", async () => {
    const publish = vi.fn(); const upload = vi.fn().mockResolvedValue(parsed);
    const task = createUploadTask(publish, upload);
    await task.select(pdf());
    expect(upload).not.toHaveBeenCalled(); expect(task.getSnapshot().phase).toBe("ready");
    await task.extract("private-test-code");
    expect(upload).toHaveBeenCalledOnce(); expect(publish).toHaveBeenLastCalledWith(parsed);
    expect(task.getSnapshot().phase).toBe("success");
    await task.select(pdf()); expect(publish).toHaveBeenLastCalledWith(null);
    task.clear(); expect(task.getSnapshot().file).toBeNull(); expect(publish).toHaveBeenLastCalledWith(null);
  });

  it.each([new File([], "empty.pdf"), new File(["renamed"], "fake.pdf"), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf")])("rejects invalid/oversized selection and clears stale results", async (file) => {
    const publish = vi.fn(); const upload = vi.fn(); const task = createUploadTask(publish, upload);
    expect(await task.select(file)).toBe(false); expect(task.getSnapshot().phase).toBe("error");
    expect(publish).toHaveBeenLastCalledWith(null); expect(upload).not.toHaveBeenCalled();
  });

  it("explains missing access without sending a request", async () => {
    const upload = vi.fn(); const task = createUploadTask(vi.fn(), upload);
    await task.select(pdf()); await task.extract("");
    expect(task.getSnapshot().message).toContain("project owner"); expect(upload).not.toHaveBeenCalled();
  });

  it.each(["Private uploads are disabled or the parser is unavailable.", "The private upload access code was not accepted.", "The parser took too long. Try a simpler PDF."])("retains a retryable file and safe failure: %s", async (message) => {
    const publish = vi.fn(); const task = createUploadTask(publish, vi.fn().mockRejectedValue(new Error(message)));
    await task.select(pdf()); await task.extract("code");
    expect(task.getSnapshot()).toMatchObject({ phase: "error", message });
    expect(task.getSnapshot().file).not.toBeNull(); expect(publish).toHaveBeenLastCalledWith(null);
  });

  it.each(["cancel", "clear", "dispose"] as const)("%s aborts and ignores late successful responses", async (action) => {
    let resolve!: (resume: Resume) => void;
    const upload = vi.fn<typeof uploadResume>(() => new Promise<Resume>((done) => { resolve = done; }));
    const publish = vi.fn(); const task = createUploadTask(publish, upload);
    await task.select(pdf()); const pending = task.extract("code");
    expect(task.getSnapshot().phase).toBe("processing");
    task[action](); resolve(parsed); await pending;
    expect(publish).not.toHaveBeenCalledWith(parsed);
    expect(upload.mock.calls[0][2].aborted).toBe(true);
  });

  it("bounds a stalled transport and rejects a late result", async () => {
    vi.useFakeTimers(); let resolve!: (resume: Resume) => void;
    const publish = vi.fn(); const task = createUploadTask(publish, () => new Promise((done) => { resolve = done; }));
    await task.select(pdf()); const pending = task.extract("code");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task.getSnapshot()).toMatchObject({ phase: "error", message: "The upload took too long. Try a simpler PDF." });
    resolve(parsed); await pending; expect(publish).not.toHaveBeenCalledWith(parsed);
  });

  it("does not accept an older asynchronous file check", async () => {
    let read!: (value: string) => void; const old = pdf();
    vi.spyOn(old, "slice").mockReturnValue({ text: () => new Promise<string>((done) => { read = done; }) } as Blob);
    const task = createUploadTask(vi.fn()); const first = task.select(old);
    await task.select(pdf()); read("%PDF-1.7");
    expect(await first).toBe(false); expect(task.getSnapshot().phase).toBe("ready");
  });
});
