import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isActive, primaryNav, secondaryNav } from "@/components/layout/nav-items";
import { getDashboardSnapshot } from "@/lib/dashboard/snapshot";
import { accountsEnabled, authPages, getStartedHref, showSignInLink } from "./auth-status";
import { routes } from "./routes";

const appDir = fileURLToPath(new URL("../app", import.meta.url));

/** True when some `page.tsx` under app/ resolves to `pathname`, ignoring route groups like `(workspace)`. */
function pageExists(pathname: string, dir = appDir): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 && existsSync(join(dir, "page.tsx"))) return true;
  const groups = readdirSync(dir, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("(") && entry.name.endsWith(")"),
  );
  if (groups.some((group) => pageExists(pathname, join(dir, group.name)))) return true;
  if (segments.length === 0) return false;
  const [head, ...rest] = segments;
  const next = join(dir, head);
  return existsSync(next) && pageExists(`/${rest.join("/")}`, next);
}

describe("internal links", () => {
  it("every route constant resolves to an existing page (no 404 links)", () => {
    const missing = Object.entries(routes).filter(([, href]) => !pageExists(href));
    expect(missing).toEqual([]);
  });

  it("every sidebar item and next step points at a known route", () => {
    const known = new Set<string>(Object.values(routes));
    const hrefs = [
      ...primaryNav.map((item) => item.href),
      ...secondaryNav.map((item) => item.href),
      ...getDashboardSnapshot("empty").nextSteps.map((step) => step.href),
      ...getDashboardSnapshot("demo").nextSteps.map((step) => step.href),
    ];
    for (const href of hrefs) expect(known.has(href), href).toBe(true);
  });
});

describe("welcome / dashboard split (Issue #43)", () => {
  it("serves the welcome page at / and the dashboard at /dashboard", () => {
    expect(routes.home).toBe("/");
    expect(routes.dashboard).toBe("/dashboard");
    expect(existsSync(join(appDir, "page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "(workspace)", "dashboard", "page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "onboarding", "page.tsx"))).toBe(true);
  });

  it("no route group also defines a page at / (that would collide with the welcome page)", () => {
    const groups = readdirSync(appDir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("("),
    );
    const collisions = groups.filter((group) => existsSync(join(appDir, group.name, "page.tsx")));
    expect(collisions.map((group) => group.name)).toEqual([]);
  });

  it("the sidebar's Dashboard item points at /dashboard, not the welcome page", () => {
    expect(primaryNav.find((item) => item.label === "Dashboard")?.href).toBe("/dashboard");
  });
});

describe("account entry points vs. working accounts (Issue #42 boundary)", () => {
  it("accounts are not enabled in this build", () => {
    expect(accountsEnabled).toBe(false);
  });

  it("Get Started keeps visitors on the guest pathway whether or not the #42 screens exist", () => {
    // Only `accountsEnabled` decides; the sign-up screen existing (UI only) does not.
    expect(getStartedHref()).toBe(routes.onboarding);
    expect(showSignInLink()).toBe(false);
    expect(pageExists(routes.onboarding)).toBe(true);
    expect(pageExists(routes.dashboard)).toBe(true);
  });

  it("only working accounts send Get Started to sign-up and show a real Sign in link", () => {
    expect(getStartedHref(true)).toBe(authPages.signUp);
    expect(showSignInLink(true)).toBe(true);
  });

  it("accounts can only be enabled once both account pages exist (no 404 links)", () => {
    if (accountsEnabled) {
      expect(pageExists(authPages.signIn)).toBe(true);
      expect(pageExists(authPages.signUp)).toBe(true);
    }
  });
});

describe("isActive", () => {
  it("matches the dashboard on its own route only", () => {
    expect(isActive("/dashboard", routes.dashboard)).toBe(true);
    expect(isActive("/", routes.dashboard)).toBe(false);
    expect(isActive("/fit", routes.dashboard)).toBe(false);
  });

  it("matches the root only at the root", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/fit", "/")).toBe(false);
  });

  it("matches a section and its sub-pages but not look-alike paths", () => {
    expect(isActive("/fit", "/fit")).toBe(true);
    expect(isActive("/fit/details", "/fit")).toBe(true);
    expect(isActive("/fit-insights", "/fit")).toBe(false);
  });
});
