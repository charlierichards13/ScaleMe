import { describe, expect, it } from "vitest";
import { createUploadHandler } from "../src/lib/resume/server/upload";
import { ResumeSchema } from "../src/lib/ai/schemas";
import { syntheticPdf } from "../scripts/resume-upload-smoke.mjs";

describe("actual uploaded PDF → executable → Zod Resume", () => {
  it("runs the real binary, preserves the source and rejects corrupt inputs", async () => {
    process.env.RESUME_UPLOAD_ENABLED = "true"; process.env.RESUME_UPLOAD_EXPIRES_AT = "2099-01-01T00:00:00Z";
    const handler = createUploadHandler();
    for (const [bytes, status] of [[syntheticPdf(), 200], [Buffer.from("%PDF-1.4\nbroken"), 422]] as const) {
      const body = new FormData(); body.set("file", new Blob([new Uint8Array(bytes)]), "synthetic.pdf");
      const response = await handler(new Request("http://localhost:3000/api/resume/parse", { method: "POST", body, headers: {} }));
      expect(response.status).toBe(status);
      if (status === 200) {
        const resume = ResumeSchema.parse((await response.json()).resume);
        expect(resume.text).toBe("SYNTHETIC RESUME\nEXPERIENCE\nBuilt a fictional scheduling tool with Python.");
        expect(resume.sections?.[0].text).toBe("Built a fictional scheduling tool with Python.");
      }
    }
    delete process.env.RESUME_UPLOAD_ENABLED; delete process.env.RESUME_UPLOAD_EXPIRES_AT;
  });
});
