/** Production loopback only. Run with both live switches FALSE. All successes are intercepted, never AWS. */
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
  const dir=new URL('../../docs/screenshots/private-coach/',import.meta.url);
  await mkdir(dir,{recursive:true});
  const navigate=async path=>{
    await command('Page.navigate',{url:origin+path});
    await wait(`document.readyState==='complete' && document.querySelector('#coach-message') && Object.keys(document.querySelector('button')).some(k=>k.startsWith('__reactProps$'))`);
    await evaluate('document.fonts.ready');
  };
  const click=async text=>{
    assert.ok(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.click();return true;})()`),`Missing/disabled button: ${text}`);
  };
  const type=async(selector,text)=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await command('Input.insertText',{text});};
  const capture=async name=>{
    await evaluate('scrollTo(0,0)');
    const m=await command('Page.getLayoutMetrics');
    const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:await evaluate('innerWidth'),height:m.cssContentSize.height,scale:1}});
    await writeFile(new URL(name+'.png',dir),Buffer.from(shot.data,'base64'));
  };
  const code='fictional_browser_preview_code_1234567890';
  for(const width of [320,390,768,1440]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
    await navigate('/coach/conversation');
    assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));
    assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`),true);
    assert.equal(await evaluate(`document.querySelector('[role=log]').querySelectorAll('article').length`),0);
    assert.equal(requests.filter(r=>new URL(r.url).pathname==='/api/coach/message').length,0);
    await capture(`empty-${width}`);
  }
  await type('#coach-code',code);await type('#coach-message','I built a fictional library booking tool. How can I explain my contribution?');
  assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`),true,'Consent required');
  await evaluate(`document.querySelector('#coach-consent').click()`);
  await click('Send to private coach');
  await wait(`document.querySelector('[role=alert]')?.textContent.includes('503')`);
  assert.ok(await evaluate(`document.querySelector('.conversation-state').textContent.includes('Unavailable')`));
  assert.equal(await evaluate(`document.querySelectorAll('.conversation-turn').length`),0);
  assert.ok(await evaluate(`document.querySelector('#coach-message').value.includes('fictional library')`));
  await capture('unavailable-1440');
  await click('Clear session & access code');
  await wait(`document.activeElement.id==='coach-code'`);
  assert.equal(await evaluate(`document.querySelector('#coach-code').value`),'');

  const paused=[];const bodies=[];
  const original=socket.onmessage;
  socket.onmessage=event=>{
    original(event);
    const m=JSON.parse(event.data);
    if(m.method==='Fetch.requestPaused'){paused.push(m.params);bodies.push(JSON.parse(m.params.request.postData));}
  };
  await command('Fetch.enable',{patterns:[{urlPattern:'*/api/coach/message',requestStage:'Request'}]});
  const take=async()=>{
    const end=Date.now()+10000;
    while(!paused.length && Date.now()<end)await new Promise(r=>setTimeout(r,30));
    assert.ok(paused.length,'Expected explicit request');return paused.shift();
  };
  const respond=async(request,status=200,mode='live',content='MOCKED TRANSPORT — fictional browser test only. What did you personally build, and what did you test?')=>{
    const response=status===200?{message:{role:'assistant',content},advisory:'unverified'}:{error:{code:'AI_UNAVAILABLE',message:'safe test failure',retryable:true}};
    await command('Fetch.fulfillRequest',{requestId:request.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'X-ScaleMe-Mode',value:mode},{name:'Retry-After',value:'1'}],body:Buffer.from(JSON.stringify(response)).toString('base64')});
  };
  await type('#coach-code',code);await type('#coach-resume','Fictional library project: built a booking tool.');await type('#coach-job','Fictional role: test web applications.');await type('#coach-message','I owned the booking form.');
  await evaluate(`document.querySelector('#coach-consent').click()`);
  await click('Send to private coach');let request=await take();
  assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`),true);
  await evaluate(`document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  assert.equal(paused.length,0,'Duplicate request blocked');
  assert.ok(!request.request.url.includes(code));assert.equal(request.request.headers.Authorization,`Bearer ${code}`);
  assert.equal(bodies.at(-1).messages.length,1);assert.equal(bodies.at(-1).consent,true);assert.equal(bodies.at(-1).context.resume,'Fictional library project: built a booking tool.');
  await respond(request);await wait(`document.querySelectorAll('.conversation-turn').length===2`);
  assert.ok(await evaluate(`document.querySelector('.conversation-state').textContent.includes('server-authorized')`));
  assert.equal(await evaluate(`document.querySelector('#coach-resume').disabled`),true);
  for(const width of [320,390,768,1440]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await capture(`mocked-conversation-${width}`);
  }
  await type('#coach-message','I tested invalid bookings and keyboard navigation.');await click('Send to private coach');request=await take();
  assert.equal(bodies.at(-1).messages.length,3);await respond(request,429);
  await wait(`document.querySelector('[role=alert]')?.textContent.includes('429')`);
  assert.equal(await evaluate(`document.querySelectorAll('.conversation-turn').length`),2);
  await wait(`!document.querySelector('button[type=submit]').disabled`);await click('Retry message');request=await take();
  assert.equal(bodies.at(-1).messages.length,3,'Retry did not duplicate user turn');
  await respond(request,200,'demo');await wait(`document.querySelector('[role=alert]')?.textContent.includes('502')`);
  assert.equal(await evaluate(`document.querySelectorAll('.conversation-turn').length`),2,'Wrong mode not added');
  await click('Retry message');request=await take();await click('Cancel request');
  await respond(request,200,'live','MOCKED LATE RESPONSE must not appear').catch(()=>{});
  await wait(`!document.querySelector('button[type=submit]').disabled`);
  assert.ok(await evaluate(`!document.querySelector('[role=log]').textContent.includes('LATE RESPONSE')`));
  await click('Send to private coach');request=await take();await click('Clear session & access code');
  await respond(request,200,'live','MOCKED RESET RESPONSE must not appear').catch(()=>{});
  await wait(`document.querySelector('#coach-code').value===''`);
  assert.equal(await evaluate(`document.querySelectorAll('.conversation-turn').length`),0);
  assert.equal(await evaluate(`document.querySelector('#coach-resume').value`),'');assert.equal(await evaluate(`document.querySelector('#coach-consent').checked`),false);
  // Reset/reload/navigation session isolation, including back navigation.
  await type('#coach-code',code);await type('#coach-message','A fresh fictional project.');await evaluate(`document.querySelector('#coach-consent').click()`);
  await click('Send to private coach');request=await take();await respond(request);await wait(`document.querySelectorAll('.conversation-turn').length===2`);
  assert.equal(bodies.at(-1).messages.length,1);assert.deepEqual(bodies.at(-1).context,{});
  await evaluate(`document.querySelector('.coach-header nav a').click()`);await wait(`location.pathname==='/dashboard'`);
  await evaluate('history.back()');await wait(`location.pathname==='/coach/conversation' && document.querySelector('#coach-code')`);
  assert.equal(await evaluate(`document.querySelector('#coach-code').value`),'');assert.equal(await evaluate(`document.querySelectorAll('.conversation-turn').length`),0);
  await command('Page.reload');await wait(`document.querySelector('#coach-message')`);assert.equal(await evaluate(`document.querySelector('#coach-message').value`),'');
  // Distinct rejection classes, network failure, escaped content and the hard six-send bound.
  await type('#coach-code',code);await type('#coach-message','Fresh fictional preparation question.');await evaluate(`document.querySelector('#coach-consent').click()`);
  for(const status of [401,403,503]){
    await click('Send to private coach');request=await take();await respond(request,status);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('${status}')`);
    assert.ok(await evaluate(`!document.querySelector('.conversation-state').textContent.includes('server-authorized')`));
    // Editing retains the failed draft and creates a new explicit request.
    await type('#coach-message',' ');
  }
  await click('Send to private coach');request=await take();await command('Fetch.failRequest',{requestId:request.requestId,errorReason:'Failed'});
  await wait(`document.querySelector('[role=alert]')?.textContent.includes('Could not reach')`);
  await click('Retry message');request=await take();await respond(request,200,'live','MOCKED TRANSPORT: <img src=x onerror="window.__coachInjected=true"> What did you test?');
  await wait(`document.querySelectorAll('.conversation-turn').length===2`);
  assert.equal(await evaluate(`document.querySelector('[role=log] img')`),null);
  assert.equal(await evaluate(`window.__coachInjected===undefined`),true);
  assert.ok(await evaluate(`document.querySelector('[role=log]').textContent.includes('<img')`));
  for(let turn=2;turn<=6;turn++){
    await type('#coach-message',`Fictional follow-up ${turn}.`);await click('Send to private coach');request=await take();
    assert.equal(bodies.at(-1).messages.length,turn*2-1);await respond(request);
    await wait(`document.querySelectorAll('.conversation-turn').length===${turn*2}`);
  }
  assert.equal(await evaluate(`document.querySelector('#coach-message')`),null);
  assert.ok(await evaluate(`document.body.textContent.includes('Session limit reached')`));
  await click('Clear session & access code');
  await wait(`document.querySelector('#coach-code').value==='' && document.activeElement.id==='coach-code' && document.querySelector('#coach-message')`);
  await type('#coach-code',code);await type('#coach-message','Fictional pending exit request.');await evaluate(`document.querySelector('#coach-consent').click()`);
  await click('Send to private coach');request=await take();
  await evaluate(`document.querySelector('.coach-header nav a').click()`);await wait(`location.pathname==='/dashboard'`);
  await respond(request,200,'live','MOCKED EXIT RESPONSE must not return').catch(()=>{});
  await evaluate('history.back()');await wait(`location.pathname==='/coach/conversation' && document.querySelector('#coach-code')`);
  assert.equal(await evaluate(`document.querySelector('#coach-code').value`),'');assert.equal(await evaluate(`document.querySelectorAll('.conversation-turn').length`),0);
  await command('Fetch.disable');
  assert.deepEqual(errors,[]);assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);assert.equal(await evaluate('document.cookie'),'');
  assert.equal(requests.filter(r=>!r.url.startsWith(origin)&&!r.url.startsWith('data:')).length,0);
  console.log('PASS: 320/390/768/1440; real disabled 503; consent, mocked live request/history, 401/403/503/network errors, escaped markup, six-send bound, no duplicates, 429/manual retry, wrong-mode, cancel/reset late responses, context/code isolation after reset/exit/back/reload, no storage/cookies/external calls. Mocked quality only.');
} finally {
  socket?.close();
  if (!browserError && browser.exitCode === null) {
    const stopped = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill(); await stopped;
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
