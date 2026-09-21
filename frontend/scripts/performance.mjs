// Repeatable browser smoke/performance check against a production preview. Node 22+, Chrome.
// Usage: node scripts/performance.mjs [url] [report.json]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base = 'http://127.0.0.1:4173', output] = process.argv.slice(2);
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
    for (let i = 0; i < 150; i += 1) { if (await evaluate(expression)) return; await sleep(200); }
    throw new Error(`Timed out: ${expression}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__perf = { commits: 0, flowRects: 0, flowFrames: 0 };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, inject: () => 1, onCommitFiberRoot: () => window.__perf.commits++, onCommitFiberUnmount() {} };
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
  await waitFor("document.querySelector('.maplibregl-canvas') && document.querySelectorAll('.glyph').length > 0");
  await sleep(4000);
  const startup = await evaluate(`({
    requests: performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin).map(r => ({ path: new URL(r.name).pathname, bytes: r.decodedBodySize })),
    mapReadyMs: performance.getEntriesByType('resource').filter(r => r.name.includes('/data/')).reduce((max, r) => Math.max(max, r.responseEnd), 0)
  })`);
  const idle = await sample();
  const hover = await sample(async () => {
    // Hover an actual map feature repeatedly, then sweep across the map.
    for (let i = 0; i < 80; i += 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 460 + i * 8, y: 380 + Math.sin(i / 8) * 110 });
      await sleep(20);
    }
  });
  await evaluate("[...document.querySelectorAll('[role=switch]')].find(e => e.textContent.includes('Traffic flow')).click()");
  await sleep(1800);
  const flowOff = await sample();
  await evaluate("document.querySelector('.glyph').click()");
  await waitFor("document.querySelector('[aria-label=\"Feature detail\"]') && document.querySelector('.recharts-surface')");
  const detail = await evaluate("({ charts: document.querySelectorAll('.recharts-surface').length, text: document.querySelector('[aria-label=\"Feature detail\"]').textContent.slice(0, 140) })");
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  const report = { startup, idle, hover, flowOff, detail, errors };
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  ws?.close();
  proc.kill();
}
