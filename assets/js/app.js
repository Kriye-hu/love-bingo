/* ==========================================================
   恋爱刮刮 Bingo · 应用入口
   路由 / 首页 / 专属链接导入 / PWA
   ========================================================== */
(function (LB) {
  'use strict';

  const { $, esc, toast, modal, closeModal } = LB.UI;
  const VERSION = '2.1.0';
  const REPO = 'github.com/Kriye-hu/love-bingo';

  const ctx = { profile: null, state: null, photo: '', meta: null, game: null };
  let installPrompt = null;

  LB.VERSION = VERSION;
  LB.REPO = REPO;

  const App = {
    ctx,
    go,
    reload,
    markSaved: () => {}, /* 由 Studio 覆盖 */
    render
  };
  LB.App = App;

  /* ---------------- 路由 ---------------- */
  function go(path) {
    const target = '#' + path;
    if (location.hash === target) {
      render(path);
    } else {
      location.hash = target;
    }
  }

  function parsePath(hash) {
    let h = hash || '';
    if (h.charAt(0) === '#') h = h.slice(1);
    if (!h) return '/';
    if (h.charAt(0) !== '/') h = '/' + h;
    return h.split('?')[0];
  }

  function render(path) {
    LB.UI.resetOverlays();
    LB.UI.Confetti.stop();
    const root = $('#app');
    if (!root) return;

    if (path === '/studio') {
      if (!ctx.profile) { go('/'); return; }
      LB.Studio.mount(root);
      return;
    }
    if (path === '/wallet') {
      if (!ctx.profile) { go('/'); return; }
      ensureGame();
      LB.Player.renderWallet(root);
      return;
    }
    if (path === '/album') {
      if (!ctx.profile) { go('/'); return; }
      ensureGame();
      LB.Player.renderAlbum(root);
      return;
    }
    if (path === '/play') {
      if (!ctx.profile) { go('/'); return; }
      ensureGame();
      LB.Player.mount(root);
      return;
    }
    renderHome(root);
  }

  function ensureGame() {
    if (!ctx.profile) return;
    if (!ctx.state) ctx.state = LB.Store.defaultState();
    if (!ctx.game) ctx.game = LB.Game.create(ctx.profile, ctx.state, {});
    /* state 可能在别处被替换，保持引用一致 */
    ctx.game.state = ctx.state;
  }

  /* ---------------- 数据加载 ---------------- */
  function loadAll() {
    LB.Store.migrateLegacy();
    ctx.profile = LB.Store.loadProfile();
    ctx.state = LB.Store.loadState() || LB.Store.defaultState();
    ctx.photo = LB.Store.loadPhoto();
    ctx.meta = LB.Store.loadMeta();
    ctx.game = ctx.profile ? LB.Game.create(ctx.profile, ctx.state, {}) : null;
    applyTheme();
    document.title = ctx.profile
      ? ctx.profile.title + ' · 恋爱刮刮 Bingo'
      : '恋爱刮刮 Bingo · 情侣专属心动卡';
  }

  function reload() {
    return new Promise((resolve) => {
      loadAll();
      resolve();
    });
  }

  function applyTheme() {
    const profile = ctx.profile || LB.Store.defaultProfile();
    LB.Theme.apply(profile, ctx.photo);
  }

  /* ---------------- 专属链接 ---------------- */
  function fingerprint(profile) {
    return JSON.stringify({
      t: profile.title,
      n: profile.couple,
      k: profile.tasks,
      u: profile.coupons
    });
  }

  function importCode(code) {
    return LB.Codec.decode(code).then((profile) => {
      const previous = ctx.profile;
      const same = previous && fingerprint(previous) === fingerprint(profile);
      ctx.profile = profile;
      LB.Store.saveProfile(profile);
      if (!same) {
        ctx.state = LB.Store.defaultState();
        LB.Store.saveState(ctx.state);
      }
      ctx.game = LB.Game.create(profile, ctx.state, {});
      applyTheme();
      document.title = profile.title + ' · 恋爱刮刮 Bingo';
      try { sessionStorage.removeItem('lb.player.ok'); } catch (e) { /* ignore */ }
      history.replaceState(null, '', location.pathname + location.search + '#/play');
      render('/play');
      if (!same) {
        setTimeout(() => toast('这是 TA 为你做的卡片，开始刮吧 💕', { icon: '💌', duration: 3000 }), 600);
      }
      return true;
    });
  }

  function openLinkDialog() {
    LB.UI.prompt({
      title: '打开一张卡片',
      message: '把 TA 发来的链接整段粘贴进来',
      placeholder: 'https://…/#c=…',
      maxlength: 4000
    }).then((value) => {
      if (!value) return;
      let code = value.trim();
      const idx = code.indexOf('#c=');
      if (idx !== -1) code = code.slice(idx + 3);
      else if (/^[zj][A-Za-z0-9_-]+$/.test(code)) { /* 直接是口令码 */ }
      else { toast('没有找到卡片信息，检查一下链接？', { tone: 'warn' }); return; }
      toast('正在打开…', { icon: '📬', duration: 1200 });
      importCode(code).catch(() => toast('这张卡片打不开，链接可能不完整', { tone: 'warn' }));
    });
  }

  /* ---------------- 首页 ---------------- */
  function renderHome(root) {
    const profile = ctx.profile;
    const stats = ctx.game ? ctx.game.stats() : null;

    const preview = profile
      ? '<div class="mini-grid">' +
          (function () {
            let out = '';
            for (let pos = 0; pos < 25; pos++) {
              const open = pos === 12 || (ctx.state.revealed || []).indexOf(pos) !== -1;
              const center = pos === 12;
              out += '<i class="' + (center ? 'mini-center' : open ? 'mini-open' : '') + '">' + (center ? '💝' : open ? '·' : '') + '</i>';
            }
            return out;
          })() +
        '</div>'
      : '';

    root.innerHTML =
      '<div class="screen screen-home">' +
        '<div class="hero">' +
          '<div class="hero-badge"><span class="dot-live"></span>5 × 5 · 24 件心动小事</div>' +
          '<h1 class="hero-title">恋爱刮刮<span class="hero-grad">Bingo</span></h1>' +
          '<p class="hero-sub">一张属于两个人的刮刮卡：刮开今天的小任务，连成一线，换一张奖励券。</p>' +
        '</div>' +

        (profile
          ? '<div class="home-card">' +
              '<div class="home-card-head">' +
                '<div>' +
                  '<div class="home-card-title">' + esc(profile.title) + '</div>' +
                  '<div class="home-card-sub">' + esc(profile.couple.a) + ' ♥ ' + esc(profile.couple.b) + '</div>' +
                '</div>' +
                '<div class="home-card-stats"><b>' + stats.revealed + '</b>/24</div>' +
              '</div>' +
              preview +
              '<div class="home-card-foot">' +
                '<span>连成 ' + stats.lines + ' 线</span>' +
                '<span>券 ' + stats.awards + ' 张</span>' +
                (stats.done ? '<span class="done-tag">已完成</span>' : '') +
              '</div>' +
            '</div>'
          : '') +

        '<div class="home-actions">' +
          (profile
            ? '<button class="btn btn-primary btn-block btn-lg" data-act="play">继续刮卡 →</button>' +
              '<button class="btn btn-ghost btn-block" data-act="studio">🛠️ 制作者工作台</button>'
            : '<button class="btn btn-primary btn-block btn-lg" data-act="start">💕 开始一张默认卡</button>' +
              '<button class="btn btn-ghost btn-block" data-act="studio">🛠️ 我要做一张专属卡</button>') +
        '</div>' +

        '<div class="home-links">' +
          '<button data-act="open-link">📬 打开 TA 的卡片</button>' +
          (ctx.game && stats.awards > 0 ? '<button data-act="wallet">🎟️ 我的券包</button>' : '') +
          '<button data-act="install">📲 添加到主屏幕</button>' +
        '</div>' +

        '<ul class="feature-list">' +
          '<li><b>🎨 专属定制</b><span>名字、任务、奖励券、配色都能改，链接发给 TA 就能打开</span></li>' +
          '<li><b>🖼️ 合照背景</b><span>用自己的照片当背景，只存在本机，不上传</span></li>' +
          '<li><b>👆 真·刮开</b><span>手指擦掉金箔涂层，带音效与震动反馈</span></li>' +
          '<li><b>📴 可装可离线</b><span>添加到主屏幕像 App 一样用，没网也能玩</span></li>' +
        '</ul>' +

        '<div class="home-foot">' +
          '<span>🔒 无账号 · 无服务器 · 数据只在你的手机</span>' +
          '<span>MIT · v' + esc(VERSION) + '</span>' +
        '</div>' +
      '</div>';

    const on = (act, fn) => {
      const btn = root.querySelector('[data-act="' + act + '"]');
      if (btn) btn.addEventListener('click', fn);
    };

    on('play', () => go('/play'));
    on('wallet', () => go('/wallet'));
    on('studio', () => {
      if (!ctx.profile) {
        ctx.profile = LB.Store.defaultProfile();
        LB.Store.saveProfile(ctx.profile);
        ctx.state = LB.Store.defaultState();
        LB.Store.saveState(ctx.state);
        ctx.game = LB.Game.create(ctx.profile, ctx.state, {});
        applyTheme();
      }
      go('/studio');
    });
    on('start', () => {
      if (!ctx.profile) {
        ctx.profile = LB.Store.defaultProfile();
        LB.Store.saveProfile(ctx.profile);
      }
      ctx.state = LB.Store.defaultState();
      LB.Store.saveState(ctx.state);
      ctx.game = LB.Game.create(ctx.profile, ctx.state, {});
      applyTheme();
      go('/play');
      setTimeout(() => toast('刮开第一格，看看今天的小任务', { icon: '✨' }), 500);
    });
    on('open-link', openLinkDialog);
    on('install', showInstallHelp);
  }

  /* ---------------- 安装提示 ---------------- */
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator.standalone === true);
  }

  function showInstallHelp() {
    if (isStandalone()) {
      toast('已经装好啦，从桌面图标打开就是全屏的', { icon: '🎉' });
      return;
    }
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') toast('装好了，去桌面找我们吧 💕', { icon: '📲' });
        installPrompt = null;
      });
      return;
    }
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    modal({
      ribbon: '📲',
      title: '添加到主屏幕',
      subtitle: '像 App 一样全屏打开，还能离线玩',
      body: isIOS
        ? '<ol class="steps"><li>用 <b>Safari</b> 打开这个页面</li><li>点底部中间的 <b>分享</b> 按钮</li><li>选择「<b>添加到主屏幕</b>」</li></ol>'
        : '<ol class="steps"><li>用 <b>Chrome / Edge</b> 打开这个页面</li><li>点右上角 <b>⋮</b> 菜单</li><li>选择「<b>安装应用</b>」或「<b>添加到主屏幕</b>」</li></ol>',
      actions: '<button class="btn btn-primary" data-close>知道啦</button>',
      onMount: (node) => node.querySelector('[data-close]').addEventListener('click', closeModal)
    });
  }

  /* ---------------- PWA ---------------- */
  function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
    });
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      toast('已装到桌面，随时可以刮一张 💕', { icon: '🎉' });
    });

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('新版本已就绪，重新打开一次就更新啦', { icon: '✨', duration: 3500 });
              }
            });
          });
        }).catch(() => { /* 离线能力不可用也不影响游戏 */ });
      });
    }
  }

  /* ---------------- 启动 ---------------- */
  function handleRoute() {
    const hash = location.hash || '';
    if (/^#c=/.test(hash)) {
      const code = hash.slice(3);
      importCode(code).catch(() => {
        toast('这张卡片打不开，链接可能不完整', { tone: 'warn' });
        history.replaceState(null, '', location.pathname + location.search + '#/');
        render('/');
      });
      return;
    }
    render(parsePath(hash));
  }

  function boot() {
    loadAll();
    setupPWA();
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    /* 首次交互解锁音频（iOS 需要） */
    const unlock = () => {
      LB.UI.Sound.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }

  App.markSaved = () => { if (LB.Studio && LB.Studio.markSaved) LB.Studio.markSaved(); };
  App.showInstallHelp = showInstallHelp;
  App.importCode = importCode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.LB = window.LB || {});
