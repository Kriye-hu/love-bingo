/* ==========================================================
   恋爱刮刮 Bingo · 手指刮开涂层
   Canvas 涂层 + destination-out 擦除 + 面积检测
   ========================================================== */
(function (LB) {
  'use strict';

  const THRESHOLD = 0.42;      /* 擦掉 42% 自动揭开 */
  const BRUSH = 22;            /* 默认笔刷半径（CSS 像素） */

  function mix(hexA, hexB, weight) {
    const a = LB.Theme.hexToRgb(hexA);
    const b = LB.Theme.hexToRgb(hexB);
    const w = Math.max(0, Math.min(1, weight));
    const r = Math.round(a.r + (b.r - a.r) * w);
    const g = Math.round(a.g + (b.g - a.g) * w);
    const bl = Math.round(a.b + (b.b - a.b) * w);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function drawFoil(canvas, ctx, accent, label, dpr, dark) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.scale(dpr, dpr);

    const cw = w / dpr;
    const ch = h / dpr;

    /* 玫瑰金箔底（深色主题用暗金属，保证未刮开与已刮开一眼可分） */
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    if (dark) {
      grad.addColorStop(0, mix(accent, '#241a38', 0.78));
      grad.addColorStop(0.35, mix(accent, '#5a3c54', 0.62));
      grad.addColorStop(0.62, mix(accent, '#7a4f63', 0.55));
      grad.addColorStop(1, mix(accent, '#2e2142', 0.78));
    } else {
      grad.addColorStop(0, mix(accent, '#ffffff', 0.8));
      grad.addColorStop(0.35, mix(accent, '#f0c9a8', 0.55));
      grad.addColorStop(0.62, mix(accent, '#ffe9dc', 0.72));
      grad.addColorStop(1, mix(accent, '#d9a68f', 0.45));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    /* 斜向拉丝 */
    ctx.save();
    ctx.globalAlpha = dark ? 0.1 : 0.16;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, cw * 0.03);
    for (let i = -ch; i < cw + ch; i += cw * 0.22) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - ch, ch);
      ctx.stroke();
    }
    ctx.restore();

    /* 星星点点 */
    ctx.save();
    const seed = label ? label.length : 3;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 37 + seed * 13) % 100) / 100 * cw;
      const y = ((i * 71 + seed * 29) % 100) / 100 * ch;
      const r = cw * (0.012 + ((i * 7) % 5) * 0.006);
      ctx.globalAlpha = (dark ? 0.22 : 0.35) + (i % 3) * 0.1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* 边缘高光 */
    ctx.save();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, cw - 1.5, ch - 1.5);
    ctx.restore();

    /* 文字：编号 + 刮 */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ink = dark ? 'rgba(255,226,240,0.55)' : 'rgba(120,70,90,0.42)';
    ctx.fillStyle = ink;
    ctx.font = '700 ' + Math.round(cw * 0.16) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('✦', cw / 2, ch * 0.4);
    ctx.font = '700 ' + Math.round(cw * 0.105) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = dark ? 'rgba(255,226,240,0.62)' : 'rgba(120,70,90,0.5)';
    ctx.fillText(label, cw / 2, ch * 0.63);
    ctx.font = '600 ' + Math.round(cw * 0.075) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = dark ? 'rgba(255,226,240,0.4)' : 'rgba(120,70,90,0.32)';
    ctx.fillText('刮开', cw / 2, ch * 0.79);
    ctx.restore();
  }

  function attach(canvas, opts) {
    const options = opts || {};
    const accent = options.accent || '#e8507e';
    const label = options.label || 'NO.1';
    const mode = options.mode || 'finger';
    const onReveal = options.onReveal || function () {};
    const onScratch = options.onScratch || function () {};

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    const sampler = document.createElement('canvas');
    sampler.width = 32;
    sampler.height = 32;
    const sctx = sampler.getContext('2d', { willReadFrequently: true });

    let dpr = 1;
    let revealed = false;
    let drawing = false;
    let last = null;
    let lastCheck = 0;
    let destroyed = false;

    const dark = !!options.dark;

  function size() {
      const rect = canvas.parentElement.getBoundingClientRect();
      if (!rect.width) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return false;
      canvas.width = w;
      canvas.height = h;
      drawFoil(canvas, ctx, accent, label, dpr, dark);
      return true;
    }

    function eraseAt(x, y, radius) {
      const g = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function ratio() {
      try {
        sctx.clearRect(0, 0, 32, 32);
        sctx.drawImage(canvas, 0, 0, 32, 32);
        const data = sctx.getImageData(0, 0, 32, 32).data;
        let clear = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 40) clear++;
        }
        return clear / (32 * 32);
      } catch (e) {
        return 0;
      }
    }

    function finish() {
      if (revealed || destroyed) return;
      revealed = true;
      drawing = false;
      canvas.classList.add('clearing');
      if (options.onReveal) options.onReveal();
      setTimeout(() => { if (!destroyed) canvas.remove(); }, 420);
    }

    function maybeReveal(force) {
      if (revealed) return;
      const now = performance.now();
      if (!force && now - lastCheck < 130) return;
      lastCheck = now;
      if (ratio() >= (options.threshold || THRESHOLD)) finish();
    }

    function pointFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function strokeTo(p) {
      if (!last) { last = p; return; }
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(3, BRUSH * 0.5);
      const steps = Math.max(1, Math.ceil(dist / step));
      for (let i = 1; i <= steps; i++) {
        eraseAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps, BRUSH);
      }
      last = p;
    }

    function onDown(e) {
      if (revealed) return;
      if (mode === 'tap') {
        finish();
        return;
      }
      e.preventDefault();
      drawing = true;
      last = null;
      const p = pointFromEvent(e);
      eraseAt(p.x, p.y, BRUSH * 1.15);
      last = p;
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      onScratch();
    }

    function onMove(e) {
      if (!drawing || revealed) return;
      e.preventDefault();
      const p = pointFromEvent(e);
      strokeTo(p);
      onScratch();
      maybeReveal(false);
    }

    function onUp() {
      if (!drawing) return;
      drawing = false;
      maybeReveal(true);
    }

    function onClick() {
      if (mode === 'tap' && !revealed) finish();
    }

    function onKey(e) {
      if (revealed) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('keydown', onKey);

    size();
    const ro = new ResizeObserver(() => {
      if (revealed || destroyed) return;
      if (size()) last = null;
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return {
      reveal() { finish(); },
      isRevealed() { return revealed; },
      destroy() {
        destroyed = true;
        ro.disconnect();
        if (canvas.parentNode) canvas.remove();
      }
    };
  }

  LB.Scratch = { attach, THRESHOLD };
})(window.LB = window.LB || {});
