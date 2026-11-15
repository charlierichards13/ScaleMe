import type { Resume } from "@/lib/ai/schemas";
import { routes } from "@/lib/routes";
import type { DashboardSnapshot } from "./types";

/** Client-view overlay only. Never mutate the deterministic guest/demo snapshot. */
export function dashboardWithResume(snapshot: DashboardSnapshot, resume: Resume | null): DashboardSnapshot {
  if (!resume || snapshot.source === "demo") return snapshot;
  return {
    ...snapshot,
    profile: { ...snapshot.profile, hasResume: true, resumeLabel: "Resume ready to review · this tab only" },
    nextSteps: [
      { id: "tab-resume-review", title: "Review or improve your resume", description: "Your extracted resume is available in this tab. Improvement runs locally.", href: routes.resumeLab, cta: "Open Resume Lab" },
      { id: "tab-resume-fit", title: "Prepare your fit draft", description: "Use the extracted text in Fit Explorer. Live analysis remains off.", href: routes.fitInsights, cta: "Open Fit Explorer" },
      ...snapshot.nextSteps.filter((step) => step.href !== routes.resumeLab && step.href !== routes.fitInsights),
    ].slice(0, 4),
  };
}
