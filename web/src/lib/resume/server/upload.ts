import { resolve } from "node:path";
import { runParser } from "./process";
import { aborted, invalid, tooLarge, unavailable, UploadError } from "./errors";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_BODY_BYTES = MAX_PDF_BYTES + 64 * 1024;
export const READ_TIMEOUT_MS = 10_000;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export function displayFilename(raw: string): string | undefined {
  const base = raw.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  return base && base !== "." && base !== ".." && base.length <= 255 ? base : undefined;
}

/** Public demo gate: owner-enabled, time-bounded, and still origin restricted. */
function authorize(request: Request) {
  if (process.env.RESUME_UPLOAD_ENABLED !== "true") throw unavailable();
  const expiration = process.env.RESUME_UPLOAD_EXPIRES_AT ?? "";
  // Require an explicit timezone so deployments cannot silently change the cutoff.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(expiration) ||
      !Number.isFinite(Date.parse(expiration)) || Date.now() >= Date.parse(expiration)) throw unavailable();
  const origin = request.headers.get("origin");
  const allowed = process.env.RESUME_UPLOAD_ORIGIN || "http://localhost:3000";
  if ((origin && origin !== allowed) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new UploadError(403, "PARSING_FAILED", "This upload origin is not allowed.");
  }
}

async function readFile(request: Request): Promise<File> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw invalid();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  if (!request.body) throw invalid();
  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const failure = new Promise<never>((_, reject) => {
    onAbort = () => { void reader.cancel().catch(() => {}); reject(aborted()); };
    timer = setTimeout(onAbort, READ_TIMEOUT_MS);
    request.signal.addEventListener("abort", onAbort, { once: true });
  });
  const read = async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (size + value.length > MAX_BODY_BYTES) {
          void reader.cancel().catch(() => {});
          throw tooLarge();
        }
        bytes.set(value, size);
        size += value.length;
      }
    } finally { reader.releaseLock(); }
  };
  try {
    if (request.signal.aborted) onAbort();
    await Promise.race([read(), failure]);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onAbort);
  }
  const bounded = new Request("http://upload.invalid", {
    method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body: bytes.slice(0, size),
  });
  let data: FormData;
  try { data = await bounded.formData(); } catch { throw invalid(); }
  const files = data.getAll("file");
  if (files.length !== 1 || [...data.keys()].some((key) => key !== "file") || typeof files[0] === "string" || !files[0]) throw invalid();
  const file = files[0];
  if (file.size > MAX_PDF_BYTES) throw tooLarge();
  if (file.size === 0) throw invalid();
  return file;
}

/** Numeric process-local budgets only; no applicant data, IPs or results retained. */
export function createUploadHandler(parser = runParser, now = Date.now) {
  let active = false;
  let admissions: number[] = [];
  return async (request: Request): Promise<Response> => {
    let release = () => {};
    let handedOff = false;
    try {
      authorize(request);
      admissions = admissions.filter((time) => time > now() - 60_000);
      if (active || admissions.length >= 6) throw new UploadError(429, "PARSING_FAILED", "Upload capacity is busy. Try again later.");
      active = true;
      admissions.push(now());
      let released = false;
      release = () => { if (!released) { released = true; active = false; } };
      const file = await readFile(request);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!/^%PDF-\d\.\d/.test(new TextDecoder().decode(bytes.slice(0, 8)))) throw invalid();
      const binary = process.env.RESUME_PARSER_PATH || resolve(process.cwd(), "../services/resume-parser/target/release", process.platform === "win32" ? "resume-parser.exe" : "resume-parser");
      handedOff = true;
      const resume = await parser(bytes, binary, request.signal, release);
      return Response.json({ resume: { ...resume, filename: displayFilename(file.name) } }, { headers });
    } catch (error) {
      if (request.body && !request.body.locked && !request.bodyUsed) void request.body.cancel().catch(() => {});
      const safe = error instanceof UploadError ? error : new UploadError(422, "PARSING_FAILED", "The upload could not be processed.");
      return Response.json({ error: { code: safe.code, message: safe.message, retryable: false } }, {
        status: safe.status, headers: { ...headers, ...(safe.status === 429 ? { "Retry-After": "60" } : {}) },
      });
    } finally { if (!handedOff) release(); }
  };
}
