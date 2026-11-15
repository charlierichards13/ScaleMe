import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AuthPreview, { type PreviewMode } from "./auth-preview";

describe.each<PreviewMode>(["sign-in", "sign-up"])("%s preview safety", (mode) => {
  const markup = () => renderToStaticMarkup(createElement(AuthPreview, { mode }));

  it("warns before the credential fields and never offers a submitting form", () => {
    const html = markup();
    expect(html).toContain("Accounts/sign-in are not enabled in this prototype. Do not enter real passwords.");
    expect(html.indexOf("Do not enter real passwords.")).toBeLessThan(html.indexOf("<input"));
    expect(html).not.toMatch(/<form|type="submit"|action=/);
    expect(html).toContain("No user accounts, login, or privacy guarantees exist yet.");
  });

  it("disables every input and prevents credential autofill or named submission", () => {
    const inputs = markup().match(/<input\b[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(mode === "sign-up" ? 3 : 2);
    for (const input of inputs) {
      expect(input).toContain('disabled=""');
      expect(input).toContain('autoComplete="off"');
      expect(input).not.toMatch(/\b(name|value)=/);
      expect(input).toContain('aria-describedby=');
    }
    expect(markup()).toContain('type="password"');
  });

  it("offers only deliberate local navigation and honest unavailable actions", () => {
    const html = markup();
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["#account-preview", "/", "/fit-insights", mode === "sign-in" ? "/sign-up" : "/sign-in", "/fit-insights"]);
    expect(html).toContain("Identity provider sign-in");
    expect(html).toContain('aria-controls="validation-status email-help password-help"');
    expect(html).toContain('role="status"');
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.filter((b) => !b.includes('disabled=""'))).toHaveLength(1);
    expect(buttons.every((b) => b.includes('type="button"'))).toBe(true);
  });
});
