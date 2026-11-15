/**
 * Central list of app routes so navigation, cards and next steps stay in sync.
 */
export const routes = {
  dashboard: "/",
  /**
   * TEMPORARY: points at a labeled placeholder because the real `/discover`
   * route lives in PR #37 (`feat/job-swipe-discovery`) and isn't merged yet.
   * Once #37 merges: set this back to "/discover" and delete
   * `app/(workspace)/discover-preview/`. Using a different path avoids two
   * pages resolving to `/discover`.
   */
  discover: "/discover-preview",
  /** Resume upload placeholder (PDF parsing not built yet). */
  resumeLab: "/resume-lab",
  /** Fictional Resume Impact Lab prototype from main (Issue #8, PR #39). */
  impactLab: "/impact-lab",
  /** Placeholder; connect to `/fit-insights` once PR #41 merges. */
  fit: "/fit",
  interview: "/interview",
  coach: "/coach",
  saved: "/saved",
  settings: "/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
