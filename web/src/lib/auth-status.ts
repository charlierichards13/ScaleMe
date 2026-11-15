import { routes } from "./routes";

/**
 * Account entry points (Issue #43 ↔ Issue #42).
 *
 * Two separate facts, deliberately not linked:
 *
 * 1. `authPages`: where the sign-in / sign-up screens live. Issue #42 builds
 *    these screens (UI only). A page existing does NOT mean anyone can
 *    actually create an account or sign in.
 * 2. `accountsEnabled`: true only once real, server-side authentication works
 *    end to end. That means accounts can be created, sessions are verified on
 *    the server, and onboarding answers are stored with access control. Flip it
 *    only in the PR that ships that, after its security/privacy review. Never
 *    infer it from a page existing, a client flag, or a cookie.
 *
 * While `accountsEnabled` is false the welcome page keeps every visitor on the
 * working guest pathway (Get Started → /onboarding → /dashboard), even after
 * the #42 screens merge. The welcome page never links into a registration form
 * that can't create accounts.
 */
export const authPages = {
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const;

export const accountsEnabled: boolean = false;

/** Where every welcome-page "Get Started" button goes. */
export function getStartedHref(enabled: boolean = accountsEnabled): string {
  return enabled ? authPages.signUp : routes.onboarding;
}

/** Whether the header shows a real "Sign in" link (otherwise an explanatory note). */
export function showSignInLink(enabled: boolean = accountsEnabled): boolean {
  return enabled;
}
