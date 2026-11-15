/** Dashboard/shared shell production regression test using Chromium's CDP and Node 22 built-ins only.
 * Run a production server first; then node scripts/dashboard-workspace-smoke.mjs.
 * Optional: SCALEME_SMOKE_URL, CHROMIUM_PATH, SCALEME_SCREENSHOT_DIR.
 * Only fictional inputs. No cloud/model calls or additional dependencies. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.SCALEME_SMOKE_URL ?? 'http://127.0.0.1:3000';
assert.match(origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const profile = await mkdtemp(join(tmpdir(), 'scaleme-dashboard-'));
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
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    console.error(await evaluate(`({open: document.querySelector('dialog')?.open, focus: document.activeElement?.outerHTML.slice(0,250), expanded: document.querySelector('[aria-label="Open navigation"]')?.getAttribute('aria-expanded')})`), errors);
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (name) => {
    const found = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(name)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
    assert.ok(found, `Missing/disabled button: ${name}`);
  };
  const key = async (key, code, modifiers = 0) => {
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers, ...(key === 'Enter' ? {text: '\r'} : {}) });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode: code, modifiers });
  };
  const settle = () => evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150))))`);
  const screenshot = async (name) => {
    if (!process.env.SCALEME_SCREENSHOT_DIR) return;
    await settle();
    await mkdir(process.env.SCALEME_SCREENSHOT_DIR, { recursive: true });
    const { cssContentSize } = await command('Page.getLayoutMetrics');
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !name.includes('drawer'), ...(name.includes('drawer') ? {} : { clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } }) });
    await writeFile(join(process.env.SCALEME_SCREENSHOT_DIR, name), Buffer.from(shot.data, 'base64'));
  };
  const viewport = async (width, height = 900) => {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await settle();
  };
  const overflow = async (label) => assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), `${label}: horizontal overflow`);
  const go = async (path) => {
    await command('Page.navigate', { url: `${origin}${path}` });
    await wait(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)}`);
    await evaluate('document.fonts.ready.then(() => true)');
    await settle();
  };
  await command('Runtime.enable'); await command('Network.enable'); await command('Page.enable');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await viewport(width, width === 390 ? 844 : 1000);
    await go('/dashboard');
    await wait(`document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'false'`);
    await overflow(`empty ${width}`);
    assert.equal(await evaluate(`document.querySelectorAll('section[aria-labelledby="tools-heading"] li').length`), 4);
    assert.equal(await evaluate(`document.querySelectorAll('article').length`), 0, 'Guest must be empty');
    const cards = await evaluate(`Array.from(document.querySelectorAll('section[aria-labelledby="tools-heading"] li a')).map(a => ({ href: a.getAttribute('href'), height: a.getBoundingClientRect().height, width: a.getBoundingClientRect().width }))`);
    assert.deepEqual(cards.map(c => c.href), ['/discover-preview', '/fit-insights', '/impact-lab', '/interview']);
    assert.ok(cards.every(c => c.height >= 44 && c.width >= 44));
    assert.ok(Math.abs(cards[0].height - cards[1].height) < 1, 'Paired tool heights');
    if ([390, 1440].includes(width)) await screenshot(`after-empty-${width}.png`);
    await click('Explore with sample data');
    await wait(`document.querySelector('[role=switch]').getAttribute('aria-checked') === 'true'`);
    await settle();
    await overflow(`sample ${width}`);
    assert.equal(await evaluate(`document.querySelectorAll('article').length`), 3, 'Three fictional roles');
    assert.ok(await evaluate(`document.body.textContent.includes('Not evidenced ≠ missing skill.')`));
    for (const status of ['Supported', 'Not evidenced', 'Needs clarification']) assert.ok(await evaluate(`document.querySelector('[aria-labelledby="evidence-heading"]').textContent.includes(${JSON.stringify(status)})`));
    assert.equal(await evaluate(`document.querySelectorAll('blockquote').length`), 2, 'Sample quotes retained');
    if ([390, 1440].includes(width)) await screenshot(`after-sample-${width}.png`);
    await evaluate(`document.querySelector('button[aria-label^="Save "]').click()`);
    await wait(`document.querySelector('button[aria-pressed=true]')`);
    await evaluate(`document.querySelector('button[aria-label^="Unsave "]').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('button[aria-pressed=true]').length`), 0);
    await evaluate(`document.querySelector('button[aria-label^="Save "]').click()`);
    await click('Exit demo');
    await wait(`document.querySelector('[role=switch]').getAttribute('aria-checked') === 'false'`);
    await evaluate(`document.querySelector('[role=switch]').click()`);
    await wait(`document.querySelector('article')`);
    assert.equal(await evaluate(`document.querySelectorAll('button[aria-pressed=true]').length`), 0, 'Toggle clears temporary saves');
    console.log(`PASS ${width}px: empty/sample, four routes, quotes/statuses, temporary save/unsave/reset, no overflow`);
  }
  // Reflow at the CSS viewport of a 1440px display at 200% browser zoom.
  await viewport(720, 500);
  await overflow('200% equivalent viewport');
  // Additional text enlargement catches clipped labels independently of reflow.
  await evaluate(`document.documentElement.style.fontSize = '200%'`);
  await settle();
  await overflow('200% text enlargement');
  await evaluate(`document.documentElement.style.fontSize = ''`);

  await viewport(390, 844);
  await go('/dashboard');
  await key('Tab', 9);
  await wait(`document.activeElement.textContent.includes('Skip to content')`);
  assert.equal(await evaluate(`getComputedStyle(document.activeElement).position`), 'fixed', 'Visible skip link');
  await key('Enter', 13);
  await wait(`document.activeElement.id === 'main'`);
  await evaluate(`document.querySelector('[aria-label="Open navigation"]').focus()`);
  await key('Enter', 13);
  await wait(`document.querySelector('dialog').open && document.activeElement.getAttribute('aria-label') === 'Close navigation'`);
  assert.equal(await evaluate(`document.querySelector('dialog').matches(':modal')`), true);
  assert.equal(await evaluate(`document.body.style.overflow`), 'hidden');
  // Attempts to focus the underlying UI must fail while the native modal is open.
  await evaluate(`document.querySelector('[role=switch]').focus()`);
  assert.equal(await evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true);
  for (const modifiers of [0, 8]) {
    for (let i = 0; i < 24; i++) {
      await key('Tab', 9, modifiers);
      assert.ok(await evaluate(`document.querySelector('dialog').contains(document.activeElement) || document.activeElement === document.body`), 'Background keyboard focus escaped modal');
    }
  }
  await evaluate(`document.querySelector('[aria-label="Close navigation"]').focus()`);
  assert.ok(await evaluate(`getComputedStyle(document.activeElement).boxShadow !== 'none'`), 'Visible keyboard focus ring');
  await screenshot('after-drawer-390.png');
  await key('Escape', 27);
  await wait(`!document.querySelector('dialog').open && document.activeElement.getAttribute('aria-label') === 'Open navigation'`);
  assert.equal(await evaluate(`document.body.style.overflow`), '');
  // Pointer dismissal on the empty area of the dialog.
  await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);
  await wait(`document.querySelector('dialog').open`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: 375, y: 400, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 375, y: 400, button: 'left', clickCount: 1 });
  await wait(`!document.querySelector('dialog').open`);
  await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);
  await wait(`document.querySelector('dialog').open`);
  await evaluate(`document.querySelector('dialog a[href="/discover-preview"]').click()`);
  await wait(`location.pathname === '/discover-preview' && !document.querySelector('dialog').open`);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Open navigation');
  await evaluate(`document.querySelector('[aria-label="Open navigation"]').click()`);
  await wait(`document.querySelector('dialog').open`);
  await viewport(1024);
  await wait(`!document.querySelector('dialog').open`);
  assert.equal(await evaluate(`document.body.style.overflow`), '');
  console.log('PASS modal: initial focus, native inertness, Tab/Shift+Tab, focus ring, Escape, focus return, pointer dismissal, navigation closure, desktop resize');

  // Visit every link exposed on the dashboard; no endpoint/inference calls.
  await viewport(1440, 1000);
  await go('/dashboard');
  const hrefs = await evaluate(`Array.from(new Set(Array.from(document.querySelectorAll('main a[href]')).map(a => a.getAttribute('href'))))`);
  for (const href of hrefs) {
    assert.equal((await fetch(`${origin}${href}`)).status, 200, `Dead link ${href}`);
  }
  for (const width of [320, 390, 1440]) {
    await viewport(width);
    for (const path of ['/discover-preview', '/resume-lab', '/saved', '/settings', '/fit', '/interview', '/impact-lab', '/fit-insights']) {
      await go(path);
      await overflow(`${path} ${width}`);
    }
  }
  await go('/interview');
  assert.equal(await evaluate(`document.querySelector('a[href="/interview/contextual"]').textContent.trim()`), 'Open contextual interview');
  await go('/interview/contextual');
  await overflow('contextual entry');
  await go('/dashboard');
  assert.equal(await evaluate(`document.querySelector('[role=switch]').getAttribute('aria-checked')`), 'false', 'Reload resets demo');
  assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
  const logos = await evaluate(`Array.from(document.querySelectorAll('img')).filter(i => i.getBoundingClientRect().width > 0).map(i => ({ src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 }))`);
  assert.ok(logos.length > 0 && logos.every(i => i.loaded));
  assert.ok(logos.every(i => /\/brand\/(icon|logo)\.svg/.test(i.src)), 'Original light-surface assets');
  assert.equal(requests.filter((r) => r.method !== 'GET' || r.url.includes('/api/') || !r.url.startsWith(origin)).length, 0, 'Unexpected API/data/external request');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('PASS links, shared workspace reflow, contextual entry, brand assets, reload isolation, no storage/API/external requests or browser errors.');
} finally {
  socket?.close();
  if (!browserError && browser.exitCode === null) {
    const stopped = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill(); await stopped;
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
