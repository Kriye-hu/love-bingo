/* ==========================================================
   恋爱刮刮 Bingo · 使用者视角
   登录 / 刮卡 / 连线开券 / 券包 / 背景合照 / 分享
   ========================================================== */
(function (LB) {
  'use strict';

  const { $, $$, esc, toast, modal, closeModal, sheet, closeSheet, haptic, Sound } = LB.UI;

  let scratchHandles = {};
  let awardQueue = [];
  let awardModalOpen = false;
  let pendingAllDone = false;
  let saveTimer = null;

  function ctx() { return LB.App.ctx; }

  function saveProfileSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      LB.Store.saveProfile(ctx().profile);
      LB.App.markSaved();
    }, 260);
  }

  function displayName(role) {
    const p = ctx().profile;
    return role === 'b' ? p.couple.b : p.couple.a;
  }

  function cellNumber(pos) {
    const idx = LB.Store.ORDER.indexOf(pos);
    return idx < 0 ? '' : String(idx + 1).padStart(2, '0');
  }

  function cellContent(pos) {
    const profile = ctx().profile;
    if (pos === LB.Store.CENTER) {
      const lines = String(profile.center || '今日限定\n心动位').split('\n').filter(Boolean);
      return '<span class="cell-heart">💝</span><span class="cell-free-text">' + lines.map(esc).join('<br>') + '</span>';
    }
    const parsed = LB.Game.parseTask(ctx().game.taskAt(pos));
    return '<span class="cell-icon">' + esc(parsed.icon) + '</span><span class="cell-text">' + esc(parsed.text) + '</span>';
  }

  /* ==========================================================
     使用者登录
     ========================================================== */
  function renderEntry(root, stage) {
    const profile = ctx().profile;
    if (!profile) { LB.App.go('/'); return; }

    if (stage === 'pin') {
      root.innerHTML =
        '<div class="screen screen-entry">' +
          '<div class="entry-card">' +
            '<div class="entry-emoji">🔐</div>' +
            '<h1 class="entry-title">这是一张专属卡片</h1>' +
            '<p class="entry-sub">输入 TA 设置的 4 位口令，才能刮开哦</p>' +
            '<div class="pin-inputs">' +
              [0, 1, 2, 3].map((i) => '<input class="pin-box" data-pin="' + i + '" inputmode="numeric" maxlength="1" type="tel" aria-label="第' + (i + 1) + '位口令">').join('') +
            '</div>' +
            '<button class="btn btn-primary btn-block" data-action="pin-submit">进入卡片</button>' +
            '<button class="btn btn-ghost btn-block" data-action="back-home">返回首页</button>' +
          '</div>' +
        '</div>';
      const boxes = $$('[data-pin]', root);
      setTimeout(() => { try { boxes[0].focus(); } catch (e) { /* ignore */ } }, 120);
      boxes.forEach((box, i) => {
        box.addEventListener('input', () => {
          box.value = box.value.replace(/\D/g, '').slice(0, 1);
          if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
          if (boxes.every((b) => b.value)) submitPin(root);
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
        });
      });
      $('[data-action="pin-submit"]', root).addEventListener('click', () => submitPin(root));
      $('[data-action="back-home"]', root).addEventListener('click', () => LB.App.go('/'));
      return;
    }

    /* 选择「我是谁」 */
    const names = [
      { role: 'a', name: profile.couple.a, emoji: '🐰' },
      { role: 'b', name: profile.couple.b, emoji: '🐻' }
    ];
    root.innerHTML =
      '<div class="screen screen-entry">' +
        '<div class="entry-card">' +
          '<div class="entry-emoji">💌</div>' +
          '<h1 class="entry-title">' + esc(profile.title) + '</h1>' +
          '<p class="entry-sub">' + esc(profile.subtitle || '刮一刮 · 心动一下') + '</p>' +
          '<div class="role-pick">' +
            names.map((n) =>
              '<button class="role-card" data-role="' + n.role + '">' +
                '<span class="role-avatar">' + n.emoji + '</span>' +
                '<span class="role-name">我是 ' + esc(n.name) + '</span>' +
                '<span class="role-rock">开始刮卡 →</span>' +
              '</button>'
            ).join('') +
          '</div>' +
          '<p class="entry-note">进度只保存在这台手机上 · 不上传任何服务器</p>' +
          '<button class="link-btn" data-action="go-studio">我也是制作者 · 打开工作台 →</button>' +
        '</div>' +
      '</div>';
    $$('[data-role]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx().state.role = btn.dataset.role;
        ctx().state.startedAt = ctx().state.startedAt || Date.now();
        LB.Store.saveState(ctx().state);
        haptic(10);
        renderGame(root);
      });
    });
    const studioLink = $('[data-action="go-studio"]', root);
    if (studioLink) studioLink.addEventListener('click', () => LB.App.go('/studio'));
  }

  function submitPin(root) {
    const entered = $$('[data-pin]', root).map((b) => b.value).join('');
    const expected = String(ctx().profile.access.pin || '');
    if (entered === expected) {
      try { sessionStorage.setItem('lb.player.ok', '1'); } catch (e) { /* ignore */ }
      haptic([10, 40, 10]);
      mount(root);
    } else {
      haptic([30, 30, 30]);
      root.querySelector('.pin-inputs').classList.add('shake');
      setTimeout(() => root.querySelector('.pin-inputs').classList.remove('shake'), 420);
      toast('口令不对，再想想？', { tone: 'warn', icon: '🥺' });
      $$('[data-pin]', root).forEach((b) => { b.value = ''; });
      try { $$('[data-pin]', root)[0].focus(); } catch (e) { /* ignore */ }
    }
  }

  function playerUnlocked() {
    if (ctx().profile.access.mode !== 'pin') return true;
    try { return sessionStorage.getItem('lb.player.ok') === '1'; } catch (e) { return false; }
  }

  /* ==========================================================
     挂载
     ========================================================== */
  function mount(root) {
    if (!ctx().profile) { LB.App.go('/'); return; }
    if (!playerUnlocked()) { renderEntry(root, 'pin'); return; }
    if (!ctx().state.role) { renderEntry(root, 'role'); return; }
    renderGame(root);
  }

  /* ==========================================================
     游戏主界面
     ========================================================== */
  function renderGame(root) {
    const profile = ctx().profile;
    const state = ctx().state;
    const game = ctx().game = LB.Game.create(profile, state, {});
    scratchHandles = {};
    awardQueue = [];
    awardModalOpen = false;
    pendingAllDone = false;

    const stats = game.stats();
    const theme = LB.Theme.resolve(profile);
    const days = LB.UI.daysSince(profile.since);
    const role = state.role === 'b' ? 'b' : 'a';

    let cells = '';
    for (let pos = 0; pos < 25; pos++) {
      const isCenter = pos === LB.Store.CENTER;
      const revealed = game.isRevealed(pos);
      const classes = 'cell' + (isCenter ? ' free-cell' : '') + (revealed ? ' revealed' : '');
      cells +=
        '<div class="' + classes + '" data-pos="' + pos + '" data-revealed="' + (revealed ? '1' : '0') + '"' +
          ' role="button" tabindex="0" aria-label="' + (isCenter ? '免费格' : '第 ' + cellNumber(pos) + ' 格，' + (revealed ? '已刮开' : '未刮开')) + '">' +
          '<div class="cell-content">' + cellContent(pos) + '</div>' +
          (isCenter ? '' : '<span class="cell-no">' + cellNumber(pos) + '</span>') +
          (revealed || isCenter ? '' : '<canvas class="scratch-canvas" aria-hidden="true"></canvas>') +
        '</div>';
    }

    root.innerHTML =
      '<div class="screen screen-play">' +
        '<div class="topbar">' +
          '<span class="chip chip-soft">' + esc('520 · 专属刮刮卡') + '</span>' +
          '<div class="topbar-actions">' +
            '<button class="icon-btn" data-action="settings" aria-label="设置">⚙️</button>' +
          '</div>' +
        '</div>' +
        '<header class="play-head">' +
          '<h1 class="play-title">' + esc(profile.title) + '</h1>' +
          '<p class="play-sub">' + esc(profile.subtitle || '刮一刮 · 心动一下') + '</p>' +
          '<div class="couple">' +
            '<span class="couple-name' + (role === 'a' ? ' me' : '') + '">' + esc(profile.couple.a) + '</span>' +
            '<span class="couple-heart">♥</span>' +
            '<span class="couple-name' + (role === 'b' ? ' me' : '') + '">' + esc(profile.couple.b) + '</span>' +
          '</div>' +
          (days > 0 ? '<div class="since">我们一起 <b>' + days + '</b> 天</div>' : '') +
        '</header>' +

        '<div class="progress-card">' +
          '<div class="progress-meta">' +
            '<span><b data-p-count>' + stats.revealed + '</b> / 24 已刮开</span>' +
            '<span data-p-lines>连成 <b>' + stats.lines + '</b> 线</span>' +
          '</div>' +
          '<div class="progress-track"><i data-p-fill style="width:' + (stats.revealed / 24 * 100) + '%"></i></div>' +
        '</div>' +

        '<div class="card-wrap">' +
          '<div class="bingo-card">' +
            '<div class="grid" id="bingoGrid">' + cells + '</div>' +
          '</div>' +
        '</div>' +

        '<p class="hint-line">' +
          (stats.revealed >= 24 ? '整张卡都被你们刮完啦 💝' : '用手指刮开涂层 · 连成一线就能开一张奖励券') +
        '</p>' +

        '<div class="quick-row">' +
          '<button class="quick-btn" data-action="wallet">' +
            '<span class="quick-icon">🎟️</span><span>券包</span>' +
            (stats.awards > 0 ? '<span class="quick-badge">' + stats.awards + '</span>' : '') +
          '</button>' +
          '<button class="quick-btn" data-action="album">' +
            '<span class="quick-icon">📷</span><span>回忆</span>' +
            '<span class="quick-badge" data-memory-badge hidden></span>' +
          '</button>' +
          '<button class="quick-btn" data-action="background">' +
            '<span class="quick-icon">🖼️</span><span>换背景</span>' +
          '</button>' +
          '<button class="quick-btn" data-action="share">' +
            '<span class="quick-icon">📤</span><span>分享</span>' +
          '</button>' +
        '</div>' +

        '<div class="play-foot">' +
          '<span>' + esc(displayName(role)) + '，今天也要甜一点</span>' +
          '<span class="dot">·</span>' +
          '<span>只存在本机</span>' +
        '</div>' +
      '</div>';

    bindGrid(root);
    paintLines(root);
    root.querySelector('.topbar-actions [data-action="settings"]').addEventListener('click', openSettings);

    $$('[data-action]', root).forEach((btn) => {
      const action = btn.dataset.action;
      if (action === 'wallet') btn.addEventListener('click', () => LB.App.go('/wallet'));
      if (action === 'album') btn.addEventListener('click', () => LB.App.go('/album'));
      if (action === 'background') btn.addEventListener('click', openBackground);
      if (action === 'share') btn.addEventListener('click', openShare);
    });

    if (!ctx().meta.hintSeen && stats.revealed === 0) {
      setTimeout(() => {
        toast('用手指在格子上刮一刮，就能看见今天的小任务', { icon: '👆', duration: 3200 });
        ctx().meta.hintSeen = true;
        LB.Store.saveMeta(ctx().meta);
      }, 700);
    }

    decorateMemories(root);

    /* 首次进入：给未刮开的格子挂上涂层 */
    requestAnimationFrame(() => {
      $$('.scratch-canvas', root).forEach((canvas) => {
        const cell = canvas.closest('.cell');
        const pos = Number(cell.dataset.pos);
        scratchHandles[pos] = LB.Scratch.attach(canvas, {
          accent: theme.accent,
          dark: theme.dark,
          label: 'NO.' + cellNumber(pos),
          mode: ctx().meta.scratch === 'tap' ? 'tap' : 'finger',
          onScratch: () => Sound.tick(),
          onReveal: () => handleReveal(cell, pos)
        });
      });
    });
  }

  function bindGrid(root) {
    const grid = $('#bingoGrid', root);
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const pos = Number(cell.dataset.pos);
      if (cell.dataset.revealed === '1' || pos === LB.Store.CENTER) {
        openCellDetail(pos);
      }
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      e.preventDefault();
      const pos = Number(cell.dataset.pos);
      const handle = scratchHandles[pos];
      if (handle && !handle.isRevealed()) handle.reveal();
      else openCellDetail(pos);
    });
  }

  function handleReveal(cell, pos) {
    const result = ctx().game.reveal(pos);
    cell.dataset.revealed = '1';
    cell.classList.add('revealed');
    cell.setAttribute('aria-label', '第 ' + cellNumber(pos) + ' 格，已刮开');
    Sound.pop();
    haptic(14);
    updateProgress();
    paintLines($('.screen-play'));
    if (result.newAwards && result.newAwards.length) enqueueAwards(result.newAwards);
    if (result.allDone) pendingAllDone = true;
    if (!result.ok) return;
    if (navigator.vibrate && result.newAwards.length) haptic([14, 60, 20, 60, 20]);
  }

  function updateProgress() {
    const s = ctx().game.stats();
    const count = $('[data-p-count]');
    const lines = $('[data-p-lines]');
    const fill = $('[data-p-fill]');
    if (count) count.textContent = s.revealed;
    if (lines) lines.innerHTML = '连成 <b>' + s.lines + '</b> 线';
    if (fill) fill.style.width = (s.revealed / 24 * 100) + '%';
    const quickBadge = $('.quick-badge');
    if (quickBadge) {
      if (s.awards > 0) quickBadge.textContent = s.awards;
      else quickBadge.remove();
    }
  }

  function paintLines(root) {
    if (!root) return;
    $$('.cell.in-line', root).forEach((c) => c.classList.remove('in-line'));
    const done = ctx().game.completedLines();
    done.forEach((line) => {
      line.cells.forEach((pos) => {
        const cell = root.querySelector('.cell[data-pos="' + pos + '"]');
        if (cell) cell.classList.add('in-line');
      });
    });
  }

  /* ---------------- 奖励券弹窗队列 ---------------- */
  function enqueueAwards(list) {
    awardQueue = awardQueue.concat(list);
    maybeShowAward();
  }

  function maybeShowAward() {
    if (awardModalOpen) return;
    if (!awardQueue.length) {
      if (pendingAllDone) { pendingAllDone = false; showAllDone(); }
      return;
    }
    const award = awardQueue.shift();
    awardModalOpen = true;
    Sound.chime();
    LB.UI.Confetti.burst({ count: 80 });
    haptic([18, 50, 26]);

    const multi = awardQueue.length > 0;
    modal({
      ribbon: '🎉',
      title: multi ? '连成 ' + (awardQueue.length + 1) + ' 线！' : 'BINGO！',
      subtitle: award.lineLabel + ' 连成一线，奖励券归你们',
      className: 'modal-bingo',
      body:
        '<div class="coupon-card">' +
          '<div class="coupon-row">' +
            '<span class="coupon-label">520 LOVE COUPON</span>' +
            '<span class="coupon-serial">NO.' + esc(award.serial) + '</span>' +
          '</div>' +
          '<div class="coupon-emoji">' + esc(award.coupon.emoji) + '</div>' +
          '<h3 class="coupon-title">' + esc(award.coupon.title) + '</h3>' +
          '<p class="coupon-desc">' + esc(award.coupon.desc) + '</p>' +
          '<div class="coupon-foot">' + esc(LB.UI.formatDate(new Date(award.at).toISOString().slice(0, 10))) + ' · 收藏在券包里</div>' +
        '</div>',
      actions:
        '<button class="btn btn-ghost" data-close>继续刮</button>' +
        '<button class="btn btn-primary" data-wallet>收进券包</button>',
      onMount: (node) => {
        node.querySelector('[data-close]').addEventListener('click', closeModal);
        node.querySelector('[data-wallet]').addEventListener('click', () => {
          awardQueue = [];
          pendingAllDone = false;
          closeModal();
          setTimeout(() => LB.App.go('/wallet'), 120);
        });
      },
      onClose: () => {
        awardModalOpen = false;
        setTimeout(maybeShowAward, 220);
      }
    });
  }

  function showAllDone() {
    const s = ctx().game.stats();
    LB.UI.Confetti.burst({ count: 120 });
    Sound.fanfare();
    modal({
      ribbon: '💝',
      title: '整张卡都刮完啦',
      subtitle: '你们一起完成了 24 件小事',
      body:
        '<div class="finish-grid">' +
          '<div><b>' + s.lines + '</b><span>连线</span></div>' +
          '<div><b>' + s.awards + '</b><span>奖励券</span></div>' +
          '<div><b>' + s.redeemed + '</b><span>已兑现</span></div>' +
        '</div>' +
        '<p class="modal-text">要不要把这张卡做成一张海报，留个纪念？</p>',
      actions:
        '<button class="btn btn-ghost" data-close>先看看</button>' +
        '<button class="btn btn-primary" data-poster>生成纪念海报</button>',
      onMount: (node) => {
        node.querySelector('[data-close]').addEventListener('click', closeModal);
        node.querySelector('[data-poster]').addEventListener('click', () => { closeModal(); LB.Poster.open(ctx()); });
      }
    });
  }

  /* ---------------- 格子详情 ---------------- */
  function openCellDetail(pos) {
    const profile = ctx().profile;
    if (pos === LB.Store.CENTER) {
      const lines = String(profile.center || '今日限定\n心动位').split('\n').filter(Boolean);
      sheet({
        title: '心动位',
        body: '<div class="detail"><div class="detail-icon">💝</div><p class="detail-text">' +
          lines.map(esc).join('<br>') + '</p><p class="detail-note">中间这格永远属于你们</p></div>'
      });
      return;
    }
    const parsed = LB.Game.parseTask(ctx().game.taskAt(pos));
    const line = ctx().game.completedLines().filter((l) => l.cells.indexOf(pos) !== -1);
    sheet({
      title: '第 ' + cellNumber(pos) + ' 格',
      body: '<div class="detail">' +
        '<div class="detail-icon">' + esc(parsed.icon) + '</div>' +
        '<p class="detail-text">' + esc(parsed.text) + '</p>' +
        (line.length ? '<p class="detail-note">已连成：' + line.map((l) => esc(l.label)).join('、') + '</p>' : '<p class="detail-note">这一格还没有连线</p>') +
        '<div class="memory-slot" data-memory-slot><p class="memory-loading">回忆加载中…</p></div>' +
      '</div>',
      onMount: (node) => renderMemorySlot(node.querySelector('[data-memory-slot]'), pos)
    });
  }

  /* ---------------- 回忆册：打卡 / 编辑 / 删除 ---------------- */
  function formatDay(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  function renderMemorySlot(slot, pos) {
    if (!slot) return;
    LB.Album.get(ctx().profile.uid, pos)
      .then((entry) => paintMemorySlot(slot, pos, entry))
      .catch(() => {
        if (slot && document.body.contains(slot)) {
          slot.innerHTML = '<p class="sheet-note">这个浏览器暂时用不了回忆册</p>';
        }
      });
  }

  function paintMemorySlot(slot, pos, entry) {
    if (!slot || !document.body.contains(slot)) return;
    if (!entry) {
      slot.innerHTML =
        '<button class="btn btn-ghost btn-block" data-checkin>📷 给这一格留个纪念</button>' +
        '<p class="sheet-note center">照片和心情只保存在这台手机上</p>';
      slot.querySelector('[data-checkin]').addEventListener('click', () => openCheckin(slot, pos, null));
      return;
    }
    slot.innerHTML =
      '<div class="memory-card">' +
        (entry.photo ? '<img class="memory-photo" src="' + entry.photo + '" alt="回忆照片">' : '') +
        (entry.note ? '<p class="memory-note">' + esc(entry.note) + '</p>' : '') +
        '<div class="memory-meta">' + formatDay(entry.at) + ' 记下</div>' +
        '<div class="row-btns">' +
          '<button class="btn btn-ghost" data-edit>编辑</button>' +
          '<button class="btn btn-ghost" data-del>删除</button>' +
        '</div>' +
      '</div>';
    slot.querySelector('[data-edit]').addEventListener('click', () => openCheckin(slot, pos, entry));
    slot.querySelector('[data-del]').addEventListener('click', () => {
      LB.UI.confirm({ title: '删除这条回忆？', message: '照片和文字都会从这台手机上移除。', okText: '删除', danger: true })
        .then((ok) => {
          if (!ok) return;
          LB.Album.remove(ctx().profile.uid, pos).then(() => {
            paintMemorySlot(slot, pos, null);
            decorateMemories($('.screen-play'));
            toast('已删除', { icon: '🧹' });
          });
        });
    });
  }

  function openCheckin(slot, pos, entry) {
    const note = entry ? entry.note : '';
    const existingPhoto = entry ? entry.photo : '';
    slot.innerHTML =
      '<div class="checkin-form">' +
        '<div class="checkin-photo" data-preview>' +
          (existingPhoto ? '<img src="' + existingPhoto + '" alt="照片预览">' : '<span>还没有照片</span>') +
        '</div>' +
        '<button class="btn btn-ghost btn-block" data-pick>📷 选择照片</button>' +
        '<textarea class="input" rows="2" maxlength="80" data-note placeholder="写一句当时的心情…">' + esc(note) + '</textarea>' +
        '<div class="row-btns">' +
          '<button class="btn btn-ghost" data-cancel>取消</button>' +
          '<button class="btn btn-primary" data-save>保存</button>' +
        '</div>' +
        '<input type="file" accept="image/*" data-file hidden>' +
      '</div>';

    let photo = existingPhoto;
    const fileInput = slot.querySelector('[data-file]');
    const preview = slot.querySelector('[data-preview]');
    const noteInput = slot.querySelector('[data-note]');

    slot.querySelector('[data-pick]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      preview.innerHTML = '<span>处理中…</span>';
      LB.Theme.compressImage(file, { maxSize: 900, quality: 0.76 }).then((dataUrl) => {
        photo = dataUrl;
        preview.innerHTML = '<img src="' + dataUrl + '" alt="照片预览">';
      }).catch(() => {
        preview.innerHTML = '<span>这张图读不出来，换一张试试</span>';
      });
    });

    slot.querySelector('[data-cancel]').addEventListener('click', () => paintMemorySlot(slot, pos, entry));

    slot.querySelector('[data-save]').addEventListener('click', () => {
      const text = (noteInput.value || '').trim();
      if (!photo && !text) {
        toast('选一张照片，或者写一句话', { tone: 'warn' });
        return;
      }
      LB.Album.put(ctx().profile.uid, pos, { photo: photo, note: text }).then((saved) => {
        paintMemorySlot(slot, pos, saved);
        decorateMemories($('.screen-play'));
        haptic([10, 40, 10]);
        toast('记下啦，以后翻得到 💕', { icon: '📷' });
      }).catch(() => toast('保存失败，可能是空间不够了', { tone: 'warn' }));
    });
  }

  function decorateMemories(root) {
    if (!root || !ctx().profile) return;
    LB.Album.all(ctx().profile.uid).then((list) => {
      const map = {};
      list.forEach((item) => { map[item.pos] = item; });
      $$('.cell', root).forEach((cell) => {
        const pos = Number(cell.dataset.pos);
        const has = !!map[pos] && cell.dataset.revealed === '1';
        cell.classList.toggle('has-memory', has);
        let dot = cell.querySelector('.memory-dot');
        if (has && !dot) {
          dot = document.createElement('span');
          dot.className = 'memory-dot';
          dot.setAttribute('aria-hidden', 'true');
          dot.innerHTML = '<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="#fff" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4 8h3l1.6-2h6.8L17 8h3v10H4z"/><circle cx="12" cy="13" r="2.8"/></svg>';
          cell.appendChild(dot);
        }
        if (!has && dot) dot.remove();
      });
      const badge = root.querySelector('[data-memory-badge]');
      if (badge) {
        badge.textContent = list.length;
        badge.hidden = list.length === 0;
      }
    }).catch(() => { /* 相册不可用时安静降级 */ });
  }

  /* ---------------- 回忆册页面 ---------------- */
  function renderAlbum(root) {
    const uid = ctx().profile.uid;
    root.innerHTML =
      '<div class="screen screen-album">' +
        '<div class="topbar">' +
          '<button class="icon-btn" data-back aria-label="返回">←</button>' +
          '<span class="chip chip-soft">回忆册</span>' +
          '<button class="icon-btn" data-play aria-label="去刮卡">🎴</button>' +
        '</div>' +
        '<header class="wallet-head">' +
          '<h1 class="wallet-title">我们的回忆册</h1>' +
          '<p class="wallet-sub">刮开一格，就给它留一张照片和一句话</p>' +
        '</header>' +
        '<div class="album-body" data-album-body><p class="memory-loading">正在翻相册…</p></div>' +
      '</div>';

    root.querySelector('[data-back]').addEventListener('click', () => LB.App.go('/play'));
    root.querySelector('[data-play]').addEventListener('click', () => LB.App.go('/play'));

    const body = root.querySelector('[data-album-body]');
    LB.Album.all(uid).then((list) => {
      if (!list.length) {
        body.innerHTML =
          '<div class="empty">' +
            '<div class="empty-icon">📷</div>' +
            '<p class="empty-title">回忆册还是空的</p>' +
            '<p class="empty-sub">回到卡片，点一下已经刮开的格子<br>就能记录照片和当时的心情</p>' +
            '<button class="btn btn-primary" data-go>去刮卡</button>' +
          '</div>';
      } else {
        body.innerHTML =
          '<div class="album-stats">已记录 <b>' + list.length + '</b> / 24 格</div>' +
          '<div class="album-grid">' +
            list.map((item) => {
              const parsed = LB.Game.parseTask(ctx().game.taskAt(item.pos));
              return '<button class="album-item" data-pos="' + item.pos + '">' +
                (item.photo
                  ? '<img src="' + item.photo + '" alt="' + esc(parsed.text) + '">'
                  : '<span class="album-nophoto">' + esc(parsed.icon) + '</span>') +
                '<span class="album-cap">第 ' + cellNumber(item.pos) + ' 格 · ' + esc(parsed.text) + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
          '<p class="sheet-note center">点开可以看大图、修改或删除</p>';
      }
      body.querySelectorAll('.album-item').forEach((btn) => {
        btn.addEventListener('click', () => openCellDetail(Number(btn.dataset.pos)));
      });
      const go = body.querySelector('[data-go]');
      if (go) go.addEventListener('click', () => LB.App.go('/play'));
    }).catch(() => {
      body.innerHTML = '<p class="empty-sub">这个浏览器暂时打不开回忆册</p>';
    });
  }

  /* ==========================================================
     设置
     ========================================================== */
  function openSettings() {
    const meta = ctx().meta;
    sheet({
      title: '设置',
      body:
        '<div class="setting-list">' +
          '<button class="setting-row" data-s="background"><span>🖼️ 背景合照</span><em>' + (ctx().photo && ctx().profile.theme.usePhoto ? '已设置' : '未设置') + ' ›</em></button>' +
          '<div class="setting-block">' +
            '<div class="setting-label">刮开方式</div>' +
            '<div class="segmented">' +
              '<button class="' + (meta.scratch === 'tap' ? '' : 'on') + '" data-scratch="finger">手指刮</button>' +
              '<button class="' + (meta.scratch === 'tap' ? 'on' : '') + '" data-scratch="tap">轻点即开</button>' +
            '</div>' +
          '</div>' +
          '<button class="setting-row" data-toggle="sound"><span>🔊 音效</span><em data-state="sound">' + (meta.sound ? '开' : '关') + '</em></button>' +
          '<button class="setting-row" data-toggle="haptics"><span>📳 震动</span><em data-state="haptics">' + (meta.haptics ? '开' : '关') + '</em></button>' +
          '<button class="setting-row" data-s="role"><span>🙋 切换使用者</span><em>' + esc(displayName(ctx().state.role)) + ' ›</em></button>' +
          '<button class="setting-row" data-s="reset"><span>🔄 重新开始这一张</span><em>会清空进度 ›</em></button>' +
          '<button class="setting-row" data-s="about"><span>💡 关于</span><em>v' + esc(LB.VERSION || '2.0.0') + '</em></button>' +
        '</div>' +
        '<p class="sheet-note">所有数据只存在这台手机上；想把卡片发给别人，用「分享」里的专属链接。</p>',
      onMount: (node) => {
        node.querySelectorAll('[data-s]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.s;
            if (key === 'background') { closeSheet(); setTimeout(openBackground, 220); }
            if (key === 'role') {
              ctx().state.role = null;
              LB.Store.saveState(ctx().state);
              closeSheet();
              setTimeout(() => mount($('#app')), 220);
            }
            if (key === 'reset') {
              LB.UI.confirm({ title: '重新开始？', message: '这一张卡的刮开进度和已收集的券会被清空；回忆册里的照片会保留。确定吗？', okText: '重新开始', danger: true })
                .then((ok) => {
                  if (!ok) return;
                  closeSheet();
                  ctx().game.resetProgress();
                  setTimeout(() => { renderGame($('#app')); toast('新的一张，慢慢来 💕'); }, 220);
                });
            }
            if (key === 'about') {
              closeSheet();
              setTimeout(showAbout, 220);
            }
          });
        });
        node.querySelectorAll('[data-scratch]').forEach((btn) => {
          btn.addEventListener('click', () => {
            ctx().meta.scratch = btn.dataset.scratch;
            LB.Store.saveMeta(ctx().meta);
            node.querySelectorAll('[data-scratch]').forEach((b) => b.classList.toggle('on', b === btn));
            toast(btn.dataset.scratch === 'tap' ? '现在轻点就能开' : '现在要手指刮开啦', { icon: '✨' });
          });
        });
        node.querySelectorAll('[data-toggle]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.toggle;
            ctx().meta[key] = !ctx().meta[key];
            LB.Store.saveMeta(ctx().meta);
            btn.querySelector('[data-state]').textContent = ctx().meta[key] ? '开' : '关';
            if (key === 'haptics' && ctx().meta.haptics) haptic(12);
            if (key === 'sound' && ctx().meta.sound) Sound.pop();
          });
        });
      }
    });
  }

  function showAbout() {
    modal({
      ribbon: '💗',
      title: '关于这张卡',
      body:
        '<p class="modal-text">' + esc(ctx().profile.title) + ' 是一张属于你们的 5×5 心动卡：刮开 24 件小事，连成一线就能收获一张奖励券。</p>' +
        '<p class="modal-text">没有服务器、没有账号、没有上传。照片与进度都留在这台设备里。</p>' +
        '<p class="modal-small">开源 · MIT License · v' + esc(LB.VERSION || '2.0.0') + '</p>',
      actions: '<button class="btn btn-primary" data-close>知道啦</button>',
      onMount: (node) => node.querySelector('[data-close]').addEventListener('click', closeModal)
    });
  }

  /* ---------------- 背景合照 ---------------- */
  function openBackground() {
    const profile = ctx().profile;
    const has = !!(ctx().photo && profile.theme.usePhoto);
    const dim = Math.round((profile.theme.dim || 0) * 100);

    sheet({
      title: '背景',
      body:
        '<div class="field">' +
          '<div class="bg-preview" data-preview>' +
            (has
              ? '<img src="' + esc(ctx().photo) + '" alt="你们的合照">'
              : '<div class="bg-preview-empty"><span>🖼️</span><p>还没有合照<br>选一张喜欢的当背景吧</p></div>') +
          '</div>' +
          '<div class="row-btns">' +
            '<button class="btn btn-primary" data-upload>选择合照</button>' +
            (has ? '<button class="btn btn-ghost" data-remove>移除</button>' : '') +
          '</div>' +
          '<p class="sheet-note">照片只保存在你的手机上，不会上传，也不会出现在分享链接里。</p>' +
        '</div>' +
        '<div class="field">' +
          '<div class="field-head"><span>模糊</span><em data-blur-val>' + profile.theme.blur + 'px</em></div>' +
          '<input type="range" min="0" max="18" step="1" value="' + profile.theme.blur + '" data-blur>' +
        '</div>' +
        '<div class="field">' +
          '<div class="field-head"><span>柔光遮罩</span><em data-dim-val>' + dim + '%</em></div>' +
          '<input type="range" min="0" max="75" step="1" value="' + dim + '" data-dim>' +
        '</div>' +
        '<div class="field">' +
          '<div class="field-head"><span>主题</span><em>配色与底纹</em></div>' +
          '<div class="theme-row">' +
            LB.DATA.THEMES.map((t) =>
              '<button class="theme-dot' + (t.id === profile.theme.id ? ' on' : '') + '" data-theme="' + t.id + '" aria-label="' + esc(t.name) + '" style="--dot-a:' + t.accent + ';--dot-b:' + t.accent2 + '"></button>'
            ).join('') +
          '</div>' +
        '</div>' +
        '<input type="file" accept="image/*" data-file hidden>',
      onMount: (node) => {
        const fileInput = node.querySelector('[data-file]');
        const applyAll = () => {
          LB.Theme.apply(ctx().profile, ctx().photo);
          LB.Studio && LB.Studio.refreshPreview && LB.Studio.refreshPreview();
        };

        node.querySelector('[data-upload]').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          fileInput.value = '';
          if (!file) return;
          toast('正在压缩这张照片…', { icon: '⏳', duration: 1400 });
          LB.Theme.compressImage(file).then((dataUrl) => {
            if (!LB.Store.savePhoto(dataUrl)) {
              toast('这张照片太大了，换一张小一点的好吗', { tone: 'warn', icon: '🥺' });
              return;
            }
            ctx().photo = dataUrl;
            ctx().profile.theme.usePhoto = true;
            LB.Store.saveProfile(ctx().profile);
            LB.App.markSaved();
            applyAll();
            const preview = node.querySelector('[data-preview]');
            preview.innerHTML = '<img src="' + dataUrl + '" alt="你们的合照">';
            if (!node.querySelector('[data-remove]')) {
              const btn = document.createElement('button');
              btn.className = 'btn btn-ghost';
              btn.dataset.remove = '1';
              btn.textContent = '移除';
              node.querySelector('.row-btns').appendChild(btn);
              bindRemove();
            }
            toast('合照已经是你们的背景了 💕', { icon: '✨' });
          }).catch((err) => {
            toast(err.message || '照片处理失败', { tone: 'warn' });
          });
        });

        function bindRemove() {
          const btn = node.querySelector('[data-remove]');
          if (!btn || btn.dataset.bound === '1') return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => {
            ctx().profile.theme.usePhoto = false;
            LB.Store.savePhoto('');
            LB.Store.saveProfile(ctx().profile);
            ctx().photo = '';
            applyAll();
            tbRefresh();
            toast('已换回主题渐变', { icon: '🎨' });
          });
        }
        function tbRefresh() {
          const preview = node.querySelector('[data-preview]');
          if (preview) {
            preview.innerHTML = '<div class="bg-preview-empty"><span>🖼️</span><p>还没有合照<br>选一张喜欢的当背景吧</p></div>';
          }
          const removeBtn = node.querySelector('[data-remove]');
          if (removeBtn) removeBtn.remove();
        }
        bindRemove();

        node.querySelector('[data-blur]').addEventListener('input', (e) => {
          ctx().profile.theme.blur = Number(e.target.value);
          node.querySelector('[data-blur-val]').textContent = e.target.value + 'px';
          applyAll();
          saveProfileSoon();
        });
        node.querySelector('[data-dim]').addEventListener('input', (e) => {
          ctx().profile.theme.dim = Number(e.target.value) / 100;
          node.querySelector('[data-dim-val]').textContent = e.target.value + '%';
          applyAll();
          saveProfileSoon();
        });
        node.querySelectorAll('[data-theme]').forEach((btn) => {
          btn.addEventListener('click', () => {
            ctx().profile.theme.id = btn.dataset.theme;
            node.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b === btn));
            applyAll();
            LB.Store.saveProfile(ctx().profile);
            LB.App.markSaved();
          });
        });
      }
    });
  }

  /* ---------------- 分享 ---------------- */
  function openShare() {
    sheet({
      title: '分享这张卡',
      body:
        '<div class="share-panel">' +
          '<p class="share-tip">把专属链接发给 TA：换一台手机打开，任务和配色都在，进度各自保留。</p>' +
          '<button class="share-action" data-share-link><span>🔗</span><div><b>发送专属链接</b><em>微信 / QQ / 短信都可以</em></div></button>' +
          '<button class="share-action" data-share-poster><span>🖼️</span><div><b>生成纪念海报</b><em>把刮开的进度做成一张图</em></div></button>' +
          '<button class="share-action" data-copy-link><span>📋</span><div><b>复制链接</b><em>粘贴到任意聊天窗口</em></div></button>' +
        '</div>' +
        '<p class="sheet-note">链接里只有任务、名字和配色，不含照片与进度。</p>',
      onMount: (node) => {
        const makeLink = () => LB.Codec.buildLink(ctx().profile);
        node.querySelector('[data-share-link]').addEventListener('click', () => {
          makeLink().then((link) => {
            const text = '💕 ' + ctx().profile.title + '，来刮开我们的心动小事';
            if (navigator.share) {
              navigator.share({ title: ctx().profile.title, text, url: link }).catch(() => {
                LB.UI.copyText(text + ' ' + link).then((ok) => toast(ok ? '链接已复制' : '复制失败，请手动复制'));
              });
            } else {
              LB.UI.copyText(text + ' ' + link).then((ok) => toast(ok ? '链接已复制，去粘贴给 TA 吧' : '复制失败，请手动复制'));
            }
          });
        });
        node.querySelector('[data-copy-link]').addEventListener('click', () => {
          makeLink().then((link) => LB.UI.copyText(link).then((ok) => toast(ok ? '链接已复制' : '复制失败，请手动复制')));
        });
        node.querySelector('[data-share-poster]').addEventListener('click', () => {
          closeSheet();
          setTimeout(() => LB.Poster.open(ctx()), 240);
        });
      }
    });
  }

  /* ==========================================================
     券包
     ========================================================== */
  function renderWallet(root) {
    const state = ctx().state;
    const s = ctx().game.stats();
    const awards = state.awards.slice().sort((a, b) => b.at - a.at);
    const redeemed = state.redeemed || [];

    const items = awards.map((a, i) => {
      const used = redeemed.indexOf(a.serial) !== -1;
      return '<div class="voucher' + (used ? ' redeemed' : '') + '" data-serial="' + esc(a.serial) + '">' +
        '<div class="voucher-emoji">' + esc(a.coupon.emoji) + '</div>' +
        '<div class="voucher-main">' +
          '<div class="voucher-title">' + esc(a.coupon.title) + '</div>' +
          '<div class="voucher-desc">' + esc(a.coupon.desc) + '</div>' +
          '<div class="voucher-meta">' + esc(a.lineLabel) + ' · ' + esc(LB.UI.formatDate(new Date(a.at).toISOString().slice(0, 10))) + ' · NO.' + esc(a.serial) + '</div>' +
        '</div>' +
        '<button class="voucher-use" data-use>' + (used ? '已兑现' : '标记兑现') + '</button>' +
        (used ? '<div class="voucher-stamp">已兑现</div>' : '') +
      '</div>';
    }).join('');

    root.innerHTML =
      '<div class="screen screen-wallet">' +
        '<div class="topbar">' +
          '<button class="icon-btn" data-back aria-label="返回">←</button>' +
          '<span class="chip chip-soft">券包</span>' +
          '<button class="icon-btn" data-poster aria-label="生成海报">🖼️</button>' +
        '</div>' +
        '<header class="wallet-head">' +
          '<h1 class="wallet-title">你们的奖励券</h1>' +
          '<p class="wallet-sub">每连成一条线，就会多一张兑现心意的小券</p>' +
        '</header>' +
        '<div class="stat-row">' +
          '<div class="stat"><b>' + s.revealed + '</b><span>已刮开</span></div>' +
          '<div class="stat"><b>' + s.lines + '</b><span>连线</span></div>' +
          '<div class="stat"><b>' + s.awards + '</b><span>收集</span></div>' +
          '<div class="stat"><b>' + s.redeemed + '</b><span>已兑现</span></div>' +
        '</div>' +
        (awards.length
          ? '<div class="voucher-list">' + items + '</div>'
          : '<div class="empty">' +
              '<div class="empty-icon">🎟️</div>' +
              '<p class="empty-title">券包还是空的</p>' +
              '<p class="empty-sub">回卡片上刮开一条线<br>第一张奖励券就在这里等你</p>' +
              '<button class="btn btn-primary" data-back>去刮卡</button>' +
            '</div>') +
        (awards.length ? '<p class="sheet-note center">兑现后点「标记兑现」，让心意有始有终。</p>' : '') +
      '</div>';

    root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => LB.App.go('/play')));
    const posterBtn = root.querySelector('[data-poster]');
    if (posterBtn) posterBtn.addEventListener('click', () => LB.Poster.open(ctx()));

    root.querySelectorAll('.voucher').forEach((node) => {
      const serial = node.dataset.serial;
      const btn = node.querySelector('[data-use]');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const used = ctx().state.redeemed.indexOf(serial) !== -1;
        ctx().game.redeem(serial, !used);
        haptic(10);
        renderWallet(root);
        if (!used) toast('已兑现，记得让对方知道 💌', { icon: '✅' });
      });
    });
  }

  LB.Player = { mount, renderGame, renderWallet, renderAlbum, openSettings, openBackground, openShare };
})(window.LB = window.LB || {});
