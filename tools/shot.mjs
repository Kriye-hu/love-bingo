/**
 * 用 Chrome DevTools Protocol 跑一遍真实交互，产出 README 截图。
 * 不依赖 puppeteer：Node 24 自带 WebSocket + fetch。
 *
 * 用法：node tools/shot.mjs
 * 前置：本地 8123 端口已起静态服务（python -m http.server 8123）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const BASE = 'http://127.0.0.1:8123/';
const OUT = path.resolve('docs/raw');
const PROFILE_DIR = path.resolve('.chrome-profile');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.errors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('ws error'));
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message + ' ' + JSON.stringify(msg.error.data || '')));
          else res(msg.result);
          return;
        }
        if (msg.method) {
          if (msg.method === 'Runtime.exceptionThrown') {
            this.errors.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
          }
          if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
            this.errors.push('CONSOLE: ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
          }
          if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
            this.errors.push('LOG: ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
          }
          const handlers = this.listeners.get(msg.method) || [];
          handlers.forEach((h) => h(msg.params));
        }
      };
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('timeout ' + method));
        }
      }, 25000);
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (res.exceptionDetails) {
      throw new Error('evaluate failed: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
    }
    return res.result.value;
  }

  async screenshot(name, fullPage = true) {
    const params = { format: 'png', captureBeyondViewport: fullPage };
    if (fullPage) {
      const metrics = await this.send('Page.getLayoutMetrics');
      const width = Math.ceil(metrics.cssContentSize.width);
      const height = Math.ceil(metrics.cssContentSize.height);
      params.clip = { x: 0, y: 0, width, height, scale: 1 };
    }
    const { data } = await this.send('Page.captureScreenshot', params);
    const file = path.join(OUT, name + '.png');
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    console.log('  shot', name, '(full=' + fullPage + ')');
    return file;
  }
}

async function getBrowserWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch (e) { /* not ready */ }
    await sleep(250);
  }
  throw new Error('chrome not ready');
}

async function newPageTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      if (res.ok) {
        const json = await res.json();
        if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
      }
    } catch (e) { /* retry */ }
    await sleep(250);
  }
  throw new Error('cannot create page');
}

function cellRectExpr(pos) {
  return `(() => { const c = document.querySelector('.cell[data-pos="${pos}"] canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;
}

async function drag(cdp, rect, rows = 6) {
  const pts = [];
  for (let i = 0; i < rows; i++) {
    const y = rect.y + rect.h * (0.12 + (0.76 * i) / (rows - 1));
    const forward = i % 2 === 0;
    for (let k = 0; k <= 10; k++) {
      const t = forward ? k / 10 : 1 - k / 10;
      pts.push({ x: rect.x + rect.w * (0.08 + 0.84 * t), y });
    }
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0].x, y: pts[0].y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0].x, y: pts[0].y, button: 'left', buttons: 1, clickCount: 1 });
  for (const p of pts.slice(1)) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 });
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, button: 'left', buttons: 0, clickCount: 1 });
}

async function scratch(cdp, pos, wait = 420) {
  const rect = await cdp.evaluate(cellRectExpr(pos));
  if (!rect) return false;
  await drag(cdp, rect);
  await sleep(wait);
  return true;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.rm(PROFILE_DIR, { recursive: true, force: true });

  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=420,900',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  const results = { errors: [], checks: {} };
  let cdp;

  try {
    await getBrowserWs();
    const pageWs = await newPageTarget();
    cdp = new Cdp(pageWs);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*sw.js*'] });

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
      screenWidth: 390, screenHeight: 844
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    console.log('1. 首页');
    await cdp.send('Page.navigate', { url: BASE });
    await sleep(1500);
    await cdp.screenshot('01-home');
    results.checks.title = await cdp.evaluate('document.title');

    console.log('2. 开始默认卡 -> 选择使用者');
    await cdp.evaluate('document.querySelector(\'[data-act="start"]\').click()');
    await sleep(900);
    await cdp.screenshot('02-role');
    results.checks.roleCards = await cdp.evaluate('document.querySelectorAll(".role-card").length');

    console.log('3. 进入游戏');
    await cdp.evaluate('document.querySelector(\'[data-role="a"]\').click()');
    await sleep(1100);
    await cdp.screenshot('03-play');
    results.checks.cells = await cdp.evaluate('document.querySelectorAll(".cell").length');
    results.checks.canvases = await cdp.evaluate('document.querySelectorAll(".scratch-canvas").length');

    console.log('4. 手指刮开两格');
    await scratch(cdp, 0);
    await scratch(cdp, 1);
    await cdp.screenshot('04-scratched', false);
    results.checks.revealed = await cdp.evaluate('document.querySelectorAll(".cell.revealed").length');

    console.log('5. 连成第一行 -> BINGO');
    for (const pos of [2, 3, 4]) await scratch(cdp, pos);
    await sleep(1000);
    await cdp.screenshot('05-bingo', false);
    results.checks.modalTitle = await cdp.evaluate('document.querySelector(".modal-title") ? document.querySelector(".modal-title").textContent : null');
    results.checks.awards = await cdp.evaluate('LB.App.ctx.state.awards.length');

    console.log('6. 关闭弹窗 -> 连线高亮');
    await cdp.evaluate('document.querySelector("[data-close]") ? document.querySelector("[data-close]").click() : null');
    await sleep(800);
    await cdp.screenshot('06-line', false);
    results.checks.inLine = await cdp.evaluate('document.querySelectorAll(".cell.in-line").length');

    console.log('6b. 给格子打卡（选照片 + 写一句）');
    await cdp.evaluate(`document.querySelector('.cell[data-pos="0"]').click()`);
    await sleep(900);
    await cdp.evaluate(`document.querySelector('[data-checkin]').click()`);
    await sleep(500);
    const docRoot = await cdp.send('DOM.getDocument', { depth: 1 });
    const inputNode = await cdp.send('DOM.querySelector', { nodeId: docRoot.root.nodeId, selector: '[data-file]' });
    await cdp.send('DOM.setFileInputFiles', { files: [path.resolve('tools/fixtures/bokeh.jpg')], nodeId: inputNode.nodeId });
    await sleep(1400);
    await cdp.evaluate(`(() => {
      const note = document.querySelector('[data-note]');
      note.value = '第一次一起看日落，风很大，但你在';
      note.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-save]').click();
      return true;
    })()`);
    await sleep(2800);
    await cdp.screenshot('21-memory', false);
    results.checks.memorySaved = await cdp.evaluate('!!document.querySelector(".memory-photo")');

    console.log('6c. 回忆册页面');
    results.checks.seed = await cdp.evaluate(`(async () => {
      const files = ['/tools/fixtures/mem1.jpg', '/tools/fixtures/mem2.jpg', '/tools/fixtures/mem3.jpg', '/tools/fixtures/mem4.jpg'];
      const notes = ['第一次一起看日落，风很大，但你在', '你笑起来比晚霞好看', '说好了下次还要来', '今天的天空分你一半'];
      for (let i = 0; i < files.length; i++) {
        const blob = await (await fetch(files[i])).blob();
        const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
        await LB.Album.put(LB.App.ctx.profile.uid, i + 1, { photo: dataUrl, note: notes[i] });
      }
      return true;
    })()`);
    await cdp.evaluate('LB.UI.closeSheet(); location.hash = "#/album"');
    await sleep(1500);
    await cdp.screenshot('22-album', false);
    results.checks.albumItems = await cdp.evaluate('document.querySelectorAll(".album-item").length');
    await cdp.evaluate('location.hash = "#/play"');
    await sleep(900);

    console.log('7. 券包');
    await cdp.evaluate('location.hash = "#/wallet"');
    await sleep(900);
    await cdp.screenshot('07-wallet', false);

    console.log('8. 纪念海报');
    await cdp.evaluate('document.querySelector("[data-poster]").click()');
    await sleep(2400);
    await cdp.screenshot('08-poster', false);
    results.checks.posterWidth = await cdp.evaluate('document.querySelector(".poster-img") ? document.querySelector(".poster-img").naturalWidth : 0');
    await cdp.evaluate('LB.UI.closeModal()');
    await sleep(500);

    console.log('9. 制作者入口（设置口令）');
    await cdp.evaluate('location.hash = "#/studio"');
    await sleep(900);
    await cdp.screenshot('09-studio-gate', false);
    results.checks.gateTitle = await cdp.evaluate('document.querySelector(".entry-title") ? document.querySelector(".entry-title").textContent : null');

    console.log('10. 设置口令 -> 工作台');
    await cdp.evaluate(`(() => {
      document.querySelector('[data-p1]').value = '0520';
      document.querySelector('[data-p2]').value = '0520';
      document.querySelector('[data-act="submit"]').click();
      return true;
    })()`);
    await sleep(1000);
    await cdp.screenshot('10-studio', false);
    results.checks.tasks = await cdp.evaluate('document.querySelectorAll(".task-row").length');

    console.log('11. 改一条任务，检查自动保存');
    await cdp.evaluate(`(() => {
      const input = document.querySelector('[data-field="tasks.0"]');
      input.value = '一起去天台看星星 ✨';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return input.value;
    })()`);
    await sleep(900);
    results.checks.autosaveTask = await cdp.evaluate('JSON.parse(localStorage.getItem("lb.profile.v2")).tasks[0]');

    console.log('11b. 一键套用「异地恋」模板');
    await cdp.evaluate(`document.querySelector('[data-tab="content"]').click()`);
    await sleep(500);
    await cdp.evaluate(`document.querySelector('[data-act="apply-template"][data-id="long-distance"]').click()`);
    await sleep(600);
    await cdp.evaluate(`document.querySelector('.modal-actions [data-ok]').click()`);
    await sleep(1000);
    results.checks.templateTask = await cdp.evaluate('LB.App.ctx.profile.tasks[0]');
    results.checks.templateCoupons = await cdp.evaluate('LB.App.ctx.profile.coupons.length');
    results.checks.templateTheme = await cdp.evaluate('LB.App.ctx.profile.theme.id');

    console.log('12. 外观页');
    await cdp.evaluate('document.querySelector(\'[data-tab="look"]\').click()');
    await sleep(700);
    await cdp.screenshot('11-studio-look', false);

    console.log('13. 上传合照（走真实压缩链路）');
    results.checks.photo = await cdp.evaluate(`(async () => {
      const res = await fetch('/tools/fixtures/bokeh.jpg');
      const blob = await res.blob();
      const file = new File([blob], 'demo-photo.jpg', { type: 'image/jpeg' });
      const dataUrl = await LB.Theme.compressImage(file, { maxSize: 1200 });
      const saved = LB.Store.savePhoto(dataUrl);
      LB.App.ctx.photo = dataUrl;
      LB.App.ctx.profile.theme.usePhoto = true;
      LB.Store.saveProfile(LB.App.ctx.profile);
      LB.Theme.apply(LB.App.ctx.profile, LB.App.ctx.photo);
      return { saved, bytes: dataUrl.length, stored: (LB.Store.loadPhoto() || '').length };
    })()`);
    await cdp.evaluate('document.querySelector(\'[data-tab="look"]\').click()');
    await sleep(800);
    await cdp.screenshot('12-studio-photo', false);

    console.log('14. 分享页 + 开启访问口令');
    await cdp.evaluate('document.querySelector(\'[data-tab="share"]\').click()');
    await sleep(800);
    await cdp.evaluate('document.querySelector(\'[data-act="mode-pin"]\').click()');
    await sleep(600);
    await cdp.evaluate(`(() => {
      const input = document.querySelector('[data-field="access.pin"]');
      if (input) { input.value = '0520'; input.dispatchEvent(new Event('input', { bubbles: true })); }
      document.querySelector('[data-act="regen-link"]').click();
      return true;
    })()`);
    await sleep(1200);
    await cdp.screenshot('13-studio-share', false);
    await cdp.evaluate('window.scrollTo(0, 0)');
    const link = await cdp.evaluate('document.querySelector("[data-link]").value');
    results.checks.linkLength = link.length;
    results.checks.pinMode = await cdp.evaluate('LB.App.ctx.profile.access.mode');

    console.log('15. 链接编解码往返');
    results.checks.codec = await cdp.evaluate(`(async () => {
      const code = ${JSON.stringify(link)}.split('#c=')[1];
      const back = await LB.Codec.decode(code);
      return { tasks24: back.tasks.length === 24, pin: back.access.mode, title: back.title };
    })()`);

    console.log('15b. 备份导出 / 导入');
    results.checks.backup = await cdp.evaluate(`(() => {
      const json = LB.Store.exportJSON();
      const res = LB.Store.importJSON(json);
      return { ok: res.ok, bytes: json.length };
    })()`);

    console.log('15c. 已刮开格子的详情面板');
    await cdp.evaluate('sessionStorage.setItem("lb.player.ok", "1"); location.hash = "#/play"');
    await sleep(900);
    await cdp.evaluate(`document.querySelector('.cell[data-pos="0"]').click()`);
    await sleep(700);
    await cdp.screenshot('detail-sheet', false);
    results.checks.detailSheet = await cdp.evaluate('!!document.querySelector(".sheet .detail-text")');
    await cdp.evaluate('LB.UI.closeSheet()');
    await sleep(400);

    console.log('16. 星夜主题');
    await cdp.evaluate('sessionStorage.setItem("lb.player.ok", "1")');
    await cdp.evaluate('location.hash = "#/studio"');
    await sleep(700);
    await cdp.evaluate(`document.querySelector('[data-tab="look"]').click()`);
    await sleep(500);
    await cdp.evaluate(`document.querySelector('[data-act="theme"][data-theme="night"]').click()`);
    await sleep(700);
    await cdp.screenshot('14-studio-night', false);
    await cdp.evaluate('location.hash = "#/play"');
    await sleep(1100);
    await cdp.screenshot('15-night-play', false);

    console.log('17. 换回蜜桃 + 合照背景');
    await cdp.evaluate('location.hash = "#/studio"');
    await sleep(700);
    await cdp.evaluate(`document.querySelector('[data-tab="look"]').click()`);
    await sleep(500);
    await cdp.evaluate(`document.querySelector('[data-act="theme"][data-theme="peach"]').click()`);
    await sleep(500);
    await cdp.evaluate('location.hash = "#/play"');
    await sleep(1200);
    await cdp.screenshot('16-photo-play', false);
    results.checks.hasPhotoBg = await cdp.evaluate('document.body.classList.contains("has-photo")');

    console.log('18. 退出后重新登录工作台');
    await cdp.evaluate('sessionStorage.removeItem("lb.unlocked"); location.hash = "#/studio"');
    await sleep(900);
    await cdp.screenshot('17-studio-login', false);
    await cdp.evaluate(`(() => {
      document.querySelector('[data-p1]').value = '0520';
      document.querySelector('[data-act="submit"]').click();
      return true;
    })()`);
    await sleep(900);
    results.checks.relogin = await cdp.evaluate('!!document.querySelector(".studio-tabs")');

    console.log('19. 清空数据，模拟换手机打开链接');
    await cdp.evaluate('localStorage.clear(); sessionStorage.clear();');
    await cdp.send('Page.navigate', { url: link });
    await sleep(400);
    await cdp.send('Page.reload', { ignoreCache: true });
    await sleep(1800);
    await cdp.screenshot('18-import-pin', false);
    results.checks.importPinScreen = await cdp.evaluate('document.querySelectorAll(".pin-box").length');
    await cdp.evaluate(`(() => {
      const boxes = Array.from(document.querySelectorAll('.pin-box'));
      boxes.forEach((b, i) => {
        b.value = '0520'[i];
        b.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return boxes.length;
    })()`);
    await sleep(1100);
    await cdp.screenshot('19-import-role', false);
    results.checks.importRoleCards = await cdp.evaluate('document.querySelectorAll(".role-card").length');
    results.checks.importTitle = await cdp.evaluate('document.querySelector(".entry-title") ? document.querySelector(".entry-title").textContent : ""');
    results.checks.importedTheme = await cdp.evaluate('LB.App.ctx.profile.theme.id');
    results.checks.importedPin = await cdp.evaluate('LB.App.ctx.profile.access.mode');

    console.log('20. 小屏 360×640');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360, height: 640, deviceScaleFactor: 2, mobile: true,
      screenWidth: 360, screenHeight: 640
    });
    await cdp.evaluate('document.querySelector(\'[data-role="b"]\').click()');
    await sleep(1200);
    await cdp.screenshot('20-small', false);
    results.checks.smallOverflow = await cdp.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1');

    results.errors = cdp.errors;
    results.checks.consoleOk = cdp.errors.length === 0;

    await fs.writeFile(path.resolve('docs/raw/shot-report.json'), JSON.stringify(results, null, 2));
    console.log('\nRESULT');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    chrome.kill();
    await sleep(300);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  if (typeof cdp !== 'undefined' && cdp) console.error('errors so far:', cdp.errors);
  process.exitCode = 1;
});
