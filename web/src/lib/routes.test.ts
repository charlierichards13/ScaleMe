import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isActive, primaryNav, secondaryNav } from "@/components/layout/nav-items";
import { getDashboardSnapshot } from "@/lib/dashboard/snapshot";
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

describe("isActive", () => {
  it("matches the dashboard only at the root", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/fit", "/")).toBe(false);
  });

  it("matches a section and its sub-pages but not look-alike paths", () => {
    expect(isActive("/fit", "/fit")).toBe(true);
    expect(isActive("/fit/details", "/fit")).toBe(true);
    expect(isActive("/fit-insights", "/fit")).toBe(false);
  });
});
