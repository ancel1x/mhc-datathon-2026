// Headless Chrome screenshot via the DevTools protocol (no dependencies; Node 22+).
// Usage: node scripts/screenshot.mjs <url> <out.png> [waitMs=15000] [width=1600] [height=1000]
// Set CHROME=<path to chrome.exe> if Chrome is not in the default location.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, waitMs = '15000', width = '1600', height = '1000'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/screenshot.mjs <url> <out.png> [waitMs] [width] [height]');
  process.exit(1);
}
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'shot-profile-'));
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, '--hide-scrollbars',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return; } catch { /* not yet */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

try {
  await ready();
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      console.log(`[console.${m.params.type}]`, m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    } else if (m.method === 'Runtime.exceptionThrown') {
      console.log('[exception]', (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? '').slice(0, 400));
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(Number(waitMs));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`saved ${out}`);
  ws.close();
} finally {
  proc.kill();
}
