/**
 * 录制 README 顶部的演示 GIF 帧序列。
 * 真实手指拖动刮开两格 → 键盘补完一条线 → BINGO 弹窗。
 * 用法：node tools/demo-gif.mjs（需要 8123 端口的静态服务）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9336;
const BASE = 'http://127.0.0.1:8123/';
const OUT = path.resolve('docs/raw/gif');
const PROFILE = path.resolve('.chrome-profile-gif');
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

async function launch() {
  await fs.rm(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--disable-gpu', 'about:blank'
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

function cellRectExpr(pos) {
  return `(() => { const c = document.querySelector('.cell[data-pos="${pos}"] canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;
}

function buildPath(rect, rows = 6) {
  const pts = [];
  for (let i = 0; i < rows; i++) {
    const y = rect.y + rect.h * (0.12 + (0.76 * i) / (rows - 1));
    const forward = i % 2 === 0;
    for (let k = 0; k <= 10; k++) {
      const t = forward ? k / 10 : 1 - k / 10;
      pts.push({ x: rect.x + rect.w * (0.08 + 0.84 * t), y });
    }
  }
  return pts;
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const { chrome, page } = await launch();
  const cdp = new Cdp(page);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const frames = [];
  async function snap(x, y, delay) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, 'f' + String(frames.length).padStart(3, '0') + '.png');
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    frames.push({ file: path.basename(file), x: x == null ? null : Math.round(x), y: y == null ? null : Math.round(y), delay: delay || 90 });
    return file;
  }

  try {
    await cdp.send('Page.navigate', { url: BASE });
    await sleep(1400);

    /* 跳过首页，直接进入一张默认卡 */
    await cdp.evaluate('document.querySelector(\'[data-act="start"]\').click()');
    await sleep(700);
    await cdp.evaluate('document.querySelector(\'[data-role="a"]\').click()');
    /* 等提示 Toast 消失，画面才干净 */
    await sleep(5200);

    console.log('idle frame');
    await snap(null, null, 700);

    for (const pos of [0]) {
      console.log('scratch cell', pos);
      const rect = await cdp.evaluate(cellRectExpr(pos));
      const pts = buildPath(rect);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0].x, y: pts[0].y });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0].x, y: pts[0].y, button: 'left', buttons: 1, clickCount: 1 });
      await snap(pts[0].x, pts[0].y, 80);
      let i = 0;
      for (const p of pts.slice(1)) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 });
        i++;
        if (i % 8 === 0) await snap(p.x, p.y, 85);
      }
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, button: 'left', buttons: 0, clickCount: 1 });
      await sleep(360);
      await snap(pts[pts.length - 1].x, pts[pts.length - 1].y, 240);
    }

    /* 剩下三格用键盘补完一条线，展示 BINGO 时刻 */
    console.log('complete the line');
    for (const pos of [1, 2, 3, 4]) {
      await cdp.evaluate(`document.querySelector('.cell[data-pos="${pos}"]').focus()`);
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await sleep(380);
      await snap(null, null, 240);
    }

    console.log('bingo modal + confetti');
    for (let i = 0; i < 6; i++) {
      await sleep(150);
      await snap(null, null, 170);
    }
    await snap(null, null, 1200);

    await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ viewport: { width: 390, height: 844 }, frames }, null, 2));
    console.log('frames:', frames.length);
  } finally {
    chrome.kill();
    await fs.rm(PROFILE, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error('FAILED', e); process.exitCode = 1; });
