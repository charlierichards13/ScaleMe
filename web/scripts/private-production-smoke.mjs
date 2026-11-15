/** Free production HTTP checks. Run after FIT_LIVE_AI_ENABLED=false npm run build.
 * Local child processes only. No inherited AWS credentials or model configuration.
 * The enabled-gate cases stop at input/config validation, before SDK construction.
 * This simulates TLS termination; it does not claim a deployed Railway test. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
const token = randomBytes(32).toString('base64url');
const publicOrigin = 'https://fictional-judges.invalid';
const paths = ['/api/fit/analyze', '/api/interview/next', '/api/practice/access'];
const context = { resume: { id: 'fictional', text: 'FICTIONAL: Built a booking form.' },
  job: { id: 'fictional', title: 'FICTIONAL intern', text: 'Build a booking form.' } };
let checks = 0;
assert.ok(!(await readdir('.')).some(name => /^\.env(?:\..+)?$/.test(name) && name !== '.env.example'),
  'Run this offline test in a clean checkout without dotenv files');

async function withServer(settings, verify) {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    // Deliberate allowlist. Do not inherit credentials, profiles, endpoints or .env.local.
    env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
      AWS_EC2_METADATA_DISABLED: 'true', AWS_REGION: '', BEDROCK_MODEL_ID: '',
      FIT_LIVE_AI_ENABLED: 'false', SCALEME_PRIVATE_AI_TOKEN: token,
      RAILWAY_ENVIRONMENT_ID: 'fictional-local-test', ...settings },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 20_000;
    let ready = false;
    while (Date.now() < deadline && child.exitCode === null) {
      try { await fetch(`${base}/api/practice/access`, { method: 'POST', redirect: 'error' }); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, 'Production server did not start');
    await verify(base);
  } finally {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  }
}

async function probe(base, path, status, headers = {}, body, code) {
  const response = await fetch(base + path, { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal(response.status, status, `${path}: expected HTTP ${status}`);
  assert.match(response.headers.get('Cache-Control') ?? '', /no-store/);
  const json = await response.json();
  if (code) assert.equal(json.error?.code, code);
  assert.ok(!JSON.stringify(json).includes(token), 'Access code leaked');
  checks++;
  return response;
}

await withServer({}, async base => {
  for (const path of paths) await probe(base, path, 503, {}, undefined, 'AI_UNAVAILABLE');
  for (const path of ['/api/fit/analyze?demo=true', '/api/interview/next?demo=true&step=0']) {
    const response = await fetch(base + path, { method: 'POST', body: 'not JSON', redirect: 'error' });
    assert.equal(response.status, 200); assert.equal(response.headers.get('X-ScaleMe-Mode'), 'demo'); checks++;
  }
});
for (const origin of [undefined, 'http://fictional-judges.invalid']) {
  await withServer({ FIT_LIVE_AI_ENABLED: 'true', ...(origin ? { SCALEME_PRIVATE_AI_ORIGIN: origin } : {}) }, async base => {
    for (const path of paths) await probe(base, path, 503, { Authorization: `Bearer ${token}` }, undefined, 'AI_UNAVAILABLE');
  });
}
await withServer({ FIT_LIVE_AI_ENABLED: 'true', SCALEME_PRIVATE_AI_ORIGIN: publicOrigin }, async base => {
  const authorized = { Authorization: `Bearer ${token}`, Origin: publicOrigin,
    Host: 'internal.railway:3000', 'X-Forwarded-Host': 'spoofed.invalid', 'X-Forwarded-Proto': 'http' };
  for (const path of paths) {
    await probe(base, path, 401, { Origin: publicOrigin }, undefined, 'PRIVATE_ACCESS_REQUIRED');
    await probe(base, path, 401, { Origin: publicOrigin, Authorization: `Bearer ${'wrong'.repeat(8)}` }, undefined, 'PRIVATE_ACCESS_REQUIRED');
    await probe(base, path, 403, { ...authorized, Origin: 'https://spoofed.invalid' }, undefined, 'PRIVATE_ACCESS_REQUIRED');
    await probe(base, path, 403, { ...authorized, 'Sec-Fetch-Site': 'cross-site' }, undefined, 'PRIVATE_ACCESS_REQUIRED');
    await probe(base, path, 401, { 'x-middleware-subrequest': 'src/proxy:src/proxy:src/proxy:src/proxy:src/proxy' }, undefined, 'PRIVATE_ACCESS_REQUIRED');
  }
  await probe(base, '/api/practice/access', 200, authorized);
  await probe(base, '/api/practice/access?demo=true', 401, {}, undefined, 'PRIVATE_ACCESS_REQUIRED');
  for (const path of paths.slice(0, 2)) {
    await probe(base, path, 400, authorized, '{', 'INVALID_REQUEST');
    await probe(base, path, 413, authorized, 'x'.repeat(200001), 'INVALID_REQUEST');
    const body = JSON.stringify({ ...context, ...(path.includes('interview') ? { history: [] } : {}) });
    await probe(base, path, 503, authorized, body, 'AI_UNAVAILABLE'); // Missing model settings; cannot call AWS.
  }
  const page = await fetch(base + '/interview/contextual');
  assert.equal(page.status, 200); assert.ok(!(await page.text()).includes(token)); checks++;
});
console.log(`PASS: ${checks} production HTTP checks; private gate, pinned proxy origin, spoof denial, validation, free demos. No AWS model configured or invoked.`);
