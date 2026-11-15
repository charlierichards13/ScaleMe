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
  await writeFile(fixture, syntheticPdf('SYNTHETIC RESUME\nEXPERIENCE\nBuilt an internal employee portal for company resources.'));
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

  const original = 'Built an internal employee portal for company resources.';
  const answer = 'I tested login, navigation, and the mobile layout with coworkers before rollout.';
  const job = 'Required: Build web applications.\nRequired: Test web applications.';
  const enter = async () => {
    await command('Input.dispatchKeyEvent', {type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
    await command('Input.dispatchKeyEvent', {type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  };
  const onlyUploads = () => requests.filter(r => r.method === 'POST');
  await navigate('/dashboard');
  assert.ok(await evaluate(`!window.__resumeQuery('#tab-resume-status')`));
  await follow('Resume Lab'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  await choose(); assert.equal(onlyUploads().length, 0, 'selection does not upload');
  await parse(); await wait(`!!window.__resumeQuery('#resume-review-title')`);
  assert.ok(await evaluate(`document.body.innerText.includes(${JSON.stringify(original)})`));
  await click('Improve my resume'); await wait(`!!window.__resumeQuery('#resume-improvement')`);
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea').value`), `SYNTHETIC RESUME\nEXPERIENCE\n${original}`);
  assert.ok(await evaluate(`window.__resumeQuery('#resume-improvement textarea').readOnly`));
  assert.ok(await evaluate(`!document.body.innerText.includes('Explore evidence workflow')`));
  await type('#resume-improvement textarea:not([readonly])', job);
  await click('Review extraction'); await wait(`!!window.__resumeQuery('#resume-review-title')`);
  await click('Improve my resume');
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea:not([readonly])').value`), job, 'stage switch retains job');
  await click('Review requirements'); await wait(`document.body.innerText.includes('Freeze your requirement inventory')`);
  await click('Assess resume locally');
  await wait(`window.__resumeQuery('[data-testid=coverage]')?.textContent.includes('1 of 2 → 1 of 2')`);
  await evaluate(`(() => { const target = window.__resumeQuery('#resume-improvement select'); target.value = 'r2'; target.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await type('#resume-improvement textarea', answer);
  await click('Review extraction'); await click('Improve my resume');
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea').value`), answer, 'stage switch retains pending answer');
  await click('Reassess with this answer');
  await wait(`window.__resumeQuery('[data-testid=coverage]')?.textContent.includes('1 of 2 → 2 of 2')`);
  assert.ok(await evaluate(`window.__resumeQuery('#resume-improvement button[disabled]')?.textContent === 'Copy suggestion'`));
  assert.ok(await evaluate(`document.body.innerText.includes('not independently verified')`));
  await evaluate(`window.__resumeQuery('#resume-improvement input[type=checkbox]').focus()`);
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:' ',code:'Space',text:' ',windowsVirtualKeyCode:32});
  await command('Input.dispatchKeyEvent', {type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await wait(`window.__resumeQuery('#resume-improvement input[type=checkbox]').checked`);
  assert.ok(await evaluate(`!!window.__resumeQuery('#resume-improvement button[disabled]')`), 'one confirmation is insufficient');
  await evaluate(`[...document.querySelectorAll('#resume-improvement input[type=checkbox]')].filter(e => e.checkVisibility() && !e.checked).forEach(e=>e.click())`);
  await click('Copy suggestion'); await wait(`window.__resumeQuery('#resume-improvement [role=status]')?.textContent === 'Candidate-confirmed wording copied.'`);
  assert.equal(await evaluate('navigator.clipboard.readText()'), `${original} ${answer}`, 'copy contains only exact source statements');
  await screenshot('integrated-improvement-desktop.png');
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
  await noOverflow(); await screenshot('integrated-improvement-mobile.png');
  await command('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await type('#resume-improvement textarea', 'I did not test web applications before rollout.');
  await click('Reassess with this answer');
  await wait(`window.__resumeQuery('[data-testid=coverage]')?.textContent.includes('1 of 2 → 1 of 2')`);
  assert.ok(await evaluate(`!window.__resumeQuery('#resume-improvement article')`), 'contradicted proposal is revoked');
  assert.equal(onlyUploads().length, 1, 'local improvement never invokes AI');
  await follow('Open Fit Explorer');
  await wait(`location.pathname === '/fit-insights' && window.__resumeQuery('textarea')?.value.includes(${JSON.stringify(original)})`);
  await follow('Back to dashboard');
  await wait(`location.pathname === '/dashboard' && !!window.__resumeQuery('#tab-resume-status')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Resume ready to review')`));
  assert.ok(await evaluate(`document.body.innerText.includes('Review or improve your resume')`));
  await click('Sample data');
  await wait(`document.body.innerText.includes('Separate from the fictional sample profile below.')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Sample resume (fictional)')`), 'demo is not replaced by parsed input');
  await click('Sample data');
  await follow('Continue in Resume Lab');
  await wait(`location.pathname === '/resume-lab' && !!window.__resumeQuery('#resume-improvement')`);
  assert.ok(await evaluate(`!!window.__resumeQuery('[data-testid=coverage]')`), 'route return retains improvement');
  await click('Review extraction'); await click('Clear resume');
  await wait(`!!window.__resumeQuery('input[type=file]') && !window.__resumeQuery('#resume-improvement')`);
  await follow('Dashboard'); await wait(`location.pathname === '/dashboard'`);
  assert.ok(await evaluate(`!window.__resumeQuery('#tab-resume-status') && !document.body.innerText.includes('Review or improve your resume')`));
  await follow('Resume Lab'); await wait(`!!window.__resumeQuery('input[type=file]')`);
  await click('Use pasted resume text');
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea').value`), '', 'old source/answers/suggestions cleared');
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea:not([readonly])').value`), '');
  await click('Back to upload');

  await navigate('/onboarding'); await choose();
  const beforeEnter = onlyUploads().length;
  await evaluate(`window.__resumeQuery('input[type=password]').focus()`); await enter();
  await wait(`window.__resumeQuery('[role=alert]')?.textContent.includes('project owner')`);
  assert.equal(onlyUploads().length, beforeEnter, 'missing code Enter does not send a request');
  assert.ok(await evaluate(`!!window.__resumeQuery('input[type=file]')`), 'missing code Enter does not advance onboarding');
  await type('input[type=password]', process.env.RESUME_UPLOAD_TOKEN);
  await enter();
  await wait(`document.body.innerText.includes('Resume extracted and ready to review.')`);
  assert.equal(onlyUploads().length, beforeEnter + 1, 'Enter performs exactly one explicit extraction');
  assert.ok(await evaluate(`!document.body.innerText.includes('What would you like to accomplish?')`), 'valid code Enter does not Continue');
  await click('Continue'); await wait(`document.body.innerText.includes('What would you like to accomplish?')`);
  await click('Skip for now'); await wait(`!!window.__resumeQuery('input[type=text]')`);
  await type('input[type=text]', 'Synthetic engineering'); await enter();
  await wait(`document.body.innerText.includes('One last thing: make ScaleMe yours.')`);
  await click('Finish setup'); await wait(`document.body.innerText.includes('Your career workspace is ready.')`);
  await follow('Go to Dashboard'); await wait(`!!window.__resumeQuery('#tab-resume-status')`);
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
  await noOverflow(); await screenshot('dashboard-tab-resume-mobile.png');
  await command('Emulation.setDeviceMetricsOverride', {width:320,height:844,deviceScaleFactor:1,mobile:false});
  await noOverflow();
  await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
  await follow('Continue in Resume Lab'); await wait(`!!window.__resumeQuery('#resume-review-title')`);
  await click('Improve my resume'); await wait(`!!window.__resumeQuery('#resume-improvement textarea')`);
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea:not([readonly])').value`), '', 'new extraction has no old job');
  await type('#resume-improvement textarea:not([readonly])', job);
  await click('Reset improvement'); await click('Keep working');
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea:not([readonly])').value`), job);
  await click('Reset improvement'); await click('Discard improvement and reset');
  assert.equal(await evaluate(`window.__resumeQuery('#resume-improvement textarea:not([readonly])').value`), '');
  assert.ok(await evaluate(`window.__resumeQuery('#resume-improvement textarea[readonly]').value.includes(${JSON.stringify(original)})`), 'reset keeps actual uploaded source');
  await click('Review extraction'); await follow('Open Fit Explorer'); await follow('Back to dashboard');
  await wait(`!!window.__resumeQuery('#tab-resume-status')`);
  await command('Page.reload');
  await wait(`!!window.__resumeQuery('button') && !window.__resumeQuery('#tab-resume-status')`);
  assert.ok(await evaluate(`!document.body.innerText.includes('Review or improve your resume')`), 'reload returns guest dashboard');

  // Narrow browser compatibility checks; existing unit suites cover full interviews.
  await navigate('/interview');
  assert.ok(await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.checkVisibility()&&b.textContent.includes('Start technical practice'))`));
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.checkVisibility()&&b.textContent.includes('Start technical practice')).click()`);
  await wait(`!!window.__resumeQuery('textarea')`);
  await type('textarea', 'I built a fictional portal and discussed how it worked.');
  await click('Submit answer'); await wait(`document.body.innerText.includes('I built a fictional portal and discussed how it worked.') && window.__resumeQuery('textarea').value === ''`);
  await navigate('/interview/contextual');
  await wait(`document.body.innerText.includes('Turn your experience into evidence')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Private live AI access')`));
  assert.equal(onlyUploads().length, 2);
  assert.ok(onlyUploads().every(r => r.url === `${origin}/api/resume/parse`));
  assert.ok(requests.every(r => r.url.startsWith(origin) || r.url.startsWith('data:')), 'no external requests');
  assert.equal(storageWrites, 0); assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: actual synthetic PDF → Rust → integrated ledger → confirmed exact-source copy; contradiction revocation, retained stages, clear/reset, tab-aware/demo-isolated dashboard, onboarding Enter/no-Continue/no-double-submit, mobile/keyboard, reload, interview compatibility; no AI/external/storage calls.');
} finally {
  socket?.close(); browser.kill();
  await new Promise((resolve) => { if (browser.exitCode !== null) resolve(); else browser.once('exit', resolve); });
  if (profile.startsWith(join(tmpdir(), 'scaleme-ui-'))) await rm(profile, {recursive:true,force:true,maxRetries:10,retryDelay:200});
}
