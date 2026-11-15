/**
 * Central list of app routes so navigation, cards and next steps stay in sync.
 */
export const routes = {
  /** Public welcome page (Issue #43). */
  home: "/",
  /** Guest-only first-time setup. Nothing is saved; see docs/WELCOME_ONBOARDING.md. */
  onboarding: "/onboarding",
  /** Career dashboard (moved from `/` in Issue #43). */
  dashboard: "/dashboard",
  /**
   * TEMPORARY: points at a labeled placeholder because the real `/discover`
   * route lives in PR #37 (`feat/job-swipe-discovery`) and isn't merged yet.
   * Once #37 merges: set this back to "/discover" and delete
   * `app/(workspace)/discover-preview/`. Using a different path avoids two
   * pages resolving to `/discover`.
   */
  discover: "/discover-preview",
  /** Resume upload is not built. The labeled sample review is `impactLab`. */
  resumeLab: "/resume-lab",
  /** Fictional Resume Impact Lab (Issue #8, PR #39). */
  impactLab: "/impact-lab",
  /**
   * Placeholder kept so PR #46 can replace this page.
   * Sidebar and dashboard links use `fitInsights`.
   */
  fit: "/fit",
  /**
   * Fit Evidence Explorer. Local resume and job drafts, plus an explicitly
   * selected fictional sample. Live analysis is off.
   */
  fitInsights: "/fit-insights",
  interview: "/interview",
  coach: "/coach",
  saved: "/saved",
  settings: "/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

// Sign-in / sign-up entry points and the "accounts actually work" switch live
// in `auth-status.ts`, kept separate on purpose (see that file).
