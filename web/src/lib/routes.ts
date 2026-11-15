/**
 * Central list of app routes so navigation, cards and next steps stay in sync.
 *
 * `/discover` is implemented separately (PR #37, `feat/job-swipe-discovery`).
 * This branch only links to it and does not create that route.
 */
export const routes = {
  dashboard: "/",
  discover: "/discover",
  resumeLab: "/resume-lab",
  fit: "/fit",
  interview: "/interview",
  coach: "/coach",
  saved: "/saved",
  settings: "/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
