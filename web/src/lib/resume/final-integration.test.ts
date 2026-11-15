import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ImpactLab from "@/app/impact-lab/impact-lab";
import { ResumeWorkspace } from "@/app/(workspace)/resume-lab/resume-upload";
import { DashboardResumeStatus } from "@/components/resume/DashboardResumeStatus";
import { dashboardWithResume } from "@/lib/dashboard/active-resume";
import { getDashboardSnapshot } from "@/lib/dashboard/snapshot";
import { createResumeSession } from "./session";
import { extractOnAccessEnter } from "./upload-keyboard";
import { analyzeLocally, fromCandidateTurn, requirementLines } from "@/lib/evidence-ledger/adapters";
import { ResumeSchema } from "@/lib/ai/schemas";

const text = "SYNTHETIC RESUME\nEXPERIENCE\nBuilt an internal employee portal for company resources.";
const resume = ResumeSchema.parse({ id: "synthetic-upload", filename: "synthetic.pdf", text });
const job = "Required: Build web applications.\nRequired: Test web applications.";
const answer = "I tested login, navigation, and the mobile layout with coworkers before rollout.";

describe("integrated uploaded Resume → existing evidence ledger", () => {
  it("imports exact text, keeps local clarification controls, hides sample replacement and reuses the existing engine", () => {
    const html = renderToStaticMarkup(createElement(ImpactLab, { initialResume: resume, embedded: true, integrated: true }));
    expect(html).toContain("Uploaded resume text"); expect(html).toContain(text);
    expect(html).toContain("readOnly"); expect(html).toContain("Job description");
    expect(html).toContain("Reset improvement"); expect(html).not.toContain("Load fictional sample");
    const lab = renderToStaticMarkup(createElement(ResumeWorkspace, { resume }));
    expect(lab).toContain("Improve my resume"); expect(lab).not.toContain('href="/impact-lab"');
  });

  it("keeps exact source provenance and confirmation/copy/revocation safeguards", () => {
    const { ledger: baseline } = analyzeLocally(resume.text, job, requirementLines(job));
    const original = baseline.view().evidence.find((e) => e.quote.startsWith("Built an internal"))!;
    expect(original).toBeDefined();
    const subjectId = baseline.view().sources.find((s) => s.id === original.sourceId)!.subjectId;
    const ledger = baseline.reassess(fromCandidateTurn({ id: "synthetic-answer", role: "candidate", content: answer, targetRequirementId: "r2", subjectId }));
    const proposal = ledger.proposeImpact(original.id, "answer:synthetic-answer");
    expect(proposal.improved).toBe(`${original.quote} ${answer}`);
    expect(proposal.independentlyVerified).toBe(false);
    expect(ledger.copyableImpact(original.id, "answer:synthetic-answer")).toBeNull();
    const confirmed = proposal.supportingEvidence.reduce((current, e) => current.reviewEvidence(e.id, true), ledger);
    expect(confirmed.copyableImpact(original.id, "answer:synthetic-answer")).toBe(proposal.improved);
    const contradicted = confirmed.reassess(fromCandidateTurn({ id: "synthetic-revocation", role: "candidate", content: "I did not test the portal. Someone else tested it.", targetRequirementId: "r2", subjectId }));
    expect(() => contradicted.copyableImpact(original.id, "answer:synthetic-answer")).toThrow();
    for (const e of proposal.supportingEvidence) {
      const source = ledger.view().sources.find((s) => s.id === e.sourceId)!;
      expect(source.text.slice(e.start, e.end)).toBe(e.quote);
    }
    const html = renderToStaticMarkup(createElement(ImpactLab, { initialResume: resume, initialWorkspace: { ledger: baseline, links: [] }, embedded: true, integrated: true }));
    expect(html).toContain("Reassess with this answer"); expect(html).toContain("Original experience this answer expands");
  });

  it("retains contextual completion's embedded review-only behavior", () => {
    const { ledger } = analyzeLocally(text, job, requirementLines(job));
    const html = renderToStaticMarkup(createElement(ImpactLab, { initialWorkspace: { ledger, links: [] }, embedded: true }));
    expect(html).toContain("Review grounded wording");
    expect(html).not.toContain("Reassess with this answer");
    expect(html).not.toContain("Reset improvement");
  });
});

describe("dashboard tab-memory overlay", () => {
  it("recognizes, clears and isolates resume state without changing deterministic snapshots", () => {
    const guest = getDashboardSnapshot("empty"); const before = JSON.stringify(guest);
    const session = createResumeSession(); session.set(resume);
    const view = dashboardWithResume(guest, session.getSnapshot());
    expect(view.profile).toMatchObject({ hasResume: true, resumeLabel: expect.stringContaining("this tab only") });
    expect(view.nextSteps.slice(0, 2).map((s) => s.href)).toEqual(["/resume-lab", "/fit-insights"]);
    expect(JSON.stringify(guest)).toBe(before); expect(getDashboardSnapshot("empty")).toEqual(guest);
    session.set(null); expect(dashboardWithResume(guest, session.getSnapshot())).toBe(guest);
    expect(dashboardWithResume(guest, createResumeSession().getSnapshot())).toBe(guest);
  });
  it("does not replace fictional profile/evidence with parsed input", () => {
    const demo = getDashboardSnapshot("demo"); expect(dashboardWithResume(demo, resume)).toBe(demo);
    const html = renderToStaticMarkup(createElement(DashboardResumeStatus, { resume, isDemo: true }));
    expect(html).toContain("Resume ready to review"); expect(html).toContain("Separate from the fictional sample");
    expect(html).toContain('href="/resume-lab"');
  });
});

describe("access-code Enter behavior (outer onboarding form regression)", () => {
  function key(key = "Enter", repeat = false, isComposing = false) {
    return { key, repeat, nativeEvent: { isComposing } as KeyboardEvent, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  }
  it.each(["owner-code", ""])("prevents Continue and invokes the same explicit extraction with code %j", async (code) => {
    const event = key(); const extract = vi.fn(async () => { void code; });
    extractOnAccessEnter(event, false, extract);
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(extract).toHaveBeenCalledOnce();
  });
  it.each([[true, false, false], [false, true, false], [false, false, true]])("blocks double/loading/composition submission", (busy, repeat, composing) => {
    const event = key("Enter", repeat, composing); const extract = vi.fn();
    extractOnAccessEnter(event, busy, extract);
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(extract).not.toHaveBeenCalled();
  });
  it("does not change ordinary non-Enter keys", () => {
    const event = key("Tab"); const extract = vi.fn(); extractOnAccessEnter(event, false, extract);
    expect(event.preventDefault).not.toHaveBeenCalled(); expect(extract).not.toHaveBeenCalled();
  });
});
