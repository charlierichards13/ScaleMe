import { describe, expect, it } from "vitest";
import {
  assessment,
  coverage,
  requiredIds,
  requirements,
  selectRequirement,
  sources,
  validCitation,
} from "./demo";

describe("fictional Fit Evidence Explorer", () => {
  it("counts only the stable required inventory", () => {
    expect(requiredIds).toEqual([
      "web",
      "collaboration",
      "testing",
      "feedback",
    ]);
    expect(coverage("before")).toEqual({ supported: 2, total: 4 });
    expect(coverage("after", "relevant")).toEqual({ supported: 3, total: 4 });
    expect(coverage("after", "relevant", [...requiredIds].reverse())).toEqual({
      supported: 3,
      total: 4,
    });
  });
  it("changes exactly testing after the relevant answer is shown", () => {
    expect(
      requirements
        .filter(
          (r) =>
            assessment(r.id, "before").status !==
            assessment(r.id, "after", "relevant").status,
        )
        .map((r) => r.id),
    ).toEqual(["testing"]);
    expect(assessment("testing", "after", "relevant")).toEqual({
      status: "supported",
      citation: {
        sourceId: "turn-testing",
        quote: sources["turn-testing"].text,
      },
    });
    expect(assessment("automation", "after", "relevant").status).toBe(
      "not_evidenced",
    );
    expect(assessment("feedback", "after", "relevant").status).toBe("unclear");
  });
  it.each([undefined, "vague", "irrelevant"] as const)(
    "does not inflate coverage for %s",
    (answer) => {
      expect(coverage("after", answer)).toEqual(coverage("before"));
      expect(assessment("testing", "after", answer).status).toBe(
        "not_evidenced",
      );
    },
  );
  it("does not count an answer in the before snapshot or writing alone", () => {
    expect(coverage("before", "relevant")).toEqual(coverage("before"));
    expect(
      validCitation(
        "testing",
        { sourceId: "rewritten-bullet", quote: sources["turn-testing"].text },
        true,
      ),
    ).toBe(false);
  });
  it("requires exact approved candidate quotes and relevant links", () => {
    const quote = sources["turn-testing"].text;
    expect(
      validCitation("testing", { sourceId: "turn-testing", quote }, true),
    ).toBe(true);
    expect(
      validCitation("testing", { sourceId: "turn-testing", quote }, false),
    ).toBe(false);
    for (const citation of [
      { sourceId: "turn-testing", quote: "Improved performance by 40%" },
      { sourceId: "turn-testing", quote: "" },
      { sourceId: "turn-testing", quote: "login" },
      { sourceId: "unknown", quote },
      { sourceId: "toString", quote },
      { sourceId: "__proto__", quote },
      { sourceId: "job", quote: requirements[2].jobQuote },
      { sourceId: "turn-vague", quote: sources["turn-vague"].text },
      { sourceId: "turn-irrelevant", quote: sources["turn-irrelevant"].text },
    ])
      expect(validCitation("testing", citation, true)).toBe(false);
    expect(
      validCitation("automation", { sourceId: "turn-testing", quote }, true),
    ).toBe(false);
    expect(
      validCitation("unknown", { sourceId: "turn-testing", quote }, true),
    ).toBe(false);
  });
  it("fails closed for changed, duplicate, missing or preferred requirement IDs", () => {
    for (const ids of [
      [],
      ["web", "web", "testing", "feedback"],
      ["web", "collaboration", "testing", "automation"],
      [...requiredIds, "unknown"],
      ["web", "collaboration", "testing", "unknown"],
    ]) {
      expect(() => coverage("after", "relevant", ids)).toThrow(
        "Requirement inventory changed",
      );
    }
  });
  it("resolves selection by stable ID with an explicit missing state", () => {
    expect(selectRequirement("testing")?.title).toBe("Test web applications");
    expect(selectRequirement("unknown")).toBeUndefined();
    expect(assessment("unknown", "after", "relevant")).toEqual({
      status: "not_evidenced",
    });
  });
  it("links every supported fixture to candidate evidence", () => {
    for (const phase of ["before", "after"] as const)
      for (const r of requirements) {
        const result = assessment(r.id, phase, "relevant");
        if (result.status === "supported") {
          expect(result.citation).toBeDefined();
          expect(validCitation(r.id, result.citation!, phase === "after")).toBe(
            true,
          );
        }
      }
  });
});
