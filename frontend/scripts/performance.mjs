// Repeatable browser smoke/performance check against a production preview. Node 22+, Chrome.
// Usage: node scripts/performance.mjs [url] [report.json]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const verify = process.argv.includes('--verify');
const [base = 'http://127.0.0.1:4173', output] = process.argv.slice(2).filter((arg) => arg !== '--verify');
const port = 9800 + Math.floor(Math.random() * 500);
const proc = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, '--window-size=1440,1000',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'crz-perf-'))}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let pages;
  for (let i = 0; i < 100; i += 1) {
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); }
  }
  assert.ok(pages, 'Chrome started');
  ws = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  };
  const send = async (method, params = {}) => {
    const message = await new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    if (message.error) throw new Error(JSON.stringify(message.error));
    return message.result;
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 150; i += 1) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(200); }
    throw new Error(`Timed out: ${expression}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__perf = { commits: 0, flowRects: 0, flowFrames: 0 };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, inject: () => 1, onCommitFiberRoot: (_, root) => { window.__root = root; window.__perf.commits++; }, onCommitFiberUnmount() {} };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.matches('.flow-canvas canvas')) window.__perf.flowRects++;
      return rect.call(this);
    };
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.matches('.flow-canvas canvas')) window.__perf.flowFrames++;
      return clear.apply(this, args);
    };
  ` });
  const metrics = async () => {
    const { metrics } = await send('Performance.getMetrics');
    return Object.fromEntries(metrics.filter(({ name }) => ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].includes(name)).map(({ name, value }) => [name, value]));
  };
  const sample = async (act = () => sleep(3000)) => {
    await evaluate('Object.keys(window.__perf).forEach(k => window.__perf[k] = 0)');
    const before = await metrics();
    await act();
    const after = await metrics();
    return { ...await evaluate('window.__perf'), ...Object.fromEntries(Object.keys(before).map((key) => [key + 'Ms', Math.round((after[key] - before[key]) * 1000)])) };
  };
  await send('Page.navigate', { url: `${base}/?chapter=explore&theme=dark` });
  await waitFor("document.querySelector('.maplibregl-canvas') && document.querySelector('.yearstamp')");
  await sleep(7000);
  const startup = await evaluate(`({
    requests: performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin).map(r => ({ path: new URL(r.name).pathname, bytes: r.decodedBodySize })),
    dataReadyMs: performance.getEntriesByType('resource').filter(r => /\\/(data|api)\\//.test(new URL(r.name).pathname)).reduce((max, r) => Math.max(max, r.responseEnd), 0)
  })`);
  await evaluate("{ const flow = [...document.querySelectorAll('[role=switch]')].find(e => e.textContent.includes('Traffic flow')); if (flow.getAttribute('aria-checked') !== 'true') flow.click(); }");
  await sleep(2000);
  const idle = await sample();
  const hover = await sample(async () => {
    // Hover an actual map feature repeatedly, then sweep across the map.
    for (let i = 0; i < 80; i += 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 460 + i * 8, y: 380 + Math.sin(i / 8) * 110 });
      await sleep(20);
    }
  });
  await evaluate("{ const flow = [...document.querySelectorAll('[role=switch]')].find(e => e.textContent.includes('Traffic flow')); if (flow.getAttribute('aria-checked') === 'true') flow.click(); }");
  await sleep(1800);
  const flowOff = await sample();
  // Two notches: the explore camera sits at ~10.3 and the clock glyphs switch on at zoom 11.
  for (let i = 0; i < 2; i += 1) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 820, y: 450, deltaX: 0, deltaY: -600 });
    await sleep(400);
  }
  await waitFor("document.querySelector('.glyph')");
  await sleep(1000);
  await evaluate("document.querySelector('.glyph').click()");
  await waitFor("document.querySelector('[aria-label=\"Feature detail\"]') && document.querySelector('.recharts-surface')");
  const detail = await evaluate("({ charts: document.querySelectorAll('.recharts-surface').length, text: document.querySelector('[aria-label=\"Feature detail\"]').textContent.slice(0, 140) })");
  const checks = [];
  if (verify) {
    assert.equal(idle.flowRects, 0, 'Stationary traffic reuses cached layout');
    assert.ok(idle.flowFrames > 0, 'Traffic still animates');
    assert.equal(flowOff.flowFrames, 0, 'Disabled traffic stops drawing');
    assert.ok(!startup.requests.some((r) => /\/assets\/(charts|DetailPanel)-/.test(r.path)), 'Charts load on demand');
    assert.ok(!startup.requests.some((r) => r.path.startsWith('/api/')), 'Standalone startup avoids the optional API');
    checks.push('performance budgets', 'zoom glyphs', 'feature detail and lazy charts');

    // Obtain the existing map through React's test-only DevTools hook; no app debug globals needed.
    assert.ok(await evaluate(`(() => {
      const stack = [window.__root.current];
      while (stack.length) {
        const f = stack.pop();
        if (f.ref?.current?.getMap) { window.__map = f.ref.current.getMap(); return true; }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
      return false;
    })()`), 'Map is mounted');
    const click = async (selector) => {
      assert.ok(await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`), `Control exists: ${selector}`);
    };
    const toggleFlow = async (on) => evaluate(`(() => { const el = [...document.querySelectorAll('[role=switch]')].find(e => e.textContent.includes('Traffic flow')); if (el.getAttribute('aria-checked') !== '${on}') el.click(); })()`);
    await click('[aria-label="Close detail"]');
    await click('[aria-label="Switch to light theme"]');
    await waitFor("document.documentElement.dataset.theme === 'light'");
    await click('[aria-label="Switch to dark theme"]');
    await click('[aria-label="Collapse controls"]');
    await waitFor("document.querySelector('.side[data-collapsed=true]')");
    await click('.side-btn');
    checks.push('themes and panel collapse');

    for (let i = 0; i < 3; i += 1) {
      await evaluate(`document.querySelectorAll('[aria-label="Year shown"] button')[${i}].click()`);
      assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Year shown"] button')[${i}].getAttribute('aria-pressed')`), 'true');
    }
    await evaluate(`document.querySelectorAll('[aria-label="Year shown"] button')[1].click()`);
    const layerLabels = await evaluate("[...document.querySelectorAll('.rows .row:not(.row--sub) .row__label')].map(el => el.textContent)");
    for (const label of layerLabels) {
      const expression = `[...document.querySelectorAll('[role=switch]')].find(el => el.querySelector('.row__label')?.textContent === ${JSON.stringify(label)})`;
      const was = await evaluate(`${expression}.getAttribute('aria-checked')`);
      await evaluate(`${expression}.click()`);
      assert.notEqual(await evaluate(`${expression}.getAttribute('aria-checked')`), was);
      await evaluate(`${expression}.click()`);
    }
    await click('.disclosure--adv summary');
    await evaluate(`document.querySelectorAll('[aria-label="Color by"] button')[1].click()`);
    assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Color by"] button')[1].getAttribute('aria-pressed')`), 'true');
    await evaluate(`document.querySelectorAll('[aria-label="Color by"] button')[0].click()`);
    await evaluate("document.querySelector('#hour-slider').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    assert.equal(await evaluate("document.querySelector('#hour-slider').value"), '23');
    assert.equal(await evaluate("document.querySelector('.hour .chip').getAttribute('aria-pressed')"), 'false');
    await click('.hour .chip');
    await click('.disclosure--adv summary');
    checks.push('all years, layer switches, metrics and hour slider');

    await evaluate(`(async () => {
      const data = await (await fetch('/data/bt_facilities.geojson')).json();
      const feature = data.features[0];
      window.__map.jumpTo({ center: feature.geometry.coordinates, zoom: 10.7 });
      window.__hoverPoint = window.__map.project(feature.geometry.coordinates);
    })()`);
    await sleep(1000);
    const point = await evaluate('window.__hoverPoint');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await waitFor("document.querySelector('.map-tip')");
    const tipTitle = await evaluate("document.querySelector('.map-tip b').textContent");
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 1, y: point.y + 1 });
    assert.equal(await evaluate("document.querySelector('.map-tip b').textContent"), tipTitle);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await waitFor("document.querySelector('[aria-label=\"Feature detail\"]') && document.querySelector('.recharts-surface')");
    await click('[aria-label="Close detail"]');
    checks.push('point tooltips and selection');

    // The map must resume after toggling flow and remain aligned as the viewport and panels change.
    await toggleFlow(true);
    await sleep(1500);
    const resumed = await sample(() => sleep(700));
    assert.ok(resumed.flowFrames > 0);
    await click('[aria-label="Collapse controls"]');
    await sleep(600);
    assert.ok(await evaluate("document.querySelector('.flow-canvas canvas').width > 0"));
    await click('.side-btn');
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await sleep(1500);
    const reduced = await sample(() => sleep(700));
    assert.equal(reduced.flowFrames, 0, 'Reduced-motion traffic rests after its transition');
    await evaluate("void window.__map.panBy([35, 0], { duration: 0 })");
    await sleep(300);
    assert.ok(await evaluate('window.__perf.flowFrames > 0'), 'Reduced-motion canvas follows map movement');
    checks.push('traffic resume, resize and reduced motion');

    const count = await evaluate("document.querySelectorAll('.tl__stop').length");
    for (let i = 0; i < count; i += 1) {
      await evaluate(`document.querySelectorAll('.tl__stop')[${i}].click()`);
      await sleep(120);
      assert.equal(await evaluate(`document.querySelectorAll('.tl__stop')[${i}].getAttribute('aria-current')`), 'step');
    }
    checks.push(`${count} story/explore steps`);
    await click('[aria-label="Play the story as a guided tour"]');
    await waitFor("document.querySelector('.callout')");
    await click('[aria-label="Pause the tour"]');
    await click('[aria-label="Resume the tour"]');
    await click('[aria-label="Next callout"]');
    await click('.tl__exit');
    await waitFor("document.querySelector('.app[data-autoplay=false]')");
    checks.push('guided tour play, pause, skip and exit');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await waitFor("document.querySelector('.side-btn')");
    await click('.side-btn');
    await waitFor("document.querySelector('.side--sheet')");
    await click('[aria-label="Close controls"]');
    await waitFor("!document.querySelector('.side--sheet')");
    checks.push('mobile controls');
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  const report = { startup, idle, hover, flowOff, detail, checks, errors };
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  ws?.close();
  proc.kill();
}
