import { demoInsights, demoJobs, demoProfile } from "./demo-data";
import type { CandidateProfile, DashboardSnapshot, DataSource, NextStep } from "./types";
import { routes } from "@/lib/routes";

/**
 * Builds the dashboard view model. Pure and deterministic (no Date, no
 * randomness) so it is safe during static prerendering.
 *
 * - "empty": what a new visitor sees today. There are no accounts or stored
 *   profiles yet, so nothing is invented.
 * - "demo": clearly labeled fictional fixtures for walkthroughs.
 *
 * A future live source (persisted profile + `/api/fit/analyze` + jobs service)
 * should return the same `DashboardSnapshot` shape with its own `source` value.
 */
export function getDashboardSnapshot(source: DataSource): DashboardSnapshot {
  if (source === "demo") {
    return {
      source,
      profile: demoProfile,
      jobs: demoJobs,
      insights: demoInsights,
      nextSteps: getNextSteps(demoProfile, true),
    };
  }

  const profile: CandidateProfile = { hasResume: false, authorizationGuidance: null };
  return { source, profile, jobs: [], insights: [], nextSteps: getNextSteps(profile, false) };
}

/**
 * Suggests pages that work in this build. The fit explorer does not read
 * this dashboard profile, and interview answers stay on the interview page.
 */
export function getNextSteps(profile: CandidateProfile, hasInsights: boolean): NextStep[] {
  const steps: NextStep[] = [];

  if (!profile.hasResume) {
    steps.push({
      id: "open-resume-lab",
      title: "Start in Resume Lab",
      description: "Private synthetic PDF extraction, readable review and next steps.",
      href: routes.resumeLab,
      cta: "Open Resume Lab",
    });
  } else {
    steps.push({
      id: "explain-project",
      title: "Review a sample resume story",
      description: "Confirm sample quotes, then copy a supported bullet.",
      href: routes.impactLab,
      cta: "Open sample",
    });
  }

  if (!profile.targetRole) {
    steps.push({
      id: "preview-goals",
      title: "Preview goal setup",
      description: "Optional questions for this visit.",
      href: routes.onboarding,
      cta: "Open setup",
    });
  }

  steps.push(
    hasInsights
      ? {
          id: "review-gaps",
          title: "Open the fit explorer",
          description: "Prepare a resume and job on this device, or open a fictional sample. Live analysis is off.",
          href: routes.fitInsights,
          cta: "Open explorer",
        }
      : {
          id: "open-sample-fit",
          title: "Open the fit explorer",
          description: "Prepare a resume and job on this device, or open a fictional sample. Live analysis is off.",
          href: routes.fitInsights,
          cta: "Open explorer",
        },
    {
      id: "mock-interview",
      title: "Practice a mock interview",
      description: "A fixed script. Reread your own words.",
      href: routes.interview,
      cta: "Practice",
    },
  );

  return steps.slice(0, 4);
}
