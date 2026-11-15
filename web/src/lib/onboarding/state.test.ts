import { describe, expect, it } from "vitest";
import {
  MAX_TEXT_LENGTH,
  initialOnboardingState,
  onboardingReducer,
  stepIds,
  stepProgress,
  summarizeAnswers,
  type OnboardingAction,
  type OnboardingState,
} from "./state";
import { checkResumeMetadata, formatFileSize, hasPdfSignature, MAX_RESUME_BYTES } from "./resume-file";

const run = (actions: OnboardingAction[], start: OnboardingState = initialOnboardingState) =>
  actions.reduce(onboardingReducer, start);

describe("onboarding navigation", () => {
  it("starts on the resume step with nothing selected", () => {
    expect(initialOnboardingState.step).toBe("resume");
    expect(initialOnboardingState.answers.resume).toBeNull();
    expect(initialOnboardingState.answers.goals).toEqual([]);
  });

  it("walks forward through all four questions to the done screen, then stops", () => {
    const steps = [initialOnboardingState.step];
    let state = initialOnboardingState;
    for (let i = 0; i < 6; i++) {
      state = onboardingReducer(state, { type: "next" });
      steps.push(state.step);
    }
    expect(steps).toEqual(["resume", "goals", "preferences", "personalize", "done", "done", "done"]);
  });

  it("goes back without losing answers and never before the first step", () => {
    const state = run([
      { type: "next" },
      { type: "toggleGoal", goal: "internship" },
      { type: "next" },
      { type: "back" },
      { type: "back" },
      { type: "back" },
    ]);
    expect(state.step).toBe("resume");
    expect(state.answers.goals).toEqual(["internship"]);
  });

  it("skip advances, clears only that step's answers and records the skip", () => {
    const state = run([
      { type: "next" },
      { type: "toggleGoal", goal: "resume" },
      { type: "next" },
      { type: "setText", field: "role", value: "Data analyst" },
      { type: "toggleArrangement", arrangement: "remote" },
      { type: "setTiming", timing: "fall" },
      { type: "skip" },
    ]);
    expect(state.step).toBe("personalize");
    expect(state.answers.goals).toEqual(["resume"]);
    expect(state.answers.role).toBe("");
    expect(state.answers.arrangements).toEqual([]);
    expect(state.answers.timing).toBeNull();
    expect(state.skipped).toEqual(["preferences"]);
  });

  it("answering a previously skipped step removes it from the skipped list", () => {
    const state = run([{ type: "skip" }, { type: "back" }, { type: "next" }]);
    expect(state.step).toBe("goals");
    expect(state.skipped).toEqual([]);
  });

  it("skip and next do nothing on the done screen", () => {
    const done = run(stepIds.slice(0, -1).map(() => ({ type: "next" }) as const));
    expect(done.step).toBe("done");
    expect(onboardingReducer(done, { type: "skip" })).toBe(done);
    expect(onboardingReducer(done, { type: "next" })).toBe(done);
  });

  it("reports progress as 1–4 of 4", () => {
    expect(stepIds.map((id) => stepProgress(id).current)).toEqual([1, 2, 3, 4, 4]);
    expect(stepProgress("goals").total).toBe(4);
  });
});

describe("onboarding answers", () => {
  it("goals are multi-select and toggle off again", () => {
    const state = run([
      { type: "toggleGoal", goal: "internship" },
      { type: "toggleGoal", goal: "interviews" },
      { type: "toggleGoal", goal: "explore" },
      { type: "toggleGoal", goal: "internship" },
    ]);
    expect(state.answers.goals).toEqual(["interviews", "explore"]);
  });

  it("work arrangements are multi-select", () => {
    const state = run([
      { type: "toggleArrangement", arrangement: "remote" },
      { type: "toggleArrangement", arrangement: "hybrid" },
    ]);
    expect(state.answers.arrangements).toEqual(["remote", "hybrid"]);
  });

  it("caps and normalizes free text", () => {
    const state = run([
      { type: "setText", field: "role", value: "  Software   engineer" },
      { type: "setText", field: "location", value: "x".repeat(500) },
    ]);
    expect(state.answers.role).toBe("Software engineer");
    expect(state.answers.location).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("support preferences default off and are opt-in", () => {
    expect(initialOnboardingState.answers.internationalGuidance).toBe(false);
    expect(initialOnboardingState.answers.jobUpdates).toBe(false);
    const state = run([{ type: "setSupport", field: "internationalGuidance", value: true }]);
    expect(state.answers.internationalGuidance).toBe(true);
    expect(state.answers.jobUpdates).toBe(false);
  });

  it("stores only resume metadata and can clear it", () => {
    const selected = run([{ type: "selectResume", selection: { name: "resume.pdf", sizeBytes: 2048 } }]);
    expect(Object.keys(selected.answers.resume ?? {})).toEqual(["name", "sizeBytes"]);
    expect(run([{ type: "clearResume" }], selected).answers.resume).toBeNull();
  });

  it("summary never claims a resume was uploaded or parsed", () => {
    const selected = run([{ type: "selectResume", selection: { name: "resume.pdf", sizeBytes: 2048 } }]);
    const resumeLine = summarizeAnswers(selected.answers).find((line) => line.label === "Resume");
    expect(resumeLine?.value).toMatch(/not uploaded/i);
    expect(resumeLine?.value).not.toMatch(/\b(parsed|analy[sz]ed|saved)\b/i);
  });

  it("summary reports missing answers honestly", () => {
    const lines = summarizeAnswers(initialOnboardingState.answers);
    expect(lines.map((line) => line.value)).toEqual([
      "Not added yet",
      "Not chosen yet",
      "Not specified",
      "Not specified",
      "No preference given",
      "Not specified",
    ]);
  });
});

describe("resume file checks (client-side UX only)", () => {
  it("accepts a reasonably sized .pdf", () => {
    expect(checkResumeMetadata({ name: "Resume.PDF", size: 1000, type: "application/pdf" })).toEqual({ ok: true });
    expect(checkResumeMetadata({ name: "resume.pdf", size: 1000, type: "" })).toEqual({ ok: true });
  });

  it("rejects empty, oversized and non-PDF files", () => {
    expect(checkResumeMetadata({ name: "a.pdf", size: 0, type: "application/pdf" })).toEqual({ ok: false, reason: "empty" });
    expect(checkResumeMetadata({ name: "a.pdf", size: MAX_RESUME_BYTES + 1, type: "application/pdf" })).toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(checkResumeMetadata({ name: "a.docx", size: 10, type: "application/pdf" })).toEqual({ ok: false, reason: "not-pdf" });
    expect(checkResumeMetadata({ name: "a.pdf", size: 10, type: "text/html" })).toEqual({ ok: false, reason: "not-pdf" });
  });

  it("checks the real PDF signature, not the extension", () => {
    expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(hasPdfSignature(new TextEncoder().encode("<html><script>"))).toBe(false);
    expect(hasPdfSignature(new Uint8Array([0x25, 0x50]))).toBe(false);
  });

  it("formats sizes for display", () => {
    expect(formatFileSize(380 * 1024)).toBe("380 KB");
    expect(formatFileSize(1.25 * 1024 * 1024)).toBe("1.3 MB");
    expect(formatFileSize(10)).toBe("1 KB");
  });
});
