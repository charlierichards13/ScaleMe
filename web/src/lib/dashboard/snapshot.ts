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

/** Suggests the next meaningful actions from what the user actually has. */
export function getNextSteps(profile: CandidateProfile, hasInsights: boolean): NextStep[] {
  const steps: NextStep[] = [];

  if (!profile.hasResume) {
    steps.push({
      id: "add-resume",
      title: "Add your resume",
      description: "Everything else builds on your real experience.",
      href: routes.resumeLab,
      cta: "Add resume",
    });
  }

  if (!profile.targetRole) {
    steps.push({
      id: "set-goal",
      title: "Set a target role",
      description: "Tell ScaleMe what kind of role and timeline you're aiming for.",
      href: routes.settings,
      cta: "Set goals",
    });
  }

  if (profile.hasResume) {
    steps.push({
      id: "explain-project",
      title: "Explain a project more clearly",
      description: "Answer follow-up questions about problem, decisions and impact.",
      href: routes.impactLab,
      cta: "Start",
    });
  }

  steps.push(
    hasInsights
      ? {
          id: "review-gaps",
          title: "Clarify unclear evidence",
          description: "Some requirements need more detail before they count as supported.",
          href: routes.fit,
          cta: "Review",
        }
      : {
          id: "analyze-role",
          title: "Analyze a role",
          description: "Compare your experience with a job description.",
          href: routes.fit,
          cta: "Analyze",
        },
    {
      id: "mock-interview",
      title: "Practice a mock interview",
      description: "Rehearse explaining your decisions out loud.",
      href: routes.interview,
      cta: "Practice",
    },
  );

  return steps.slice(0, 4);
}
