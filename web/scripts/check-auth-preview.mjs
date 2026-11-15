// Run against a local production server. Playwright is supplied by the
// verification environment; it is intentionally not an application dependency.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AUTH_PREVIEW_ORIGIN || "http://127.0.0.1:3000";
const screenshotDir = new URL("../../docs/screenshots/auth-preview/", import.meta.url);
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    for (const route of ["sign-in", "sign-up"]) {
      await page.goto(origin + "/" + route);
      await page.waitForLoadState("networkidle");
      assert.equal(await page.title(), route === "sign-in" ? "Sign In Preview | ScaleMe" : "Create Account Preview | ScaleMe");
      assert.equal(await page.locator("form").count(), 0);
      assert.equal(await page.locator("main").evaluate(el => getComputedStyle(el).display), width > 740 ? "grid" : "flex", "Responsive styles are loaded");
      assert.equal(await page.locator("#account-preview").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
      assert.equal(await page.locator("#account-title").evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 27), true);
      assert.equal(await page.locator("input:not(:disabled)").count(), 0);
      assert.equal(await page.locator("input").count(), route === "sign-in" ? 2 : 3);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
      assert.equal(await page.locator("input[type=password]").inputValue(), "");
      const requestLog = [];
      const observe = req => requestLog.push(req.url());
      page.on("request", observe);
      const toggle = page.getByRole("button", { name: "Preview validation states" });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("status").filter({ hasText: "Showing illustrative errors only" }).waitFor();
      assert.equal(await page.locator('input[aria-invalid="true"]').count(), 2);
      assert.equal(await page.getByRole("button", { name: "Hide example errors" }).getAttribute("aria-pressed"), "true");
      assert.match(await page.locator("#email-help").innerText(), /Example error/);
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
      assert.equal(await page.locator("section").last().evaluate(el => getComputedStyle(el).animationName), "none");
      await page.keyboard.press("Space");
      await page.getByRole("button", { name: "Preview validation states" }).waitFor();
      // Enter in a disabled credential field cannot create a submission.
      await page.locator("#preview-password").dispatchEvent("keydown", { key: "Enter" });
      assert.deepEqual(requestLog, [], "Preview interactions make no requests");
      page.off("request", observe);
      assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })), { local: 0, session: 0, cookies: "" });
      assert.deepEqual(await context.cookies(), []);
      if (width === 1440 || width === 390) {
        await page.screenshot({ path: new URL(route + (width === 1440 ? "-desktop.png" : "-mobile.png"), screenshotDir).pathname, fullPage: true });
        await page.getByRole("button", { name: "Preview validation states" }).click();
        await page.screenshot({ path: new URL(route + (width === 1440 ? "-desktop-errors.png" : "-mobile-errors.png"), screenshotDir).pathname, fullPage: true });
      }
      await page.reload();
      await page.getByRole("button", { name: "Preview validation states" }).waitFor();
      assert.equal(await page.locator('input[aria-invalid="true"]').count(), 0, "State resets on reload");
      // Keyboard navigation skips unavailable credentials and actions.
      await page.goto(origin + "/" + route);
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.textContent), "Skip to account preview");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => document.activeElement.id), "account-preview");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.textContent), "Preview validation states");
      const otherRoute = route === "sign-in" ? "/sign-up" : "/sign-in";
      await page.locator('a[href="' + otherRoute + '"]').click();
      await page.waitForURL(origin + otherRoute);
      await page.getByRole("link", { name: "Explore Demo", exact: true }).last().click();
      await page.waitForURL(origin + "/fit-insights");
      await page.getByRole("heading", { name: /Fit Evidence Explorer/i }).waitFor();
      assert.deepEqual(errors, []);
      console.log("PASS " + route + " at " + width + "px: layout, keyboard, preview states, navigation, no requests/storage");
    }
    await context.close();
  }
} finally { await browser.close(); }
