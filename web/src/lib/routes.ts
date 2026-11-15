/**
 * Central list of app routes so navigation, cards and next steps stay in sync.
 *
 * `/discover` is implemented separately (PR #37, `feat/job-swipe-discovery`).
 * This branch only links to it and does not create that route.
 */
export const routes = {
  dashboard: "/",
  discover: "/discover",
  /** Resume upload placeholder (PDF parsing not built yet). */
  resumeLab: "/resume-lab",
  /** Fictional Resume Impact Lab prototype from main (Issue #8, PR #39). */
  impactLab: "/impact-lab",
  fit: "/fit",
  interview: "/interview",
  coach: "/coach",
  saved: "/saved",
  settings: "/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
