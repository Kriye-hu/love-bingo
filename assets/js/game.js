/* ==========================================================
   恋爱刮刮 Bingo · 游戏核心逻辑
   5×5 格子（中心免费）· 12 条连线 · 每线一张券
   ========================================================== */
(function (LB) {
  'use strict';

  const CENTER = 12;

  const LINE_DEFS = (function () {
    const defs = [];
    for (let r = 0; r < 5; r++) {
      defs.push({ id: 'r' + r, type: 'row', index: r, label: '第 ' + (r + 1) + ' 行', cells: [0, 1, 2, 3, 4].map((c) => r * 5 + c) });
    }
    for (let c = 0; c < 5; c++) {
      defs.push({ id: 'c' + c, type: 'col', index: c, label: '第 ' + (c + 1) + ' 列', cells: [0, 1, 2, 3, 4].map((r) => r * 5 + c) });
    }
    defs.push({ id: 'd0', type: 'diag', index: 0, label: '主对角线', cells: [0, 6, 12, 18, 24] });
    defs.push({ id: 'd1', type: 'diag', index: 1, label: '副对角线', cells: [4, 8, 12, 16, 20] });
    return defs;
  })();

  const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;
  const EMOJI_ONE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

  function parseTask(raw) {
    const str = String(raw || '').trim();
    const matches = str.match(EMOJI_RE) || [];
    const icon = matches.length ? matches[matches.length - 1] : '💕';
    let text = str.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
    if (!text) text = '心动一下';
    return { icon, text };
  }

  function randomSerial(existing) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const used = existing || [];
    for (let attempt = 0; attempt < 30; attempt++) {
      let s = '520-';
      for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
      if (used.indexOf(s) === -1) return s;
    }
    return '520-' + Date.now().toString(36).toUpperCase().slice(-6);
  }

  function create(profile, state, hooks) {
    const listeners = hooks || {};
    const lineDefs = LINE_DEFS;

    function notify(name, payload) {
      if (typeof listeners[name] === 'function') listeners[name](payload);
    }

    function taskAt(pos) {
      if (pos === CENTER) return null;
      const idx = LB.Store.ORDER.indexOf(pos);
      return profile.tasks[idx] || '心动一下';
    }

    function isRevealed(pos) {
      return pos === CENTER || state.revealed.indexOf(pos) !== -1;
    }

    function board() {
      const b = [];
      for (let pos = 0; pos < 25; pos++) b.push(isRevealed(pos) ? 1 : 0);
      return b;
    }

    function completedLines() {
      return lineDefs.filter((line) => line.cells.every((pos) => pos === CENTER || state.revealed.indexOf(pos) !== -1));
    }

    function couponPool() {
      const list = profile.coupons && profile.coupons.length ? profile.coupons : LB.DATA.DEFAULT_COUPONS;
      const used = {};
      state.awards.forEach((a) => { if (a.coupon) used[a.coupon.title] = true; });
      const fresh = list.filter((c) => !used[c.title]);
      return fresh.length ? fresh : list;
    }

    function grantFor(line) {
      const pool = couponPool();
      const coupon = pool[Math.floor(Math.random() * pool.length)];
      const award = {
        serial: randomSerial(state.awards.map((a) => a.serial)),
        line: line.id,
        lineLabel: line.label,
        coupon: { emoji: coupon.emoji, title: coupon.title, desc: coupon.desc },
        at: Date.now()
      };
      state.awards.push(award);
      state.lines.push(line.id);
      return award;
    }

    function save() {
      LB.Store.saveState(state);
    }

    function stats() {
      return {
        revealed: state.revealed.length,
        total: 24,
        percent: Math.round((state.revealed.length / 24) * 100),
        lines: completedLines().length,
        awards: state.awards.length,
        redeemed: state.redeemed.length,
        done: state.revealed.length >= 24
      };
    }

    function reveal(pos) {
      const result = { ok: false, pos: pos, newAwards: [], allDone: false, task: null };
      if (pos === CENTER || pos < 0 || pos > 24) return result;
      if (state.revealed.indexOf(pos) !== -1) return result;

      if (!state.startedAt) state.startedAt = Date.now();
      state.revealed.push(pos);
      result.ok = true;
      result.task = taskAt(pos);

      const done = completedLines();
      const pending = done.filter((line) => state.lines.indexOf(line.id) === -1);
      pending.forEach((line) => { result.newAwards.push(grantFor(line)); });

      if (state.revealed.length >= 24 && !state.done) {
        state.done = true;
        result.allDone = true;
      }
      save();
      notify('onReveal', result);
      if (result.newAwards.length) notify('onAwards', result.newAwards);
      if (result.allDone) notify('onAllDone', stats());
      return result;
    }

    function redeem(serial, flag) {
      const has = state.redeemed.indexOf(serial) !== -1;
      if (flag && !has) state.redeemed.push(serial);
      if (!flag && has) state.redeemed.splice(state.redeemed.indexOf(serial), 1);
      save();
    }

    function resetProgress() {
      state.revealed = [];
      state.lines = [];
      state.awards = [];
      state.redeemed = [];
      state.done = false;
      state.startedAt = Date.now();
      save();
    }

    return {
      profile, state, lineDefs, CENTER,
      taskAt, isRevealed, board, completedLines, stats,
      reveal, redeem, resetProgress, save,
      parseTask
    };
  }

  LB.Game = { create, LINE_DEFS, CENTER, parseTask, randomSerial };
})(window.LB = window.LB || {});
