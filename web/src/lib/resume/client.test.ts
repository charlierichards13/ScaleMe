import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadResume } from "./client";
import { toFitRequest } from "@/lib/fit/draft";
import { FitRequestSchema } from "@/lib/ai/schemas";
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
  it("uses extracted text with the team's existing Fit draft contract without making an AI call", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const request = FitRequestSchema.parse(toFitRequest({ resume: resume.text, title: "Synthetic job", job: "Python" }));
    expect(request.resume.text).toBe(resume.text); expect(fetch).not.toHaveBeenCalled();
  });
});
