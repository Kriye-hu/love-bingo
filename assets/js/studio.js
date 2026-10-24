/* ==========================================================
   恋爱刮刮 Bingo · 制作者工作台
   首次设置口令 / 登录 / 编辑内容 / 外观 / 分享 / 设置
   ========================================================== */
(function (LB) {
  'use strict';

  const { $, $$, esc, toast, modal, closeModal, confirm, prompt, haptic } = LB.UI;

  let activeTab = 'content';
  let saveTimer = null;
  let linkCache = '';

  function ctx() { return LB.App.ctx; }

  function markDirty() {
    const el = $('[data-save-state]');
    if (el) { el.textContent = '保存中…'; el.classList.add('dirty'); }
  }

  function markSaved() {
    const el = $('[data-save-state]');
    if (el) { el.textContent = '已自动保存'; el.classList.remove('dirty'); }
  }

  function saveSoon() {
    markDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      LB.Store.saveProfile(ctx().profile);
      markSaved();
    }, 380);
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    let node = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (node[key] == null) node[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      node = node[key];
    }
    node[parts[parts.length - 1]] = value;
  }

  /* ==========================================================
     口令网关
     ========================================================== */
  function gateScreen(root, mode) {
    const isSetup = mode === 'setup';
    root.innerHTML =
      '<div class="screen screen-entry">' +
        '<div class="entry-card">' +
          '<div class="entry-emoji">' + (isSetup ? '🔑' : '🛠️') + '</div>' +
          '<h1 class="entry-title">' + (isSetup ? '设置工作台密码' : '制作者登录') + '</h1>' +
          '<p class="entry-sub">' + (isSetup
            ? '创建这张卡的人，才进得了工作台。密码只保存在本机。'
            : '输入你设置过的密码，继续编辑这张卡。') + '</p>' +
          (isSetup
            ? '<input class="input big" type="password" inputmode="numeric" data-p1 maxlength="12" placeholder="至少 4 位" autocomplete="new-password">' +
              '<input class="input big" type="password" inputmode="numeric" data-p2 maxlength="12" placeholder="再输一次" autocomplete="new-password">'
            : '<input class="input big" type="password" inputmode="numeric" data-p1 maxlength="12" placeholder="工作台密码" autocomplete="current-password">') +
          '<button class="btn btn-primary btn-block" data-act="submit">' + (isSetup ? '创建并进入' : '进入工作台') + '</button>' +
          '<button class="btn btn-ghost btn-block" data-act="back">返回首页</button>' +
          (isSetup ? '' : '<button class="link-btn" data-act="forgot">忘记密码？</button>') +
          '<p class="entry-note">纯本地验证，用于防止误入，不是云端账号</p>' +
        '</div>' +
      '</div>';

    const p1 = $('[data-p1]', root);
    const p2 = $('[data-p2]', root);
    setTimeout(() => { try { p1.focus(); } catch (e) { /* ignore */ } }, 120);

    const submit = () => {
      const value = (p1.value || '').trim();
      if (isSetup) {
        if (value.length < 4) return toast('密码至少 4 位', { tone: 'warn' });
        if (value !== (p2.value || '').trim()) return toast('两次输入不一致', { tone: 'warn' });
        LB.Store.setPin(value).then(() => {
          haptic(12);
          toast('工作台已创建，开始做一张你们的卡吧', { icon: '✨' });
          renderStudio(root);
        });
        return;
      }
      LB.Store.verifyPin(value).then((ok) => {
        if (ok) {
          haptic(12);
          renderStudio(root);
        } else {
          haptic([30, 30, 30]);
          p1.value = '';
          toast('密码不对，再试一次', { tone: 'warn' });
          try { p1.focus(); } catch (e) { /* ignore */ }
        }
      });
    };

    $('[data-act="submit"]', root).addEventListener('click', submit);
    [p1, p2].forEach((input) => {
      if (!input) return;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    });
    $('[data-act="back"]', root).addEventListener('click', () => LB.App.go('/'));
    const forgot = $('[data-act="forgot"]', root);
    if (forgot) {
      forgot.addEventListener('click', () => {
        confirm({
          title: '重置工作台密码？',
          message: '会清除本机的制作者密码，卡片内容与使用者的进度都不会受影响。',
          okText: '重置密码',
          danger: true
        }).then((ok) => {
          if (!ok) return;
          LB.Store.resetAuth();
          toast('密码已清除，请重新设置一个');
          gateScreen(root, 'setup');
        });
      });
    }
  }

  function mount(root) {
    if (!ctx().profile) { LB.App.go('/'); return; }
    const auth = LB.Store.loadAuth();
    if (!auth) { gateScreen(root, 'setup'); return; }
    if (!LB.Store.isUnlocked()) { gateScreen(root, 'login'); return; }
    renderStudio(root);
  }

  /* ==========================================================
     工作台主体
     ========================================================== */
  function renderStudio(root) {
    activeTab = activeTab || 'content';
    root.innerHTML =
      '<div class="screen screen-studio">' +
        '<div class="topbar">' +
          '<button class="icon-btn" data-act="back" aria-label="返回">←</button>' +
          '<span class="chip">制作者工作台</span>' +
          '<span class="save-state" data-save-state>已自动保存</span>' +
        '</div>' +
        '<div class="studio-tabs">' +
          ['content:内容', 'look:外观', 'share:分享', 'settings:设置'].map((item) => {
            const parts = item.split(':');
            return '<button data-tab="' + parts[0] + '" class="' + (activeTab === parts[0] ? 'on' : '') + '">' + parts[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="studio-body" data-body></div>' +
        '<div class="studio-foot">' +
          '<button class="btn btn-ghost" data-act="home">🏠 首页</button>' +
          '<button class="btn btn-primary" data-act="preview">👀 预览玩家视角 →</button>' +
        '</div>' +
      '</div>';

    $('[data-act="back"]', root).addEventListener('click', () => LB.App.go('/'));
    $$('[data-tab]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        $$('[data-tab]', root).forEach((b) => b.classList.toggle('on', b === btn));
        renderTab(root);
      });
    });
    const homeBtn = $('.studio-foot [data-act="home"]', root);
    if (homeBtn) homeBtn.addEventListener('click', () => LB.App.go('/'));
    const preview = $('.studio-foot .btn-primary', root);
    preview.addEventListener('click', () => {
      LB.Store.saveProfile(ctx().profile);
      LB.App.go('/play');
    });

    renderTab(root);
  }

  function renderTab(root) {
    const oldBody = $('[data-body]', root);
    if (!oldBody) return;
    /* 每次重建 body，避免重复绑定事件 */
    const body = document.createElement('div');
    body.className = 'studio-body';
    body.setAttribute('data-body', '');
    oldBody.replaceWith(body);

    markSaved();
    if (activeTab === 'content') body.innerHTML = contentTab();
    if (activeTab === 'look') body.innerHTML = lookTab();
    if (activeTab === 'share') body.innerHTML = shareTab();
    if (activeTab === 'settings') body.innerHTML = settingsTab();

    bindCommon(body);
    if (activeTab === 'look') bindLook(body, root);
    if (activeTab === 'share') bindShare(body, root);
    if (activeTab === 'settings') bindSettings(body, root);
  }

  /* 通用输入绑定 + 按钮动作 */
  function bindCommon(body) {
    body.addEventListener('input', (e) => {
      const target = e.target;
      const field = target.dataset.field;
      if (!field) return;
      let value = target.value;
      if (field === 'theme.dim') value = Number(value) / 100;
      if (field === 'theme.blur') value = Number(value);
      setPath(ctx().profile, field, value);
      saveSoon();
      if (field === 'theme.accent' || field === 'theme.accent2') LB.Theme.apply(ctx().profile, ctx().photo);
      if (field === 'theme.blur' || field === 'theme.dim') {
        const label = target.parentElement.querySelector('em');
        if (label) label.textContent = field === 'theme.dim' ? Math.round(Number(target.value)) + '%' : Number(target.value) + 'px';
        LB.Theme.apply(ctx().profile, ctx().photo);
      }
    });

    body.addEventListener('change', (e) => {
      const target = e.target;
      if (target.type === 'file' || target.type === 'range') return;
      const field = target.dataset.field;
      if (!field) return;
      setPath(ctx().profile, field, target.value);
      LB.Store.saveProfile(ctx().profile);
      markSaved();
    });

    body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      const profile = ctx().profile;

      if (act === 'apply-template') {
        const tpl = LB.DATA.TEMPLATES.filter((t) => t.id === btn.dataset.id)[0];
        if (!tpl) return;
        confirm({
          title: '套用「' + tpl.name + '」模板？',
          message: '24 个任务、中心格、奖励券和建议配色会被替换；名字、纪念日与合照保留。',
          okText: '套用模板'
        }).then((ok) => { if (ok) applyTemplate(tpl); });
        return;
      }
      if (act === 'shuffle') {
        const pool = LB.DATA.TASK_LIBRARY.slice();
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
        }
        profile.tasks = pool.slice(0, 24);
        LB.Store.saveProfile(profile);
        renderTab($('#app'));
        toast('换了一批新任务，也可以自己改', { icon: '🎲' });
      }
      if (act === 'defaults') {
        confirm({ title: '恢复默认任务？', message: '24 个任务会回到默认内容，其他设置不变。', okText: '恢复默认' })
          .then((ok) => {
            if (!ok) return;
            profile.tasks = LB.DATA.DEFAULT_TASKS.slice();
            LB.Store.saveProfile(profile);
            renderTab($('#app'));
            toast('已恢复默认任务');
          });
      }
      if (act === 'del-coupon') {
        const index = Number(btn.dataset.index);
        if (profile.coupons.length <= 1) return toast('至少留一张券', { tone: 'warn' });
        profile.coupons.splice(index, 1);
        LB.Store.saveProfile(profile);
        renderTab($('#app'));
      }
      if (act === 'add-coupon') {
        profile.coupons.push({ emoji: '🎁', title: '新的奖励券', desc: '写下兑现方式' });
        LB.Store.saveProfile(profile);
        renderTab($('#app'));
      }
      if (act === 'pattern') {
        profile.theme.pattern = btn.dataset.pattern;
        LB.Store.saveProfile(profile);
        LB.Theme.apply(profile, ctx().photo);
        renderTab($('#app'));
      }
      if (act === 'theme') {
        profile.theme.id = btn.dataset.theme;
        profile.theme.accent = '';
        profile.theme.accent2 = '';
        LB.Store.saveProfile(profile);
        LB.Theme.apply(profile, ctx().photo);
        renderTab($('#app'));
      }
      if (act === 'use-photo') {
        profile.theme.usePhoto = !profile.theme.usePhoto;
        LB.Store.saveProfile(profile);
        LB.Theme.apply(profile, ctx().photo);
        renderTab($('#app'));
      }
    });
  }

  /* ---------------- 模板 ---------------- */
  function templateSection() {
    return (
      '<div class="studio-section">' +
        '<h3 class="sec-title">一键套用模板</h3>' +
        '<p class="sec-desc">整组任务 + 奖励券 + 建议配色；名字、纪念日和合照不会被改掉</p>' +
        '<div class="template-row">' +
          LB.DATA.TEMPLATES.map((t) =>
            '<button class="template-card" data-act="apply-template" data-id="' + t.id + '">' +
              '<span class="tpl-emoji">' + t.emoji + '</span>' +
              '<span class="tpl-name">' + esc(t.name) + '</span>' +
              '<span class="tpl-desc">' + esc(t.desc) + '</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>'
    );
  }

  function applyTemplate(tpl) {
    const p = ctx().profile;
    p.tasks = tpl.tasks.slice();
    p.center = tpl.center;
    p.coupons = tpl.coupons.map((c) => ({ emoji: c.emoji, title: c.title, desc: c.desc }));
    if (tpl.theme) {
      p.theme.id = tpl.theme;
      p.theme.accent = '';
      p.theme.accent2 = '';
    }
    LB.Store.saveProfile(p);
    LB.Theme.apply(p, ctx().photo);
    renderTab($('#app'));
    toast('已套用「' + tpl.name + '」模板，可以继续微调', { icon: '✨' });
  }

  /* ---------------- 内容 ---------------- */
  function contentTab() {
    const p = ctx().profile;
    return (
      templateSection() +
      '<div class="studio-section">' +
        '<h3 class="sec-title">关于你们</h3>' +
        '<p class="sec-desc">会出现在卡片顶部和分享海报上</p>' +
        '<div class="form-grid">' +
          '<label class="field"><span>名字 A</span><input class="input" data-field="couple.a" maxlength="10" value="' + esc(p.couple.a) + '"></label>' +
          '<label class="field"><span>名字 B</span><input class="input" data-field="couple.b" maxlength="10" value="' + esc(p.couple.b) + '"></label>' +
        '</div>' +
        '<label class="field"><span>卡片标题</span><input class="input" data-field="title" maxlength="24" value="' + esc(p.title) + '"></label>' +
        '<label class="field"><span>副标题</span><input class="input" data-field="subtitle" maxlength="30" value="' + esc(p.subtitle) + '"></label>' +
        '<label class="field"><span>在一起的纪念日</span><input class="input" type="date" data-field="since" value="' + esc(p.since) + '"></label>' +
      '</div>' +

      '<div class="studio-section">' +
        '<div class="sec-head"><h3 class="sec-title">24 个心动任务</h3><span class="counter">' + p.tasks.filter((t) => t.trim()).length + ' / 24</span></div>' +
        '<p class="sec-desc">一句话一件小事，写给你们的日常</p>' +
        '<div class="task-list">' +
          p.tasks.map((t, i) =>
            '<div class="task-row">' +
              '<span class="task-index">' + String(i + 1).padStart(2, '0') + '</span>' +
              '<input class="input" data-field="tasks.' + i + '" maxlength="40" value="' + esc(t) + '" placeholder="写一件你们想一起做的小事">' +
            '</div>'
          ).join('') +
        '</div>' +
        '<div class="row-btns">' +
          '<button class="btn btn-ghost" data-act="shuffle">🎲 随机换一批</button>' +
          '<button class="btn btn-ghost" data-act="defaults">↩︎ 恢复默认</button>' +
        '</div>' +
      '</div>' +

      '<div class="studio-section">' +
        '<h3 class="sec-title">中心格</h3>' +
        '<p class="sec-desc">正中间那格是免费的，可以写一句专属的话（换行会分行显示）</p>' +
        '<textarea class="input" rows="2" maxlength="40" data-field="center">' + esc(p.center) + '</textarea>' +
      '</div>' +

      '<div class="studio-section">' +
        '<div class="sec-head"><h3 class="sec-title">奖励券</h3><span class="counter">' + p.coupons.length + ' 张</span></div>' +
        '<p class="sec-desc">每连成一条线，就从这里抽一张送给对方</p>' +
        '<div class="coupon-editor">' +
          p.coupons.map((c, i) =>
            '<div class="coupon-edit-row">' +
              '<input class="input emoji-input" data-field="coupons.' + i + '.emoji" maxlength="4" value="' + esc(c.emoji) + '" aria-label="图标">' +
              '<div class="coupon-edit-fields">' +
                '<input class="input" data-field="coupons.' + i + '.title" maxlength="16" value="' + esc(c.title) + '" placeholder="券名">' +
                '<input class="input" data-field="coupons.' + i + '.desc" maxlength="30" value="' + esc(c.desc) + '" placeholder="怎么兑现">' +
              '</div>' +
              '<button class="icon-btn danger" data-act="del-coupon" data-index="' + i + '" aria-label="删除这张券">✕</button>' +
            '</div>'
          ).join('') +
        '</div>' +
        '<button class="btn btn-ghost btn-block" data-act="add-coupon">+ 添加一张券</button>' +
      '</div>' +
      '<p class="studio-tip">小提示：任务里带一个 emoji，格子关上时会显示成图标，更好看。</p>'
    );
  }

  /* ---------------- 外观 ---------------- */
  function lookTab() {
    const p = ctx().profile;
    const resolved = LB.Theme.resolve(p);
    const patternNames = { none: '无', hearts: '爱心', stars: '星星', petals: '花瓣', leaves: '叶子' };

    return (
      '<div class="studio-section">' +
        '<h3 class="sec-title">主题配色</h3>' +
        '<p class="sec-desc">点一个起点，再微调你们喜欢的颜色</p>' +
        '<div class="theme-row big">' +
          LB.DATA.THEMES.map((t) =>
            '<button class="theme-dot' + (t.id === p.theme.id ? ' on' : '') + '" data-act="theme" data-theme="' + t.id + '" aria-label="' + esc(t.name) + '" style="--dot-a:' + t.accent + ';--dot-b:' + t.accent2 + '"><span>' + esc(t.name) + '</span></button>'
          ).join('') +
        '</div>' +
        '<div class="form-grid">' +
          '<label class="field"><span>主色</span><input class="color-input" type="color" data-field="theme.accent" value="' + esc(resolved.accent) + '"></label>' +
          '<label class="field"><span>辅色</span><input class="color-input" type="color" data-field="theme.accent2" value="' + esc(resolved.accent2) + '"></label>' +
        '</div>' +
        '<div class="field"><span>底纹</span><div class="chip-row">' +
          LB.DATA.PATTERN_IDS.map((id) =>
            '<button class="chip-btn' + ((p.theme.pattern || resolved.pattern) === id ? ' on' : '') + '" data-act="pattern" data-pattern="' + id + '">' + patternNames[id] + '</button>'
          ).join('') +
        '</div></div>' +
      '</div>' +

      '<div class="studio-section">' +
        '<h3 class="sec-title">背景合照</h3>' +
        '<p class="sec-desc">用你们的照片当背景，只保存在这台手机上</p>' +
        '<div class="bg-preview studio-preview">' +
          (ctx().photo
            ? '<img src="' + esc(ctx().photo) + '" alt="合照">'
            : '<div class="bg-preview-empty"><span>📷</span><p>还没有上传合照</p></div>') +
        '</div>' +
        '<div class="row-btns">' +
          '<button class="btn btn-primary" data-act="upload-photo">选择合照</button>' +
          (ctx().photo ? '<button class="btn btn-ghost" data-act="clear-photo">移除</button>' : '') +
          (ctx().photo ? '<button class="btn btn-ghost" data-act="use-photo">' + (p.theme.usePhoto ? '✓ 启用中' : '已停用') + '</button>' : '') +
        '</div>' +
        '<div class="field"><div class="field-head"><span>模糊</span><em>' + p.theme.blur + 'px</em></div>' +
          '<input type="range" min="0" max="18" step="1" value="' + p.theme.blur + '" data-field="theme.blur"></div>' +
        '<div class="field"><div class="field-head"><span>柔光遮罩</span><em>' + Math.round(p.theme.dim * 100) + '%</em></div>' +
          '<input type="range" min="0" max="75" step="1" value="' + Math.round(p.theme.dim * 100) + '" data-field="theme.dim"></div>' +
        '<input type="file" accept="image/*" data-photo-file hidden>' +
      '</div>' +
      '<p class="studio-tip">照片不会上传，也不会打进分享链接；对方想用同一张，让 TA 自己选一次就好。</p>'
    );
  }

  /* ---------------- 分享 ---------------- */
  function shareTab() {
    const p = ctx().profile;
    const pinMode = p.access.mode === 'pin';
    return (
      '<div class="studio-section">' +
        '<h3 class="sec-title">专属卡片链接</h3>' +
        '<p class="sec-desc">名字、任务、配色都在链接里，对方打开就能刮</p>' +
        '<textarea class="input link-box" rows="3" readonly data-link placeholder="正在生成…">' + esc(linkCache) + '</textarea>' +
        '<div class="row-btns">' +
          '<button class="btn btn-primary" data-act="copy-link">复制链接</button>' +
          '<button class="btn btn-ghost" data-act="share-link">用系统分享</button>' +
          '<button class="btn btn-ghost" data-act="regen-link">刷新</button>' +
        '</div>' +
        '<p class="link-meta" data-link-meta>内容改动后记得刷新一次链接</p>' +
      '</div>' +

      '<div class="studio-section">' +
        '<h3 class="sec-title">访问口令</h3>' +
        '<p class="sec-desc">防止链接被转发给不想给的人</p>' +
        '<div class="segmented">' +
          '<button class="' + (pinMode ? '' : 'on') + '" data-act="mode-open">谁都能打开</button>' +
          '<button class="' + (pinMode ? 'on' : '') + '" data-act="mode-pin">需要口令</button>' +
        '</div>' +
        (pinMode
          ? '<label class="field"><span>4 位口令</span><input class="input pin-field" inputmode="numeric" maxlength="4" data-field="access.pin" value="' + esc(p.access.pin) + '" placeholder="例如 0520"></label>'
          : '') +
      '</div>' +

      '<div class="studio-section">' +
        '<h3 class="sec-title">备份与迁移</h3>' +
        '<p class="sec-desc">换手机时导出再导入，照片需要重新选</p>' +
        '<div class="row-btns">' +
          '<button class="btn btn-ghost" data-act="export">导出 JSON</button>' +
          '<button class="btn btn-ghost" data-act="import">导入 JSON</button>' +
        '</div>' +
        '<input type="file" accept="application/json,.json" data-import-file hidden>' +
      '</div>' +
      '<p class="studio-tip">纯静态网页：没有服务器、没有数据库，所有内容都跟着链接走。这样既免费，也不会泄露你们的隐私。</p>'
    );
  }

  /* ---------------- 设置 ---------------- */
  function settingsTab() {
    return (
      '<div class="studio-section">' +
        '<h3 class="sec-title">工作台</h3>' +
        '<button class="setting-row" data-act="change-pin"><span>🔑 修改工作台密码</span><em>›</em></button>' +
        '<button class="setting-row" data-act="clear-progress"><span>🧹 清空使用者的刮卡进度</span><em>不删除内容 ›</em></button>' +
        '<button class="setting-row" data-act="reset-content"><span>↩︎ 内容恢复出厂</span><em>任务与券 ›</em></button>' +
        '<button class="setting-row" data-act="logout"><span>🚪 退出工作台</span><em>›</em></button>' +
      '</div>' +
      '<div class="studio-section">' +
        '<h3 class="sec-title">关于</h3>' +
        '<p class="sec-desc">恋爱刮刮 Bingo · v' + esc(LB.VERSION || '2.0.0') + '</p>' +
        '<p class="sec-desc">MIT License · 欢迎 star ⭐</p>' +
        '<p class="sec-desc">' + esc(LB.REPO || 'github.com/Kriye-hu/love-bingo') + '</p>' +
      '</div>' +
      '<p class="studio-tip">数据只在本机浏览器里，清理浏览器数据会一起消失，重要的卡记得导出备份。</p>'
    );
  }

  function bindLook(body, root) {
    const fileInput = $('[data-photo-file]', body);
    const uploadBtn = $('[data-act="upload-photo"]', body);
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        toast('正在压缩这张照片…', { icon: '⏳', duration: 1400 });
        LB.Theme.compressImage(file).then((dataUrl) => {
          if (!LB.Store.savePhoto(dataUrl)) {
            toast('照片太大了，换一张小一点的好吗', { tone: 'warn', icon: '🥺' });
            return;
          }
          ctx().photo = dataUrl;
          ctx().profile.theme.usePhoto = true;
          LB.Store.saveProfile(ctx().profile);
          LB.Theme.apply(ctx().profile, ctx().photo);
          renderTab(root);
          toast('合照已设为背景 💕', { icon: '✨' });
        }).catch((err) => toast(err.message || '照片处理失败', { tone: 'warn' }));
      });
    }
    const clearBtn = $('[data-act="clear-photo"]', body);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        LB.Store.savePhoto('');
        ctx().photo = '';
        ctx().profile.theme.usePhoto = false;
        LB.Store.saveProfile(ctx().profile);
        LB.Theme.apply(ctx().profile, '');
        renderTab(root);
        toast('已移除合照');
      });
    }
  }

  function bindShare(body, root) {
    const refreshLink = () => {
      const box = $('[data-link]', body);
      const meta = $('[data-link-meta]', body);
      LB.Codec.buildLink(ctx().profile).then((link) => {
        linkCache = link;
        if (box) box.value = link;
        if (meta) meta.textContent = '链接长度 ' + link.length + ' 字符 · 内容改动后记得刷新一次';
      }).catch(() => {
        if (meta) meta.textContent = '生成失败，请刷新页面重试';
      });
    };
    if (!linkCache) refreshLink();

    const on = (act, fn) => {
      const btn = $('[data-act="' + act + '"]', body);
      if (btn) btn.addEventListener('click', fn);
    };

    on('regen-link', refreshLink);
    on('copy-link', () => {
      if (!linkCache) return toast('链接还在生成，稍等一下', { tone: 'warn' });
      LB.UI.copyText(linkCache).then((ok) => toast(ok ? '链接已复制，去发给 TA 吧' : '复制失败，请手动长按复制', { icon: '🔗' }));
    });
    on('share-link', () => {
      if (!linkCache) return;
      const text = '💕 ' + ctx().profile.title + '，来刮开我们的心动小事';
      if (navigator.share) {
        navigator.share({ title: ctx().profile.title, text, url: linkCache }).catch(() => {
          LB.UI.copyText(linkCache);
        });
      } else {
        LB.UI.copyText(text + ' ' + linkCache).then((ok) => toast(ok ? '链接已复制' : '复制失败'));
      }
    });
    on('mode-open', () => {
      ctx().profile.access = { mode: 'open', pin: '' };
      LB.Store.saveProfile(ctx().profile);
      linkCache = '';
      renderTab(root);
    });
    on('mode-pin', () => {
      ctx().profile.access.mode = 'pin';
      if (!ctx().profile.access.pin) ctx().profile.access.pin = '0520';
      LB.Store.saveProfile(ctx().profile);
      linkCache = '';
      renderTab(root);
    });
    on('export', () => {
      const data = LB.Store.exportJSON();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'love-bingo-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('备份已导出', { icon: '💾' });
    });
    on('import', () => {
      const input = $('[data-import-file]', body);
      if (input) input.click();
    });
    const importInput = $('[data-import-file]', body);
    if (importInput) {
      importInput.addEventListener('change', () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = LB.Store.importJSON(String(reader.result));
          if (!result.ok) return toast(result.error || '导入失败', { tone: 'warn' });
          LB.App.reload().then(() => {
            toast('已导入，内容更新啦', { icon: '✅' });
            renderTab($('#app'));
          });
        };
        reader.readAsText(file);
      });
    }
  }

  function bindSettings(body, root) {
    const on = (act, fn) => {
      const btn = $('[data-act="' + act + '"]', body);
      if (btn) btn.addEventListener('click', fn);
    };

    on('change-pin', () => {
      prompt({ title: '新的工作台密码', message: '至少 4 位，只保存在本机', type: 'password', inputmode: 'numeric', maxlength: 12, placeholder: '新密码' })
        .then((value) => {
          if (value == null) return;
          if (value.length < 4) return toast('密码至少 4 位', { tone: 'warn' });
          LB.Store.setPin(value).then(() => {
            toast('密码已更新', { icon: '🔑' });
          });
        });
    });

    on('clear-progress', () => {
      confirm({ title: '清空刮卡进度？', message: '使用者已刮开的格子、收集的券都会清空；回忆册里的照片会保留。卡片内容不受影响。', okText: '清空进度', danger: true })
        .then((ok) => {
          if (!ok) return;
          const state = LB.Store.defaultState();
          LB.Store.saveState(state);
          LB.App.ctx.state = state;
          LB.App.ctx.game = LB.Game.create(LB.App.ctx.profile, state, {});
          toast('进度已清空', { icon: '🧹' });
        });
    });

    on('reset-content', () => {
      confirm({ title: '内容恢复出厂？', message: '24 个任务、中心格、奖励券都会回到默认内容，配色与背景保留。', okText: '恢复内容', danger: true })
        .then((ok) => {
          if (!ok) return;
          const p = ctx().profile;
          p.tasks = LB.DATA.DEFAULT_TASKS.slice();
          p.center = '今日限定\n心动位';
          p.coupons = JSON.parse(JSON.stringify(LB.DATA.DEFAULT_COUPONS));
          p.title = '我们的恋爱 Bingo';
          p.subtitle = '刮一刮 · 心动一下';
          LB.Store.saveProfile(p);
          renderTab(root);
          toast('内容已恢复默认');
        });
    });

    on('logout', () => {
      try { sessionStorage.removeItem('lb.unlocked'); } catch (e) { /* ignore */ }
      LB.App.go('/');
    });
  }

  LB.Studio = { mount, renderStudio, markSaved, markDirty };
})(window.LB = window.LB || {});
