/**
 * 离线可用性验证：注册 Service Worker → 断网 → 重新加载 → 检查页面还能不能跑。
 * 用法：node tools/offline-test.mjs（需要 8123 端口的静态服务）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9335;
const BASE = 'http://127.0.0.1:8123/';
const PROFILE = path.resolve('.chrome-profile-offline');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 20000);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
}

async function startChrome() {
  await fs.rm(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu', 'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      if (res.ok) return { chrome, page: (await res.json()).webSocketDebuggerUrl };
    } catch (e) { /* retry */ }
    await sleep(250);
  }
  throw new Error('chrome not ready');
}

async function main() {
  const { chrome, page } = await startChrome();
  const cdp = new Cdp(page);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  try {
    await cdp.send('Page.navigate', { url: BASE });
    await sleep(2500);

    const swState = await cdp.evaluate(`navigator.serviceWorker.ready
      .then((r) => r.active ? r.active.state : 'none')
      .catch((e) => 'error: ' + e.message)`);
    const controlled = await cdp.evaluate('!!navigator.serviceWorker.controller');

    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1
    });
    await cdp.send('Page.reload', { ignoreCache: false });
    await sleep(2000);

    const offlineTitle = await cdp.evaluate('document.title');
    const offlineButtons = await cdp.evaluate('document.querySelectorAll(".home-actions .btn").length');
    const offlineCss = await cdp.evaluate('getComputedStyle(document.body).fontFamily.length > 0');
    const offlineJs = await cdp.evaluate('typeof window.LB === "object" && !!window.LB.Player');

    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await fs.mkdir(path.resolve('docs/raw'), { recursive: true });
    await fs.writeFile(path.resolve('docs/raw/offline.png'), Buffer.from(data, 'base64'));

    const result = { swState, controlled, offlineTitle, offlineButtons, offlineCss, offlineJs };
    result.ok = swState === 'activated' && offlineButtons === 2 && offlineCss && offlineJs;
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error('FAILED', e); process.exitCode = 1; });
