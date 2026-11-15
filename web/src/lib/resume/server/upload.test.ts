import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUploadHandler, displayFilename, MAX_BODY_BYTES, MAX_PDF_BYTES, READ_TIMEOUT_MS } from "./upload";
import type { Resume } from "@/lib/ai/schemas";

const TOKEN = "synthetic-private-upload-test-code-only";
const resume: Resume = { id: "synthetic", text: "EXPERIENCE\nSynthetic work" };
const pdf = "%PDF-1.4\nsynthetic";
function request(content: string | Uint8Array = pdf, auth = TOKEN, name = "synthetic.pdf") {
  const data = new FormData();
  data.set("file", new Blob([typeof content === "string" ? content : new Uint8Array(content)], { type: "application/pdf" }), name);
  return new Request("http://localhost:3000/api/resume/parse", { method: "POST", body: data, headers: { Authorization: `Bearer ${auth}`, Origin: "http://localhost:3000" } });
}
function parser() { return vi.fn(async (_bytes, _binary, _signal, release) => { release(); return resume; }); }

beforeEach(() => {
  vi.stubEnv("RESUME_UPLOAD_ENABLED", "true");
  vi.stubEnv("RESUME_UPLOAD_TOKEN", TOKEN);
  vi.stubEnv("RESUME_UPLOAD_ORIGIN", "http://localhost:3000");
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("private upload route", () => {
  it("is disabled by default, even with a valid token", async () => {
    vi.stubEnv("RESUME_UPLOAD_ENABLED", "false");
    const run = parser(); const response = await createUploadHandler(run)(request());
    expect(response.status).toBe(503); expect(run).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each(["", "wrong"])('rejects invalid access without invoking the parser (%s)', async (token) => {
    const run = parser(); expect((await createUploadHandler(run)(request(pdf, token))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
  it("fails closed on missing or short server tokens", async () => {
    vi.stubEnv("RESUME_UPLOAD_TOKEN", "short");
    expect((await createUploadHandler(parser())(request())).status).toBe(503);
  });
  it("rejects cross-origin uploads", async () => {
    const req = request(); req.headers.set("origin", "https://attacker.invalid");
    expect((await createUploadHandler(parser())(req)).status).toBe(403);
  });
  it("returns Resume JSON, sanitizes only the display filename and keeps no cached result", async () => {
    const run = parser(); const response = await createUploadHandler(run)(request(pdf, TOKEN, "../private/synthetic.pdf"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resume: { ...resume, filename: "synthetic.pdf" } });
    expect(run.mock.calls[0][0]).toEqual(new TextEncoder().encode(pdf));
    expect(run.mock.calls[0][1]).not.toContain("synthetic.pdf");
  });
  it.each(["", "renamed non-PDF", "%PDF-x.y\n"])('rejects invalid content (%s)', async (text) => {
    const run = parser(); expect((await createUploadHandler(run)(request(text))).status).toBe(415);
    expect(run).not.toHaveBeenCalled();
  });
  it("rejects missing, repeated and extra multipart fields", async () => {
    for (const kind of ["missing", "repeat", "extra"]) {
      const req = request(); const data = new FormData();
      if (kind !== "missing") data.append("file", new Blob([pdf]), "one.pdf");
      if (kind === "repeat") data.append("file", new Blob([pdf]), "two.pdf");
      if (kind === "extra") data.append("other", "ignored?");
      const bad = new Request(req.url, { method: "POST", body: data, headers: { Authorization: `Bearer ${TOKEN}` } });
      expect((await createUploadHandler(parser())(bad)).status).toBe(415);
    }
  });
  it("rejects files over 5 MiB before the parser", async () => {
    const run = parser(); expect((await createUploadHandler(run)(request(new Uint8Array(MAX_PDF_BYTES + 1)))).status).toBe(413);
    expect(run).not.toHaveBeenCalled();
  });
  it("bounds a chunked body even when Content-Length lies", async () => {
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); c.close(); } });
    const req = new Request("http://localhost:3000/api/resume/parse", { method: "POST", body: stream, duplex: "half", headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "multipart/form-data; boundary=test", "content-length": "1" } } as RequestInit);
    expect((await createUploadHandler(parser())(req)).status).toBe(413);
  });
  it("times out stalled input even if stream cancellation never resolves", async () => {
    vi.useFakeTimers();
    const body = new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { return new Promise(() => {}); } });
    const req = new Request("http://localhost:3000/api/resume/parse", { method: "POST", body, duplex: "half", headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "multipart/form-data; boundary=test" } } as RequestInit);
    const response = createUploadHandler(parser())(req);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS + 1);
    expect((await response).status).toBe(408);
  });
  it("retains the concurrency lease until the child closes, then admits the next upload", async () => {
    let close = () => {};
    const run = vi.fn(async (_bytes, _binary, _signal, release) => { close = release; return resume; });
    const handler = createUploadHandler(run);
    expect((await handler(request())).status).toBe(200);
    expect((await handler(request())).status).toBe(429);
    close(); expect((await handler(request())).status).toBe(200);
  });
  it("bounds authenticated attempts per process without tracking caller data", async () => {
    const handler = createUploadHandler(parser(), () => 1000);
    for (let n = 0; n < 6; n++) expect((await handler(request())).status).toBe(200);
    const busy = await handler(request()); expect(busy.status).toBe(429);
    expect(busy.headers.get("retry-after")).toBe("60");
  });
  it("does not echo unexpected exceptions, filenames, tokens or document contents", async () => {
    const run = vi.fn(async (_b, _p, _s, release) => { release(); throw new Error("PRIVATE-CANARY"); });
    const response = await createUploadHandler(run)(request());
    const body = await response.text();
    for (const value of [TOKEN, "synthetic.pdf", "Synthetic work", "PRIVATE-CANARY"]) expect(body).not.toContain(value);
  });
  it("keeps safe filename lengths and rejects path-only names", () => {
    expect(displayFilename("C:\\private\\synthetic.pdf")).toBe("synthetic.pdf");
    expect(displayFilename(".." )).toBeUndefined(); expect(displayFilename("x".repeat(256))).toBeUndefined();
  });
});
