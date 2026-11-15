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

/**
 * Account pages owned by Issue #42 (another branch). They are NOT in `routes`
 * because they don't exist on this branch, and the route test rejects links
 * that would 404. When #42 merges: move these into `routes` and set
 * `authAvailable` to true so the welcome page links to them directly.
 */
export const plannedAuthRoutes = {
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;

export const authAvailable = false;
