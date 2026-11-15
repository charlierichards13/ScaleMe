import { describe, expect, it } from "vitest";
import { demoInsights, demoJobs, demoProfile } from "./demo-data";
import { getDashboardSnapshot, getNextSteps } from "./snapshot";
import { routes } from "@/lib/routes";

describe("getDashboardSnapshot", () => {
  it("shows a new visitor an empty state without inventing a profile", () => {
    const snapshot = getDashboardSnapshot("empty");
    expect(snapshot.source).toBe("empty");
    expect(snapshot.profile).toEqual({ hasResume: false, authorizationGuidance: null });
    expect(snapshot.jobs).toEqual([]);
    expect(snapshot.insights).toEqual([]);
  });

  it("uses the fictional fixtures only in demo mode", () => {
    const snapshot = getDashboardSnapshot("demo");
    expect(snapshot.source).toBe("demo");
    expect(snapshot.profile).toBe(demoProfile);
    expect(snapshot.jobs).toBe(demoJobs);
    expect(snapshot.insights).toBe(demoInsights);
  });

  it("is deterministic, so prerendered HTML matches hydration", () => {
    expect(getDashboardSnapshot("empty")).toEqual(getDashboardSnapshot("empty"));
    expect(getDashboardSnapshot("demo")).toEqual(getDashboardSnapshot("demo"));
  });
});

describe("getNextSteps", () => {
  it("asks a new user to add a resume first, then set goals", () => {
    const steps = getNextSteps({ hasResume: false, authorizationGuidance: null }, false);
    expect(steps.map((step) => step.id)).toEqual(["add-resume", "set-goal", "analyze-role", "mock-interview"]);
    expect(steps[0].href).toBe(routes.resumeLab);
  });

  it("skips steps the user has already completed", () => {
    const steps = getNextSteps(demoProfile, true);
    const ids = steps.map((step) => step.id);
    expect(ids).not.toContain("add-resume");
    expect(ids).not.toContain("set-goal");
    expect(ids).toEqual(["explain-project", "review-gaps", "mock-interview"]);
  });

  it("never suggests more than four steps", () => {
    expect(getNextSteps({ hasResume: false, authorizationGuidance: null }, false).length).toBeLessThanOrEqual(4);
  });
});

describe("demo fixtures stay honest", () => {
  it("marks every sample job as fictional", () => {
    expect(demoJobs.length).toBeGreaterThan(0);
    for (const job of demoJobs) expect(job.fictional).toBe(true);
  });

  it("labels the sample resume as fictional", () => {
    expect(demoProfile.resumeLabel).toMatch(/fictional/i);
  });

  it("only cites evidence for insights that have it, and never for not_evidenced", () => {
    for (const insight of demoInsights) {
      if (insight.status === "not_evidenced") expect(insight.evidence).toEqual([]);
      if (insight.status === "supported") expect(insight.evidence.length).toBeGreaterThan(0);
    }
  });

  it("contains no hiring percentages or probability language", () => {
    const text = JSON.stringify({ demoProfile, demoJobs, demoInsights });
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/probability|chance of (being )?hired|likely to be hired/i);
  });
});
