import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadResume, analyzeUploadedResume } from "./client";
const resume = { id: "synthetic", text: "EXPERIENCE\nSynthetic work" };
afterEach(() => vi.unstubAllGlobals());
describe("resume upload and fit handoff", () => {
  it("uses multipart upload and returns the validated Resume", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ resume })); vi.stubGlobal("fetch", fetch);
    const parsed = await uploadResume(new File(["%PDF-1.4\nsynthetic"], "synthetic.pdf"), "synthetic-only", new AbortController().signal);
    expect(parsed).toEqual(resume); expect(fetch.mock.calls[0][0]).toBe("/api/resume/parse");
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  });
  it("does not upload invalid files or render arbitrary error text", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("PRIVATE-CANARY", { status: 503 })); vi.stubGlobal("fetch", fetch);
    await expect(uploadResume(new File(["wrong"], "renamed.pdf"), "synthetic", new AbortController().signal)).rejects.toThrow("text-based PDF");
    expect(fetch).not.toHaveBeenCalled();
    await expect(uploadResume(new File(["%PDF-1.4"], "synthetic.pdf"), "synthetic", new AbortController().signal)).rejects.not.toThrow("PRIVATE-CANARY");
  });
  it("sends the actual parsed resume and job to the existing fit API only on explicit invocation", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })); vi.stubGlobal("fetch", fetch);
    expect(fetch).not.toHaveBeenCalled();
    await expect(analyzeUploadedResume(resume, "Synthetic job", "Python", new AbortController().signal)).rejects.toThrow("unavailable");
    expect(fetch.mock.calls[0][0]).toBe("/api/fit/analyze");
    expect(JSON.parse(fetch.mock.calls[0][1].body).resume).toEqual(resume);
  });
  it("refuses to substitute fictional demo output for an uploaded resume", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ analysis: {} }, { headers: { "X-ScaleMe-Mode": "demo" } })));
    await expect(analyzeUploadedResume(resume, "Synthetic", "Python", new AbortController().signal)).rejects.toThrow("live analysis");
  });
  it("accepts validated live analysis for the extracted Resume", async () => {
    const analysis = { summary: "Synthetic analysis", assessments: [{ requirementId: "req-1", status: "supported", explanation: "Synthetic evidence", evidence: [{ source: "resume", quote: "Synthetic work" }] }], strengths: ["Synthetic work"], clarificationQuestions: [], growthSuggestions: [], disclaimer: "Coaching only" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ analysis }, { headers: { "X-ScaleMe-Mode": "live" } })));
    expect(await analyzeUploadedResume(resume, "Synthetic job", "Synthetic work", new AbortController().signal)).toEqual(analysis);
  });
});
