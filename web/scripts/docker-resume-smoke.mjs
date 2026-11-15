import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { smoke } from "./resume-upload-smoke.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const name = `scaleme-synthetic-${randomBytes(6).toString("hex")}`;
const base = "http://127.0.0.1:3187";
process.env.RESUME_UPLOAD_TOKEN = randomBytes(32).toString("hex");
process.env.RESUME_UPLOAD_ORIGIN = base;
process.env.RESUME_UPLOAD_ENABLED = "true";
execFileSync("docker", ["build", "-t", "scaleme-resume:test", "."], { cwd: root, stdio: "inherit" });
const config = JSON.parse(execFileSync("docker", ["image", "inspect", "scaleme-resume:test"], { encoding: "utf8" }))[0].Config;
assert.equal(config.User, "node");
assert.ok(config.Env.includes("RESUME_UPLOAD_ENABLED=false"), "image must default to disabled uploads");
try {
  execFileSync("docker", ["run", "-d", "--name", name, "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=32m", "--memory", "768m", "--cpus", "2", "--pids-limit", "128", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--ulimit", "core=0", "-p", "127.0.0.1:3187:3000", "--env", "RESUME_UPLOAD_TOKEN", "--env", "RESUME_UPLOAD_ENABLED", "--env", "RESUME_UPLOAD_ORIGIN", "scaleme-resume:test"], { stdio: "pipe" });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "container did not become ready");
  await smoke(base, process.env.RESUME_UPLOAD_TOKEN);
  assert.equal(execFileSync("docker", ["diff", name], { encoding: "utf8" }).trim(), "", "container filesystem must stay unchanged");
  const captured = spawnSync("docker", ["logs", name], { encoding: "utf8" });
  assert.equal(captured.status, 0);
  const logs = captured.stdout + captured.stderr;
  for (const canary of ["Built a fictional scheduling tool", "synthetic-resume.pdf", process.env.RESUME_UPLOAD_TOKEN]) assert.ok(!logs.includes(canary), "private data appeared in logs");
} finally {
  execFileSync("docker", ["rm", "-f", name], { stdio: "pipe" });
}
