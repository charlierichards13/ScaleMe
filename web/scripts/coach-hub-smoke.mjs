/** Local production Chromium regression. No AWS. Run after npm run build + npm start. */
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
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await command('Runtime.enable'); await command('Network.enable'); await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const dir = new URL('../../docs/screenshots/coach-hub/', import.meta.url);
  await mkdir(dir, { recursive: true });
  const navigate = async path => {
    await command('Page.navigate', {url: origin+path});
    await wait(`document.readyState === 'complete' && document.querySelector('main')`);
    await evaluate('document.fonts.ready');
  };
  for (const width of [320,390,768,1440]) {
    await command('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:width<768});
    await navigate('/coach');
    await wait(`document.querySelector('#coach-title')`);
    assert.equal(await evaluate(`document.querySelectorAll('main').length`),1);
    assert.equal(await evaluate(`document.querySelectorAll('textarea, input, [role=log]').length`),0);
    assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`),'Horizontal overflow');
    await wait(`Array.from(document.images).filter(i=>i.getBoundingClientRect().width>0).every(i=>i.complete && i.naturalWidth>0)`);
    assert.ok(await evaluate(`document.body.textContent.includes('Off by default') && document.body.textContent.includes('Upload unavailable')`));
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.equal(await evaluate(`document.activeElement.textContent`),'Skip to Career Coach');
    assert.ok(await evaluate(`document.activeElement.getBoundingClientRect().top >= 0`));
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert.equal(await evaluate(`document.activeElement.id`),'coach-main');
    await evaluate('document.activeElement.blur(); scrollTo(0,0)');
    const metrics=await command('Page.getLayoutMetrics');
    const capture=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.cssContentSize.height,scale:1}});
    await writeFile(new URL(`after-${width}.png`,dir),Buffer.from(capture.data,'base64'));
    assert.equal(await evaluate('localStorage.length + sessionStorage.length'),0);
  }
  const destinations=[['/fit-insights','Fit Evidence Explorer'],['/interview/contextual','context-resume'],['/interview','scripted'],['/impact-lab','Resume Impact Lab'],['/resume-lab','Resume Lab']];
  for(const [path,marker] of destinations){
    await navigate('/coach');
    assert.ok(await evaluate(`(() => {const a=document.querySelector('main a[href="${path}"]'); if(!a)return false; a.click(); return true;})()`));
    await wait(`location.pathname === '${path}' && document.body.textContent.includes('${marker === 'context-resume' ? 'Contextual' : marker}')`);
    assert.equal((await fetch(origin+path)).status,200);
  }
  await navigate('/dashboard');
  await wait(`document.querySelector('a[href="/coach"]')`);
  await evaluate(`document.querySelector('a[href="/coach"]').click()`);
  await wait(`document.querySelector('#coach-title')`);
  await evaluate(`document.querySelector('.coach-header nav a').click()`);
  await wait(`location.pathname === '/dashboard' && document.querySelector('h1')`);
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/coach');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  assert.deepEqual(errors,[]);
  assert.equal(requests.filter(r=>new URL(r.url).pathname.startsWith('/api/')).length,0);
  assert.equal(requests.filter(r=>r.method!=='GET').length,0);
  assert.equal(requests.filter(r=>!r.url.startsWith(origin) && !r.url.startsWith('data:')).length,0);
  assert.equal(await evaluate('document.cookie'), '');
  console.log('PASS: coach 320/390/768/1440, branding, focus/skip, all five real destinations, dashboard roundtrip, no composer/API/storage/external requests, reduced motion.');
} finally {
  socket?.close();
  if (!browserError && browser.exitCode === null) {
    const stopped = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill(); await stopped;
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
