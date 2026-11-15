/** Local synthetic-only production check. No .env file is created or changed. */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:3191";
const env = {
  ...process.env,
  RESUME_UPLOAD_ENABLED: "true",
  RESUME_UPLOAD_EXPIRES_AT: "2099-01-01T00:00:00Z",
  RESUME_UPLOAD_ORIGIN: origin,
  FIT_LIVE_AI_ENABLED: "false",
  SCALEME_SMOKE_URL: origin,
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3191"], { env, windowsHide: true, stdio: "ignore" });
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "local production server did not become ready; build first and leave port 3191 free");
  // One focused production Chromium run by default; older suites remain opt-in.
  const scripts = process.argv.slice(2);
  for (const script of scripts.length ? scripts : ["resume-final-smoke.mjs"]) {
    const child = spawn(process.execPath, [`scripts/${script}`], { env, windowsHide: true, stdio: "inherit" });
    const status = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
    assert.equal(status, 0, `Failed: ${script}`);
  }
} finally {
  server.kill();
}
