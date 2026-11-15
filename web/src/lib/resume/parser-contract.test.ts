// Contract check for the Rust resume parser (Issue #4, services/resume-parser).
//
// The golden file is REAL parser output for a synthetic PDF. The Rust test
// `services/resume-parser/tests/contract.rs` fails if the parser stops producing it, and this
// test fails if it stops satisfying the v0.1 `ResumeSchema`. Together they keep the Rust
// output and the TypeScript contract from drifting apart.
//
// This file only reads a fixture and the existing schema. It adds no route, no UI and no
// runtime code, and it does not change `web/src/lib/ai/`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FitRequestSchema, LIMITS, ResumeSchema } from "@/lib/ai/schemas";

const goldenPath = fileURLToPath(
  new URL(
    "../../../../services/resume-parser/tests/golden/synthetic-one-column.json",
    import.meta.url,
  ),
);
const golden: unknown = JSON.parse(readFileSync(goldenPath, "utf8"));

function resumeOf(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf("object");
  const envelope = value as Record<string, unknown>;
  expect(Object.keys(envelope)).toEqual(["resume"]);
  return envelope.resume as Record<string, unknown>;
}

describe("Rust resume parser output (synthetic golden file)", () => {
  it("is accepted by ResumeSchema without any field being changed or dropped", () => {
    const resume = resumeOf(golden);
    const parsed = ResumeSchema.parse(resume);
    // Zod strips unknown keys, so equality proves the parser emits contract fields only.
    expect(parsed).toEqual(resume);
  });

  it("uses only the four contract fields", () => {
    const resume = resumeOf(golden);
    expect(Object.keys(resume).sort()).toEqual(["filename", "id", "sections", "text"]);
    for (const section of resume.sections as Array<Record<string, unknown>>) {
      expect(Object.keys(section).sort()).toEqual(["heading", "text"]);
    }
  });

  it("stays within the documented size limits", () => {
    const resume = ResumeSchema.parse(resumeOf(golden));
    expect(resume.text.length).toBeGreaterThan(0);
    expect(resume.text.length).toBeLessThanOrEqual(LIMITS.resumeText);
    expect(resume.sections?.length).toBeLessThanOrEqual(50);
  });

  it("can be sent to fit analysis as-is", () => {
    const request = {
      resume: resumeOf(golden),
      job: { id: "job-demo-001", title: "Software Engineer Intern", text: "Python and SQL." },
    };
    expect(FitRequestSchema.safeParse(request).success).toBe(true);
  });

  it("is synthetic data", () => {
    const resume = ResumeSchema.parse(resumeOf(golden));
    expect(resume.id).toBe("resume-demo-001");
    expect(resume.text).toContain("jordan.example@example.com");
    expect(resume.text).toContain("(fictional)");
  });
});
