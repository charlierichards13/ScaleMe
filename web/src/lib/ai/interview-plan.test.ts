import { describe, expect, it } from "vitest";
import { historyOf, interviewJob, interviewRequest } from "./interview-fixtures";
import { buildPlan, MAX_TARGETED_SLOTS, selectNextTurn } from "./interview-plan";
import type { InterviewRequest } from "./interview-schemas";
import { FitApiError } from "./schemas";

const targetsOf = (req: InterviewRequest) =>
  buildPlan(req.job, req.fit).questions.map((q) => (q.kind === "question" ? (q.target?.id ?? q.focus) : "closing"));

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof FitApiError ? `${err.status}:${err.code}` : "other";
  }
  return "no error";
};

describe("buildPlan", () => {
  it("targets unresolved requirements only: not_evidenced before unclear, two questions each, then reflection", () => {
    expect(targetsOf(interviewRequest)).toEqual(["r2", "r2", "r3", "r3", "reflection"]);
    const plan = buildPlan(interviewRequest.job, interviewRequest.fit);
    expect(plan.targeting).toBe("requirement");
    expect(plan.questions.slice(0, 2).map((q) => q.focus)).toEqual(["contribution", "impact"]);
  });

  it("never targets a requirement the fit context marks supported", () => {
    expect(targetsOf(interviewRequest)).not.toContain("r1");
  });

  it("orders required before preferred within the same status, then by posting order", () => {
    const job = {
      ...interviewJob,
      requirements: [
        { id: "p", description: "Preferred thing", importance: "preferred" as const },
        { id: "a", description: "Required A", importance: "required" as const },
        { id: "b", description: "Required B", importance: "required" as const },
      ],
    };
    expect(targetsOf({ ...interviewRequest, job, fit: undefined })).toEqual(["a", "a", "b", "b", "p", "reflection"]);
  });

  it("treats requirements without a fit assessment as not assessed (after not_evidenced and unclear)", () => {
    const fit = { assessments: [{ requirementId: "r3", status: "unclear" as const }] };
    expect(targetsOf({ ...interviewRequest, fit })).toEqual(["r3", "r3", "r1", "r1", "r2", "reflection"]);
  });

  it("caps targeted questions so the session fits in the history limit", () => {
    const requirements = Array.from({ length: 10 }, (_, i) => ({
      id: `q${i}`,
      description: `Requirement ${i}`,
      importance: "required" as const,
    }));
    const plan = buildPlan({ ...interviewJob, requirements }, undefined);
    expect(plan.questions).toHaveLength(MAX_TARGETED_SLOTS + 1);
    expect(plan.questions.at(-1)).toMatchObject({ focus: "reflection" });
  });

  it("uses an explicit general plan (no targets) when the job has no structured requirements", () => {
    const plan = buildPlan({ ...interviewJob, requirements: undefined }, undefined);
    expect(plan).toMatchObject({ targeting: "general", generalReason: "no_structured_requirements" });
    expect(plan.questions.map((q) => q.focus)).toEqual(["context", "contribution", "tradeoffs", "impact", "reflection"]);
    expect(plan.questions.every((q) => q.kind === "question" && !q.target)).toBe(true);
  });

  it("uses the general plan when every requirement is marked supported", () => {
    const fit = { assessments: interviewJob.requirements!.map((r) => ({ requirementId: r.id, status: "supported" as const })) };
    expect(buildPlan(interviewJob, fit)).toMatchObject({ targeting: "general", generalReason: "no_unresolved_requirements" });
  });

  it.each([
    ["fit without structured requirements", { ...interviewJob, requirements: undefined }, interviewRequest.fit, "400:INVALID_FIT_CONTEXT"],
    ["fit with an unknown requirement id", interviewJob, { assessments: [{ requirementId: "r9", status: "unclear" as const }] }, "400:INVALID_FIT_CONTEXT"],
    [
      "fit with a duplicate requirement id",
      interviewJob,
      { assessments: [{ requirementId: "r2", status: "unclear" as const }, { requirementId: "r2", status: "supported" as const }] },
      "400:INVALID_FIT_CONTEXT",
    ],
    [
      "job with duplicate requirement ids",
      { ...interviewJob, requirements: [interviewJob.requirements![0], interviewJob.requirements![0]] },
      undefined,
      "400:INVALID_JOB",
    ],
  ])("rejects %s", (_name, job, fit, expected) => {
    expect(codeOf(() => buildPlan(job, fit))).toBe(expected);
  });
});

describe("selectNextTurn", () => {
  it("first turn: targets the top unresolved requirement and cannot finish yet", () => {
    const s = selectNextTurn(interviewRequest);
    expect(s).toMatchObject({ index: 0, canFinish: false, turn: { kind: "question", focus: "contribution", followUp: false } });
    expect(s.turn.kind === "question" && s.turn.target?.id).toBe("r2");
  });

  it("second turn is a follow-up on the SAME requirement", () => {
    const s = selectNextTurn({ ...interviewRequest, history: historyOf(1, ["r2"]) });
    expect(s.turn).toMatchObject({ focus: "impact", followUp: true, target: { id: "r2" } });
  });

  it("works for v0.1 clients that do not echo targetRequirementId", () => {
    const s = selectNextTurn({ ...interviewRequest, history: historyOf(2) });
    expect(s.turn).toMatchObject({ target: { id: "r3" } });
  });

  it("allows finishing after four answers, and at the reflection turn", () => {
    expect(selectNextTurn({ ...interviewRequest, history: historyOf(3) }).canFinish).toBe(false);
    const fourth = selectNextTurn({ ...interviewRequest, history: historyOf(4) });
    expect(fourth).toMatchObject({ canFinish: true, turn: { focus: "reflection" } });
  });

  it("returns a closing turn after the last question, then rejects further turns", () => {
    const closing = selectNextTurn({ ...interviewRequest, history: historyOf(5) });
    expect(closing).toMatchObject({ canFinish: true, turn: { kind: "closing" } });
    expect(codeOf(() => selectNextTurn({ ...interviewRequest, history: historyOf(6) }))).toBe("400:INVALID_HISTORY");
  });

  it("supports a full general session of five questions plus a closing turn", () => {
    const req = { ...interviewRequest, job: { ...interviewJob, requirements: undefined }, fit: undefined };
    expect(selectNextTurn({ ...req, history: historyOf(4) }).turn).toMatchObject({ kind: "question", focus: "reflection" });
    expect(selectNextTurn({ ...req, history: historyOf(5) }).turn.kind).toBe("closing");
  });

  it.each([
    ["starts with a candidate turn", [{ role: "candidate" as const, content: "hi" }, { role: "coach" as const, content: "q?" }]],
    ["ends with a coach turn (odd length)", historyOf(1).concat({ role: "coach", content: "q?" })],
    ["two candidate turns in a row", [{ role: "coach" as const, content: "q?" }, { role: "candidate" as const, content: "a" }, { role: "candidate" as const, content: "b" }, { role: "candidate" as const, content: "c" }]],
    ["a candidate turn carrying a target id", [{ role: "coach" as const, content: "q?" }, { role: "candidate" as const, content: "a", targetRequirementId: "r2" }]],
    ["an echoed target that the server did not plan", historyOf(1, ["r1"])],
    ["an echoed target id that does not exist", historyOf(1, ["r9"])],
    ["an echoed target on the untargeted reflection turn", historyOf(5, ["r2", "r2", "r3", "r3", "r3"])],
  ])("rejects history that %s", (_name, history) => {
    expect(codeOf(() => selectNextTurn({ ...interviewRequest, history }))).toBe("400:INVALID_HISTORY");
  });

  it("rejects echoed targets in a general session", () => {
    const req = { ...interviewRequest, job: { ...interviewJob, requirements: undefined }, fit: undefined };
    expect(codeOf(() => selectNextTurn({ ...req, history: historyOf(1, ["r1"]) }))).toBe("400:INVALID_HISTORY");
  });

  it("is deterministic: the same input always yields the same plan and turn", () => {
    const req = { ...interviewRequest, history: historyOf(2, ["r2", "r2"]) };
    expect(selectNextTurn(req)).toEqual(selectNextTurn(req));
  });
});
