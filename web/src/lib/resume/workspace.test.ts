import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResumeUpload, { ResumeReview } from "@/app/(workspace)/resume-lab/resume-upload";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { FeatureCards } from "@/components/dashboard/FeatureCards";
import { primaryNav } from "@/components/layout/nav-items";

describe("Resume Lab product destinations and honest review", () => {
  it("routes sidebar and dashboard cards to the canonical workspace", () => {
    expect(primaryNav.find((n) => n.label === "Resume Lab")).toMatchObject({ href: "/resume-lab", status: "Preview" });
    const html = renderToStaticMarkup(createElement(FeatureCards));
    expect(html).toMatch(/href="\/resume-lab"/); expect(html).toContain("Resume Lab");
  });
  it("keeps working evidence and interview destinations, with private disclosure", () => {
    const html = renderToStaticMarkup(createElement(ResumeUpload));
    expect(html).toContain('href="/impact-lab"'); expect(html).toContain('href="/interview"');
    expect(html).toContain("disabled by default"); expect(html).toContain("not an account password");
    expect(html).not.toContain('href="/fit-insights"');
  });
  it("renders sections and full text escaped, with JSON secondary and collapsed", () => {
    const html = renderToStaticMarkup(createElement(ResumeReview, { resume: { id: "synthetic", text: "<script>synthetic</script>", sections: [{ heading: "Experience", text: "Built a fictional tool" }] } }));
    expect(html).toContain("Experience"); expect(html).toContain("Built a fictional tool");
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
    expect(html.indexOf("Full resume text")).toBeLessThan(html.indexOf("Technical details"));
    expect(html).toContain("best-effort");
  });
  it("does not invent sections for a heading-free resume", () => {
    const html = renderToStaticMarkup(createElement(ResumeReview, { resume: { id: "synthetic", text: "A fictional paragraph" } }));
    expect(html).toContain("No sections were confidently detected"); expect(html).toContain("A fictional paragraph");
  });
  it("preserves onboarding skip/continue and uses the shared explicit upload controls", () => {
    const html = renderToStaticMarkup(createElement(OnboardingFlow));
    expect(html).toContain("Skip for now"); expect(html).toContain("Continue without a resume");
    expect(html).toContain("Extract resume"); expect(html).toContain("Selecting a file does not upload it");
    expect(html).not.toContain("isn&#x27;t connected yet");
  });
});
