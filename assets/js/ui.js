/* ==========================================================
   恋爱刮刮 Bingo · UI 基础件
   弹窗 / 底部面板 / Toast / 彩带 / 音效 / 震动
   ========================================================== */
(function (LB) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const esc = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const reduceMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(message, opts) {
    const root = $('#toastRoot');
    if (!root) return;
    const options = opts || {};
    const node = document.createElement('div');
    node.className = 'toast' + (options.tone ? ' toast-' + options.tone : '');
    node.innerHTML = options.icon ? '<span class="toast-icon">' + esc(options.icon) + '</span>' : '';
    node.appendChild(document.createTextNode(message));
    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    clearTimeout(toastTimer);
    const life = options.duration || 2200;
    setTimeout(() => {
      node.classList.remove('in');
      setTimeout(() => node.remove(), 320);
    }, life);
    return node;
  }

  /* ---------------- Modal ---------------- */
  let activeModal = null;
  let lastFocus = null;
  let modalOnClose = null;

  function closeModal() {
    const root = $('#modalRoot');
    if (!root) return;
    const node = root.firstElementChild;
    if (node) {
      node.classList.remove('in');
      const overlay = node;
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 260);
    }
    activeModal = null;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
    lastFocus = null;
    const cb = modalOnClose;
    modalOnClose = null;
    if (cb) setTimeout(cb, 0);
  }

  function modal(opts) {
    const options = opts || {};
    const root = $('#modalRoot');
    if (!root) return null;
    if (root.firstElementChild) root.innerHTML = '';
    lastFocus = document.activeElement;
    modalOnClose = options.onClose || null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal ' + (options.className || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(options.title || '提示') + '">' +
        (options.closeButton === false ? '' : '<button class="modal-close" type="button" aria-label="关闭">✕</button>') +
        (options.ribbon ? '<div class="modal-ribbon">' + options.ribbon + '</div>' : '') +
        (options.title ? '<h2 class="modal-title">' + esc(options.title) + '</h2>' : '') +
        (options.subtitle ? '<p class="modal-subtitle">' + esc(options.subtitle) + '</p>' : '') +
        '<div class="modal-body">' + (options.body || '') + '</div>' +
        (options.actions ? '<div class="modal-actions">' + options.actions + '</div>' : '') +
      '</div>';

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && options.dismissible !== false) closeModal();
    });
    const closeBtn = $('.modal-close', overlay);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    root.appendChild(overlay);
    activeModal = overlay;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => overlay.classList.add('in'));

    if (options.onMount) options.onMount(overlay);
    setTimeout(() => {
      const focusable = overlay.querySelector('.modal-actions .btn-primary') ||
        overlay.querySelector('.modal-body input') ||
        overlay.querySelector('.modal-close');
      if (focusable && !options.noAutoFocus) { try { focusable.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }, 60);
    return overlay;
  }

  /* ---------------- Sheet（底部面板） ---------------- */
  let sheetEl = null;
  function closeSheet() {
    if (!sheetEl) return;
    const node = sheetEl;
    sheetEl = null;
    node.classList.remove('in');
    setTimeout(() => node.remove(), 280);
    document.body.classList.remove('no-scroll');
  }
  function sheet(opts) {
    const options = opts || {};
    closeSheet();
    const root = $('#sheetRoot');
    if (!root) return null;
    const node = document.createElement('div');
    node.className = 'sheet-overlay';
    node.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(options.title || '设置') + '">' +
        '<div class="sheet-grabber"></div>' +
        '<div class="sheet-head">' +
          '<h3>' + esc(options.title || '') + '</h3>' +
          '<button class="icon-btn" type="button" data-sheet-close aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="sheet-body">' + (options.body || '') + '</div>' +
      '</div>';
    node.addEventListener('click', (e) => {
      if (e.target === node) closeSheet();
    });
    node.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
    root.appendChild(node);
    sheetEl = node;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => node.classList.add('in'));
    if (options.onMount) options.onMount(node);
    return node;
  }

  /* ---------------- Confirm / Prompt ---------------- */
  function confirm(opts) {
    const options = Object.assign({ title: '确认', message: '', okText: '确定', cancelText: '取消', danger: false }, opts);
    return new Promise((resolve) => {
      const overlay = modal({
        title: options.title,
        body: '<p class="modal-text">' + esc(options.message) + '</p>',
        actions: '<button class="btn btn-ghost" data-cancel>' + esc(options.cancelText) + '</button>' +
                 '<button class="btn ' + (options.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(options.okText) + '</button>',
        dismissible: true
      });
      if (!overlay) return resolve(false);
      let settled = false;
      const finish = (val) => { if (settled) return; settled = true; closeModal(); resolve(val); };
      $('[data-ok]', overlay).addEventListener('click', () => finish(true));
      $('[data-cancel]', overlay).addEventListener('click', () => finish(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    });
  }

  function prompt(opts) {
    const options = Object.assign({
      title: '输入', message: '', placeholder: '', value: '', type: 'text',
      maxlength: 40, okText: '确定', cancelText: '取消', inputmode: ''
    }, opts);
    return new Promise((resolve) => {
      let settled = false;
      const overlay = modal({
        title: options.title,
        body: (options.message ? '<p class="modal-text">' + esc(options.message) + '</p>' : '') +
          '<input class="input" data-input type="' + esc(options.type) + '" maxlength="' + options.maxlength + '" ' +
          (options.inputmode ? 'inputmode="' + esc(options.inputmode) + '" ' : '') +
          'placeholder="' + esc(options.placeholder) + '" value="' + esc(options.value) + '" autocomplete="off" spellcheck="false">',
        actions: '<button class="btn btn-ghost" data-cancel>' + esc(options.cancelText) + '</button>' +
                 '<button class="btn btn-primary" data-ok>' + esc(options.okText) + '</button>',
        onMount: (node) => {
          const input = $('[data-input]', node);
          setTimeout(() => { try { input.focus(); input.select(); } catch (e) { /* ignore */ } }, 80);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
          });
        }
      });
      if (!overlay) return resolve(null);
      const input = $('[data-input]', overlay);
      const submit = () => {
        if (settled) return;
        settled = true;
        const val = input.value.trim();
        closeModal();
        resolve(val);
      };
      $('[data-ok]', overlay).addEventListener('click', submit);
      $('[data-cancel]', overlay).addEventListener('click', () => {
        if (settled) return; settled = true; closeModal(); resolve(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !settled) { settled = true; closeModal(); resolve(null); }
      });
    });
  }

  /* ---------------- 清理所有浮层（切换页面时） ---------------- */
  function resetOverlays() {
    modalOnClose = null;
    activeModal = null;
    sheetEl = null;
    const modalRoot = $('#modalRoot');
    const sheetRoot = $('#sheetRoot');
    if (modalRoot) modalRoot.innerHTML = '';
    if (sheetRoot) sheetRoot.innerHTML = '';
    document.body.classList.remove('no-scroll');
    if (LB.UI && LB.UI.Confetti && LB.UI.Confetti.stop) LB.UI.Confetti.stop();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sheetEl) closeSheet();
      else if (activeModal) closeModal();
    }
  });

  /* ---------------- 震动 ---------------- */
  function haptic(pattern) {
    if (!navigator.vibrate) return;
    const meta = LB.Store ? LB.Store.loadMeta() : null;
    if (meta && meta.haptics === false) return;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  /* ---------------- 音效（纯合成，无素材） ---------------- */
  const Sound = (function () {
    let ctx = null;
    let lastTick = 0;

    function enabled() {
      const meta = LB.Store ? LB.Store.loadMeta() : null;
      return !meta || meta.sound !== false;
    }

    function ensure() {
      if (!enabled()) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, duration, opts) {
      const audio = ensure();
      if (!audio) return;
      const options = opts || {};
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      osc.type = options.type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, now + duration);
      const vol = options.volume == null ? 0.06 : options.volume;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    return {
      unlock() { ensure(); },
      tick() {
        if (!enabled()) return;
        const now = performance.now();
        if (now - lastTick < 90) return;
        lastTick = now;
        tone(760 + Math.random() * 500, 0.035, { type: 'triangle', volume: 0.018 });
      },
      pop() { tone(520, 0.14, { to: 880, type: 'triangle', volume: 0.05 }); },
      chime() {
        [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.3, { type: 'sine', volume: 0.05 }), i * 90));
      },
      fanfare() {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.42, { type: 'triangle', volume: 0.05 }), i * 110));
      },
      tickSound() { /* 命名兼容 */ this.tick(); }
    };
  })();

  /* ---------------- 彩带（Canvas 粒子，带心形） ---------------- */
  const Confetti = (function () {
    let raf = null;
    let particles = [];
    let canvas = null;
    let ctx = null;
    let dpr = 1;

    const COLORS = ['#e8507e', '#f6a15f', '#ffb8d0', '#ffcda8', '#e8b4d8', '#ffd166', '#ff6b9d', '#b48cff'];

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }

    function heart(ctx2, size) {
      ctx2.beginPath();
      const s = size / 2;
      ctx2.moveTo(0, s * 0.7);
      ctx2.bezierCurveTo(-s * 1.6, -s * 0.6, -s * 0.5, -s * 1.4, 0, -s * 0.45);
      ctx2.bezierCurveTo(s * 0.5, -s * 1.4, s * 1.6, -s * 0.6, 0, s * 0.7);
      ctx2.closePath();
      ctx2.fill();
    }

    function draw() {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = 0;
      particles.forEach((p) => {
        p.vy += 0.16;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        if (p.life <= 0 || p.y > window.innerHeight + 40) return;
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.fillStyle = p.color;
        if (p.shape === 'heart') heart(ctx, p.size);
        else if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
      });
      particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      if (alive === 0) { stop(); return; }
      raf = requestAnimationFrame(draw);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      particles = [];
      if (ctx && canvas) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }

    function burst(opts) {
      const options = opts || {};
      canvas = canvas || $('#confettiCanvas');
      if (!canvas) return;
      ctx = ctx || canvas.getContext('2d');
      if (reduceMotion()) return;
      resize();
      const amount = options.count || 70;
      const originY = options.fromTop === false ? window.innerHeight * 0.6 : -20;
      for (let i = 0; i < amount; i++) {
        const size = 7 + Math.random() * 9;
        particles.push({
          x: Math.random() * window.innerWidth,
          y: originY + (options.fromTop === false ? Math.random() * 60 : Math.random() * 120),
          vx: (Math.random() - 0.5) * 5,
          vy: 1 + Math.random() * 3,
          size,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          shape: Math.random() < 0.28 ? 'heart' : (Math.random() < 0.4 ? 'circle' : 'rect'),
          life: 140 + Math.random() * 90
        });
      }
      if (!raf) raf = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
      if (raf) resize();
    });

    return { burst, stop };
  })();

  /* ---------------- 小工具 ---------------- */
  function formatDate(iso) {
    if (!iso) return '';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return parts[0] + '.' + parts[1] + '.' + parts[2];
  }

  function daysSince(iso) {
    if (!iso) return 0;
    const start = new Date(iso + 'T00:00:00');
    if (isNaN(start.getTime())) return 0;
    const diff = Date.now() - start.getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  LB.UI = {
    $, $$, esc, toast, modal, closeModal, sheet, closeSheet, confirm, prompt,
    haptic, Sound, Confetti, formatDate, daysSince, copyText, reduceMotion, resetOverlays
  };
})(window.LB = window.LB || {});
