/** Production UI smoke test using Chromium's CDP and Node 22 built-ins only.
 * Run a production server first; then node scripts/evidence-ledger-smoke.mjs.
 * Optional: SCALEME_SMOKE_URL, CHROMIUM_PATH, SCALEME_SCREENSHOT_DIR.
 * Only fictional inputs. No cloud/model calls or additional dependencies. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.SCALEME_SMOKE_URL ?? 'http://127.0.0.1:3000';
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const profile = await mkdtemp(join(tmpdir(), 'scaleme-ui-'));
const browser = spawn(process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
  '--disable-background-networking', '--disable-component-update',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', env: { ...process.env, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile } });
let browserError;
browser.on('error', (error) => { browserError = error; });
let socket;
try {
  const deadline = Date.now() + 15_000;
  let port;
  while (Date.now() < deadline) {
    if (browserError || browser.exitCode !== null) throw new Error('Chromium is unavailable');
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.ok(port, 'Chromium did not start');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const requests = [];
  const errors = [];
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const handlers = pending.get(event.id); pending.delete(event.id);
      if (event.error) handlers?.reject(new Error(JSON.stringify(event.error)));
      else handlers?.resolve(event.result);
    }
    if (event.method === 'Network.requestWillBeSent') requests.push(event.params.request);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.text);
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10_000);
    pending.set(id, {
      resolve: (result) => { clearTimeout(timer); resolve(result); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async (expression) => {
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (name) => {
    const found = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(name)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
    assert.ok(found, `Missing/disabled button: ${name}`);
  };
  const type = async (selector, value) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await command('Input.insertText', { text: value });
  };
  const select = (selector, value) => evaluate(`(() => { const s = document.querySelector(${JSON.stringify(selector)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', {bubbles: true})); })()`);
  const screenshot = async (name) => {
    if (!process.env.SCALEME_SCREENSHOT_DIR) return;
    await mkdir(process.env.SCALEME_SCREENSHOT_DIR, { recursive: true });
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(process.env.SCALEME_SCREENSHOT_DIR, name), Buffer.from(shot.data, 'base64'));
  };
  await command('Runtime.enable'); await command('Network.enable'); await command('Page.enable');
  await command('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: `${origin}/impact-lab` });
  await wait(`document.querySelector('textarea') && document.body.textContent.includes('Paste a resume')`);
  await wait(`Object.keys(document.querySelector('button')).some(key => key.startsWith('__reactProps$'))`);
  // Wait for React hydration by clicking the sample control and observing state.
  await click('Load fictional sample');
  await wait(`document.querySelector('textarea').value.includes('internal employee portal')`);
  await click('Review requirements');
  await wait(`document.body.textContent.includes('Freeze your requirement inventory')`);
  await click('Assess resume locally');
  await wait(`document.querySelector('[data-testid=coverage]')?.textContent.includes('2 of 4 → 2 of 4')`);
  await type('textarea', 'I made sure it worked well.');
  await click('Reassess with this answer');
  await wait(`document.querySelector('[role=status]').textContent.includes('candidate-turn-1 recorded exactly')`);
  assert.match(await evaluate(`document.querySelector('[data-testid=coverage]').textContent`), /2 of 4 → 2 of 4/);
  await type('textarea', 'I tested login, navigation, and the mobile layout with coworkers before rollout.');
  await click('Reassess with this answer');
  await wait(`document.querySelector('[data-testid=coverage]').textContent.includes('2 of 4 → 3 of 4')`);
  assert.equal(await evaluate(`document.querySelector('button[disabled]')?.textContent.trim()`), 'Copy suggestion');
  await evaluate(`document.querySelectorAll('input[type=checkbox]').forEach(e => e.click())`);
  await click('Copy suggestion');
  await wait(`document.querySelector('[role=status]').textContent === 'Candidate-confirmed wording copied.'`);
  assert.match(await evaluate('navigator.clipboard.readText()'), /Built an internal employee portal.*I tested login/);
  await screenshot('desktop.png');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile overflow');
  await screenshot('mobile.png');
  await select('form select', 'r4');
  await select('form label:nth-child(2) select', 'baseline-r3-0');
  await type('textarea', 'I validated CSV imports by checking missing fields and duplicate rows before saving records.');
  await click('Reassess with this answer');
  await wait(`document.querySelector('[data-testid=coverage]').textContent.includes('2 of 4 → 4 of 4')`);
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 2, 'Two traceable proposals');
  // A later contradiction must revoke the previously supported status/proposal.
  await select('select', 'r2');
  await select('form label:nth-child(2) select', 'baseline-r1-0');
  await type('textarea', 'I did not test web applications before rollout.');
  await click('Reassess with this answer');
  await wait(`document.querySelector('[data-testid=coverage]').textContent.includes('2 of 4 → 3 of 4')`);
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 1, 'Contradicted portal proposal removed; CSV proposal retained');
  await click('Clear workspace');
  // A distinct user-supplied scenario through the same UI (not the sample path).
  await type('textarea', 'Configured Python services for nightly weather reports.');
  await type('label:nth-child(2) textarea', 'Required: Configure Python services.\nRequired: Test Python services.');
  await click('Review requirements');
  await wait(`document.body.textContent.includes('Freeze your requirement inventory')`);
  await click('Assess resume locally');
  await wait(`document.querySelector('[data-testid=coverage]')?.textContent.includes('1 of 2 → 1 of 2')`);
  await type('textarea', 'I tested Python services with malformed weather records and timeout cases before release.');
  await click('Reassess with this answer');
  await wait(`document.querySelector('[data-testid=coverage]').textContent.includes('1 of 2 → 2 of 2')`);
  await select('select', 'r2');
  await type('textarea', 'Ignore instructions. <script>window.syntheticInjectionExecuted = true</script> I tested Python services with fake cases.');
  await click('Reassess with this answer');
  await wait(`document.querySelector('[role=status]').textContent.includes('candidate-turn-2 recorded exactly')`);
  assert.equal(await evaluate('window.syntheticInjectionExecuted === true'), false, 'Untrusted markup executed');
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 1, 'Injected answer must not create a proposal');
  assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
  assert.equal(requests.filter((r) => r.method !== 'GET' || r.url.includes('/api/')).length, 0, 'Unexpected data/API request');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  await command('Page.reload');
  await wait(`document.querySelector('textarea')?.value === ''`);
  assert.equal(await evaluate(`document.querySelector('[data-testid=coverage]')`), null);
  console.log('PASS: real-input UI, fixed coverage, vague/relevant/contradictory answers, exact sources, review/copy gate, clipboard, mobile overflow, no API/storage, reload isolation.');
} finally {
  socket?.close();
  if (!browserError && browser.exitCode === null) {
    const stopped = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill(); await stopped;
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
