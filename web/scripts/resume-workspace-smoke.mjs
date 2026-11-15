/** Production Resume Lab/onboarding smoke using Chromium CDP and Node 22 built-ins.
 * Run a private production server first; then node scripts/resume-workspace-smoke.mjs.
 * Optional: SCALEME_SMOKE_URL, CHROMIUM_PATH, SCALEME_SCREENSHOT_DIR.
 * Only fictional inputs. No cloud/model calls or additional dependencies. */
import assert from 'node:assert/strict';
import { syntheticPdf } from './resume-upload-smoke.mjs';
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
], { windowsHide: true, stdio: 'ignore', env: { ...process.env, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile } });
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
  let storageWrites = 0;
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const handlers = pending.get(event.id); pending.delete(event.id);
      if (event.error) handlers?.reject(new Error(JSON.stringify(event.error)));
      else handlers?.resolve(event.result);
    }
    if (event.method === 'Network.requestWillBeSent') requests.push(event.params.request);
    if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.text);
    if (event.method === 'Runtime.bindingCalled' && event.params.name === '__resumeStorageWrite') storageWrites++;
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
    const found = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.checkVisibility() && (b.getAttribute("aria-label") || b.textContent.trim()) === ${JSON.stringify(name)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
    assert.ok(found, `Missing/disabled button: ${name}`);
  };
  const type = async (selector, value) => {
    await evaluate(`window.__resumeQuery(${JSON.stringify(selector)}).focus()`);
    await command('Input.insertText', { text: value });
  };
  const screenshot = async (name) => {
    if (!process.env.SCALEME_SCREENSHOT_DIR) return;
    await mkdir(process.env.SCALEME_SCREENSHOT_DIR, { recursive: true });
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(process.env.SCALEME_SCREENSHOT_DIR, name), Buffer.from(shot.data, 'base64'));
  };
  await command('Runtime.enable'); await command('Network.enable'); await command('Page.enable');
  await command('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.ok(process.env.RESUME_UPLOAD_TOKEN, 'provide a private synthetic testing code through the environment');
  const fixture = join(profile, 'synthetic-resume.pdf');
  await writeFile(fixture, syntheticPdf());
  const navigate = async (path) => {
    await command('Page.navigate', { url: `${origin}${path}` });
    await wait(`window.__resumeQuery('button') && [...document.querySelectorAll('button')].some(b => Object.keys(b).some(k => k.startsWith('__reactProps$')))`);
  };
  const follow = async (label) => {
    assert.ok(await evaluate(`(() => { const a = [...document.querySelectorAll('a')].find(a => a.checkVisibility() && a.textContent.trim().startsWith(${JSON.stringify(label)})); if (!a) return false; a.click(); return true; })()`), `Missing link: ${label}`);
  };
  const choose = async () => {
    await command('DOM.getDocument');
    const { result: { objectId } } = await command('Runtime.evaluate', { expression: `window.__resumeQuery('input[type=file]')` });
    const { nodeId } = await command('DOM.requestNode', { objectId });
    await command('DOM.setFileInputFiles', { nodeId, files: [fixture] });
    await wait(`document.body.innerText.includes('PDF selected. Nothing has been uploaded.')`);
  };
  const parse = async () => {
    await type('input[type=password]', process.env.RESUME_UPLOAD_TOKEN);
    await click('Extract resume');
  };
  const noOverflow = async () => assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'horizontal overflow');
  await command('Runtime.addBinding', { name: '__resumeStorageWrite' });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `window.__resumeQuery = (selector) => [...document.querySelectorAll(selector)].find(el => el.checkVisibility()); const setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(...args) { window.__resumeStorageWrite('write'); return setItem.apply(this,args); };` });

  await navigate('/dashboard');
  await follow('Resume Lab');
  await wait(`location.pathname === '/resume-lab' && !!window.__resumeQuery('input[type=file]')`);
  await choose();
  assert.equal(requests.filter(r => r.method === 'POST').length, 0, 'selection must not upload');
  await click('Extract resume');
  await wait(`window.__resumeQuery('[role=alert]')?.textContent.includes('project owner')`);
  assert.equal(requests.filter(r => r.method === 'POST').length, 0, 'missing code must not upload');
  await type('input[type=password]', 'synthetic-wrong-code'); await click('Extract resume');
  await wait(`window.__resumeQuery('[role=alert]')?.textContent.includes('was not accepted')`);
  await parse();
  await wait(`!!window.__resumeQuery('#resume-review-title')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Built a fictional scheduling tool with Python.')`));
  assert.ok(await evaluate(`document.activeElement.id === 'resume-review-title'`), 'success receives focus');
  await evaluate(`window.__resumeQuery('summary').focus()`);
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait(`window.__resumeQuery('summary')?.parentElement.open`);
  assert.ok(await evaluate(`!Array.from(document.querySelectorAll('details')).find(d => d.textContent.includes('Resume JSON'))?.open`));
  await screenshot('resume-review-desktop.png');
  await follow('Open Fit Explorer');
  await wait(`location.pathname === '/fit-insights' && [...document.querySelectorAll('textarea')].some(t => t.value.includes('Built a fictional scheduling tool'))`);
  await follow('Upload or review a PDF in Resume Lab');
  await wait(`location.pathname === '/resume-lab' && !!window.__resumeQuery('#resume-review-title')`);
  await click('Clear resume');
  await wait(`!!window.__resumeQuery('input[type=file]') && !window.__resumeQuery('#resume-review-title')`);
  await choose(); await click('Remove selected PDF');
  await wait(`!document.body.innerText.includes('synthetic-resume.pdf')`);
  const localSelections = requests.filter(r => r.method === 'POST').length;
  await evaluate(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.7\\nsynthetic'], 'dropped.pdf', {type:'application/pdf'})); window.__resumeQuery('input[type=file]').closest('div').dispatchEvent(new DragEvent('drop', {dataTransfer:dt,bubbles:true})); })()`);
  await wait(`document.body.innerText.includes('dropped.pdf')`);
  assert.equal(requests.filter(r => r.method === 'POST').length, localSelections, 'drop must not upload');
  await click('Remove selected PDF');
  await evaluate(`(() => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(5*1024*1024+1)], 'oversized.pdf', {type:'application/pdf'})); const input = window.__resumeQuery('input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await wait(`window.__resumeQuery('[role=alert]')?.textContent.includes('5 MiB')`);
  assert.equal(requests.filter(r => r.method === 'POST').length, localSelections, 'oversized file must not upload');

  // Native details and file-picker controls remain keyboard accessible at phone widths.
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await noOverflow(); await screenshot('resume-add-mobile.png');
  await evaluate(`window.__resumeQuery('input[type=file]').focus()`);
  assert.ok(await evaluate(`document.activeElement.type === 'file'`));
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.ok(await evaluate(`document.activeElement.type === 'password'`));
  await click('Open navigation'); await follow('Dashboard');
  await wait(`location.pathname === '/dashboard'`);
  await click('Open navigation'); await follow('Resume Lab');
  await wait(`location.pathname === '/resume-lab' && !!window.__resumeQuery('input[type=file]')`);
  await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: false });
  await noOverflow();
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });

  await navigate('/onboarding');
  await choose();
  const beforeParsing = requests.filter(r => r.method === 'POST').length;
  await click('Continue');
  await wait(`document.body.innerText.includes('What would you like to accomplish?')`);
  await click('Back'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  assert.ok(await evaluate(`document.body.innerText.includes('synthetic-resume.pdf')`), 'back retains local selection');
  assert.equal(requests.filter(r => r.method === 'POST').length, beforeParsing);
  await parse();
  await wait(`document.body.innerText.includes('Resume extracted and ready to review.')`);
  await click('Continue'); await click('Skip for now'); await click('Skip for now'); await click('Finish setup');
  await wait(`document.body.innerText.includes('Your career workspace is ready.')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Extracted · available in this tab')`));
  await follow('Open Resume Lab'); await wait(`!!window.__resumeQuery('#resume-review-title')`);
  await noOverflow(); await screenshot('resume-review-mobile.png');
  await click('Replace resume'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  await choose();
  // Client-side drop replacement must not keep the old parsed result.
  await evaluate(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['renamed content'], 'renamed.pdf', {type:'application/pdf'})); const input = window.__resumeQuery('input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await wait(`window.__resumeQuery('[role=alert]')?.textContent.includes('nonempty text-based PDF')`);
  assert.ok(await evaluate(`!window.__resumeQuery('#resume-review-title')`));
  await choose();
  // Hold transport in browser only, so processing and cancel states are deterministic.
  await evaluate(`window.__originalFetch = window.fetch; window.fetch = (...args) => args[0] === '/api/resume/parse' ? new Promise(() => {}) : window.__originalFetch(...args);`);
  await parse(); await wait(`document.body.innerText.includes('Extracting resume…')`);
  await click('Cancel upload'); await wait(`document.body.innerText.includes('Upload cancelled')`);
  await evaluate(`window.fetch = (...args) => args[0] === '/api/resume/parse' ? Promise.resolve(new Response('{}', {status:503})) : window.__originalFetch(...args);`);
  await parse(); await wait(`window.__resumeQuery('[role=alert]')?.textContent.includes('Private uploads are disabled')`);
  await evaluate(`window.fetch = window.__originalFetch`);
  await navigate('/onboarding'); await choose(); await parse();
  await wait(`document.body.innerText.includes('Resume extracted and ready to review.')`);
  await click('Remove parsed resume'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  await choose(); await click('Skip for now'); await click('Back');
  await wait(`document.body.innerText.includes('Continue without a resume')`);
  assert.ok(await evaluate(`!document.body.innerText.includes('synthetic-resume.pdf')`));
  await click('Skip for now'); await click('Skip for now'); await click('Skip for now'); await click('Skip for now');
  await wait(`document.body.innerText.includes('Your career workspace is ready.')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Not added yet')`));
  await follow('Open Resume Lab'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  await choose(); await parse(); await wait(`!!window.__resumeQuery('#resume-review-title')`);
  await command('Page.reload'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  assert.ok(await evaluate(`!window.__resumeQuery('#resume-review-title')`));
  assert.equal(storageWrites, 0, 'no storage writes across the entire flow');
  assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
  assert.equal(errors.length, 0, 'browser runtime errors');
  assert.equal(requests.filter(r => r.method !== 'GET' && r.method !== 'POST').length, 0);
  assert.ok(requests.filter(r => r.method === 'POST').every(r => r.url === `${origin}/api/resume/parse`), 'no AI or unrelated submissions');
  assert.ok(requests.every(r => r.url.startsWith(origin) || r.url.startsWith('data:')), 'no external requests');
  console.log('Resume workspace Chromium passed: dashboard/navigation, actual synthetic Rust upload, sections, Fit prefill, clear/replace, onboarding back/skip/parse/remove/complete, cancellation, mobile/keyboard, reload, no AI/storage.');
} finally {
  socket?.close(); browser.kill();
  await new Promise((resolve) => { if (browser.exitCode !== null) resolve(); else browser.once('exit', resolve); });
  // Only this script's generated browser profile and synthetic fixture.
  if (profile.startsWith(join(tmpdir(), 'scaleme-ui-'))) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
