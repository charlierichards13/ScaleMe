/** Production UI smoke test using Chromium's CDP and Node 22 built-ins only.
 * Run a production server first; then node scripts/evidence-ledger-smoke.mjs.
 * Optional: SCALEME_SMOKE_URL, CHROMIUM_PATH, SCALEME_SCREENSHOT_DIR.
 * Only fictional inputs. No cloud/model calls or additional dependencies. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  const click = async (name) => {
    const found = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(name)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
    assert.ok(found, `Missing/disabled button: ${name}`);
  };
  const type = async (selector, value) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await command('Input.insertText', { text: value });
  };
  await command('Runtime.enable'); await command('Network.enable'); await command('Page.enable');
  await command('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const profiles = [
    { resume: 'Built web applications for a campus library booking desk.', requirements: 'Build web applications\nTest web applications\nAutomate reports', answer: 'I tested web applications with invalid bookings and mobile navigation before rollout.' },
    { resume: 'Designed prototypes for a fictional museum ticket kiosk.', requirements: 'Design prototypes\nTest prototypes\nAutomate reports', answer: 'I tested prototypes with museum volunteers using printed tickets and checkout tasks.' },
    { resume: 'Managed inventory for a fictional community pantry delivery team.', requirements: 'Manage inventory\nValidate inventory\nAutomate reports', answer: 'I validated inventory against delivery records by checking missing items and duplicate entries.' },
  ];
  let active;
  const apiBodies = [];
  const interceptErrors = [];
  const originalMessage = socket.onmessage;
  socket.onmessage = async event => {
    originalMessage(event);
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    try {
      const { requestId, request } = message.params;
      const path = new URL(request.url).pathname;
      const body = request.postData ? JSON.parse(request.postData) : null;
      let response;
      if (path === '/api/practice/access') response = { available: true };
      else if (path === '/api/fit/analyze') {
        assert.equal(body.resume.text, active.resume);
        response = { analysis: { summary: 'MOCKED BEDROCK: fictional browser test.',
          assessments: body.job.requirements.map((r, i) => ({ requirementId: r.id, status: i ? 'not_evidenced' : 'supported', explanation: 'Mocked analysis.', evidence: i ? [] : [{ source: 'resume', quote: active.resume }] })), strengths: [], clarificationQuestions: [], growthSuggestions: [], disclaimer: 'MOCKED; not a live model result.' } };
      } else {
        assert.equal(body.resume.text, active.resume);
        assert.deepEqual(body.job.requirements.map(r => r.id), ['req-1', 'req-2', 'req-3']);
        const answers = body.history.filter(t => t.role === 'candidate');
        response = { turn: { coachMessage: answers.length ? `You said: ${answers.at(-1).content} What can you clarify about this experience?` : 'What did you personally do for this requirement?', focus: 'contribution', canFinish: false, targetRequirementId: 'req-2' } };
      }
      apiBodies.push({ path, body });
      await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'X-ScaleMe-Mode', value: 'live' }], body: Buffer.from(JSON.stringify(response)).toString('base64') });
    } catch (error) { interceptErrors.push(error.message); }
  };
  await command('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  for (const [index, candidate] of profiles.entries()) {
    active = candidate;
    await command('Emulation.setDeviceMetricsOverride', { width: index === 1 ? 390 : 1280, height: 900, deviceScaleFactor: 1, mobile: index === 1 });
    await command('Page.navigate', { url: `${origin}/interview/contextual` });
    await wait(`document.querySelector('#context-resume') && Object.keys(document.querySelector('button')).some(k => k.startsWith('__reactProps$'))`);
    await type('input[type=password]', 'fictional_browser_code_only_1234567890');
    await click('Check private access');
    await wait(`!document.querySelector('input[type=password]')`);
    await type('#context-resume', active.resume);
    await type('input[placeholder="e.g. Software engineering intern"]', 'Fictional test role');
    await type('textarea[placeholder="Paste the job description…"]', active.requirements);
    await type('#context-requirements', active.requirements);
    await evaluate(`document.querySelector('input[type=checkbox]').click()`);
    await click('Analyze requirements with live AI');
    await wait(`document.body.textContent.includes('Start contextual interview')`);
    await click('Start contextual interview');
    await wait(`document.querySelector('#interview-answer')`);
    await type('#interview-answer', 'I helped and it went well.');
    await click('Send answer & get AI follow-up');
    await wait(`document.querySelector('#interview-answer') && document.querySelector('[role=log]').textContent.includes('You said: I helped')`);
    await type('#interview-answer', active.answer);
    await click('Send answer & get AI follow-up');
    await wait(`document.querySelector('[role=log]').textContent.includes('You said: ' + ${JSON.stringify(active.answer)})`);
    await click('End early & review evidence');
    await wait(`document.body.textContent.includes('Connect your answers to your experience')`);
    // No association is preselected. Unlinked answers cannot change coverage.
    assert.equal(await evaluate(`document.querySelector('select').value`), '');
    await click('Build evidence impact report');
    await wait(`document.querySelector('[data-testid=coverage]')?.textContent.includes('1 of 3 → 1 of 3')`);
    await click('Review answer associations');
    await wait(`document.querySelector('select')`);
    await evaluate(`document.querySelectorAll('article select').forEach((s, i) => { if (i % 2 === 0) { s.value = s.options[1].value; s.dispatchEvent(new Event('change', {bubbles:true})); } })`);
    await click('Build evidence impact report');
    await wait(`document.querySelector('[data-testid=coverage]')?.textContent.includes('1 of 3 → 2 of 3')`);
    assert.ok(await evaluate(`document.body.textContent.includes('interview-answer-3') && document.body.textContent.includes(${JSON.stringify(active.answer)})`));
    assert.equal(await evaluate(`document.querySelector('button[disabled]')?.textContent.trim()`), 'Copy suggestion');
    await evaluate(`document.querySelectorAll('input[type=checkbox]').forEach(e => e.click())`);
    await click('Copy suggestion');
    await wait(`document.querySelector('[role=status]').textContent === 'Candidate-confirmed wording copied.'`);
    assert.equal(await evaluate('navigator.clipboard.readText()'), active.resume + ' ' + active.answer);
    assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Overflow');
    await click('Review answer associations');
    await click('Build evidence impact report');
    await wait(`document.querySelector('[data-testid=coverage]')`);
    assert.equal(await evaluate(`document.querySelector('button[disabled]')?.textContent.trim()`), 'Copy suggestion', 'Rebuild resets confirmations');
    assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
    await command('Page.reload');
    await wait(`document.querySelector('#context-resume')?.value === ''`);
    assert.equal(await evaluate(`document.querySelector('[data-testid=coverage]')`), null);
  }
  assert.deepEqual(interceptErrors, []);
  assert.deepEqual(errors, []);
  assert.equal(apiBodies.filter(r => r.path === '/api/interview/next').length, 9);
  assert.equal(requests.filter(r => !r.url.startsWith(origin) && !r.url.startsWith('data:')).length, 0);
  console.log('PASS: three fictional profiles, mocked AI transport, contextual answers, explicit experience associations, unlinked/vague no gain, 1/3 → 2/3, exact source IDs/quotes, confirmation/copy, review reset, mobile, reload isolation, no storage/external requests.');
} finally {
  socket?.close();
  if (!browserError && browser.exitCode === null) {
    const stopped = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill(); await stopped;
  }
  await rm(profile, { recursive: true, force: true });
}
