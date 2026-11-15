import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import { ResumeSchema, type Resume } from "@/lib/ai/schemas";
import { aborted, failed, timedOut, unavailable, UploadError } from "./errors";

export const PROCESS_TIMEOUT_MS = 12_000;
export const MAX_OUTPUT_BYTES = 512 * 1024;

/** One executable per document, no shell, filenames, PDF paths, inherited secrets or temp files.
 * The lease stays occupied until close, even if kill fails or the HTTP caller has gone away.
 */
export function runParser(
  bytes: Uint8Array,
  binary: string,
  signal: AbortSignal,
  release: () => void,
): Promise<Resume> {
  return new Promise((resolve, reject) => {
    if (!isAbsolute(binary) || signal.aborted) {
      release();
      reject(signal.aborted ? aborted() : unavailable());
      return;
    }
    let child;
    try {
      child = spawn(binary, ["--timeout-ms", "10000", "--max-memory-mib", "256"], {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "ignore"],
        env: { NODE_ENV: "production", RAYON_NUM_THREADS: "1", ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}) },
      });
    } catch {
      release();
      reject(unavailable());
      return;
    }
    const chunks: Buffer[] = [];
    let length = 0;
    let settled = false;
    const finish = (error: UploadError) => {
      if (!settled) { settled = true; reject(error); }
    };
    const stop = (error: UploadError) => {
      finish(error);
      try { child.kill("SIGKILL"); } catch { /* Keep the lease until close: fail closed. */ }
    };
    const onAbort = () => stop(aborted());
    const timer = setTimeout(() => stop(timedOut()), PROCESS_TIMEOUT_MS);
    signal.addEventListener("abort", onAbort, { once: true });
    child.on("error", () => finish(unavailable()));
    child.stdin.on("error", () => { /* Early parser rejection may close stdin. Await exit. */ });
    child.stdout.on("error", () => stop(failed()));
    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      length += chunk.length;
      if (length > MAX_OUTPUT_BYTES) { stop(failed()); return; }
      chunks.push(chunk);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      release();
      if (settled) return;
      if (code === 3) { finish(timedOut()); return; }
      try {
        const data: unknown = JSON.parse(Buffer.concat(chunks, length).toString("utf8"));
        if (code === 0) {
          const envelope = data as { resume?: unknown };
          const parsed = ResumeSchema.safeParse(envelope?.resume);
          if (!parsed.success) { finish(failed()); return; }
          settled = true;
          resolve(parsed.data);
        } else if (code === 1) {
          // Never trust or echo the child's message, stderr, stack or arbitrary output.
          const errorCode = (data as { error?: { code?: unknown } })?.error?.code;
          if (errorCode === "FILE_TOO_LARGE") finish(new UploadError(413, errorCode, "The PDF exceeds a page or text limit. Nothing was truncated."));
          else if (errorCode === "INVALID_FILE_TYPE") finish(new UploadError(415, errorCode, "The file is not a readable PDF."));
          else if (errorCode === "NO_EXTRACTABLE_TEXT") finish(new UploadError(422, errorCode, "No text could be extracted. Scanned PDFs are not supported."));
          else finish(new UploadError(422, "PARSING_FAILED", "The PDF is damaged, password-protected or unsupported."));
        } else finish(failed());
      } catch { finish(failed()); }
    });
    if (signal.aborted) onAbort();
    else child.stdin.end(bytes);
  });
}
