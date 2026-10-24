/* ==========================================================
   恋爱刮刮 Bingo · 本地存储层
   - 所有数据只存在这台设备（localStorage），不上传任何服务器
   - 支持 v1 存档迁移
   ========================================================== */
(function (LB) {
  'use strict';

  const KEY = {
    profile: 'lb.profile.v2',
    state: 'lb.state.v2',
    photo: 'lb.photo.v1',
    auth: 'lb.auth.v1',
    meta: 'lb.meta.v1',
    legacy: 'love-bingo-state'
  };

  /* 25 格中 24 个任务格的位置（跳过正中间 12） */
  const ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  const CENTER = 12;

  const clone = (v) => JSON.parse(JSON.stringify(v));

  /* 卡片实例 id：只在本机有意义，照片按它归档；不会写进分享链接 */
  function randomId(length) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const buf = new Uint8Array(length || 10);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    let out = '';
    for (let i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
    return out;
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function defaultProfile() {
    return {
      v: 2,
      uid: randomId(10),
      couple: { a: '阿狸', b: '桃子' },
      title: '我们的恋爱 Bingo',
      subtitle: '刮一刮 · 心动一下',
      since: '',
      tasks: LB.DATA.DEFAULT_TASKS.slice(),
      center: '今日限定\n心动位',
      coupons: clone(LB.DATA.DEFAULT_COUPONS),
      theme: {
        id: 'peach',
        accent: '',
        accent2: '',
        pattern: '',
        usePhoto: true,
        blur: 6,
        dim: 0.32
      },
      access: { mode: 'open', pin: '' },
      createdAt: 0,
      updatedAt: 0
    };
  }

  function defaultState() {
    return {
      v: 2,
      revealed: [],
      lines: [],
      awards: [],
      redeemed: [],
      role: null,
      startedAt: 0,
      done: false
    };
  }

  function defaultMeta() {
    return { sound: true, haptics: true, scratch: 'finger', installSeen: false, hintSeen: false };
  }

  /* 把存档补齐成当前结构，避免旧数据缺字段导致崩 */
  function normalizeProfile(raw) {
    const base = defaultProfile();
    if (!raw || typeof raw !== 'object') return base;
    const p = Object.assign(base, raw);
    if (!p.uid || typeof p.uid !== 'string') p.uid = randomId(10);
    p.couple = Object.assign({ a: '阿狸', b: '桃子' }, raw.couple || {});
    p.theme = Object.assign(base.theme, raw.theme || {});
    p.access = Object.assign({ mode: 'open', pin: '' }, raw.access || {});
    p.tasks = Array.isArray(raw.tasks) && raw.tasks.length === 24
      ? raw.tasks.map((t) => String(t == null ? '' : t))
      : base.tasks;
    p.coupons = Array.isArray(raw.coupons) && raw.coupons.length
      ? raw.coupons.map((c) => ({ emoji: c.emoji || '🎁', title: c.title || '奖励券', desc: c.desc || '' }))
      : base.coupons;
    if (!p.title) p.title = base.title;
    if (!p.center) p.center = base.center;
    return p;
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const s = Object.assign(base, raw);
    s.revealed = Array.isArray(raw.revealed)
      ? raw.revealed.filter((n) => Number.isInteger(n) && n >= 0 && n < 25 && n !== CENTER)
      : [];
    s.lines = Array.isArray(raw.lines) ? raw.lines.slice() : [];
    s.awards = Array.isArray(raw.awards) ? raw.awards.slice() : [];
    s.redeemed = Array.isArray(raw.redeemed) ? raw.redeemed.slice() : [];
    return s;
  }

  /* ---------- v1 迁移：旧版只有一个 love-bingo-state ---------- */
  function migrateLegacy() {
    const saved = safeGet(KEY.legacy);
    if (!saved) return false;
    let old;
    try { old = JSON.parse(saved); } catch (e) { return false; }
    if (!old || !Array.isArray(old.cardData) || old.cardData.length !== 24) return false;

    const profile = defaultProfile();
    profile.tasks = old.cardData.map(String);
    const state = defaultState();
    (old.revealed || []).forEach((idx) => {
      if (ORDER[idx] != null) state.revealed.push(ORDER[idx]);
    });
    state.startedAt = Date.now();
    state.migratedFromV1 = true;

    safeSet(KEY.profile, JSON.stringify(profile));
    safeSet(KEY.state, JSON.stringify(state));
    safeRemove(KEY.legacy);
    return true;
  }

  function loadProfile() {
    const raw = safeGet(KEY.profile);
    if (!raw) return null;
    try { return normalizeProfile(JSON.parse(raw)); } catch (e) { return null; }
  }

  function saveProfile(profile) {
    profile.updatedAt = Date.now();
    return safeSet(KEY.profile, JSON.stringify(profile));
  }

  function loadState() {
    const raw = safeGet(KEY.state);
    if (!raw) return null;
    try { return normalizeState(JSON.parse(raw)); } catch (e) { return null; }
  }

  function saveState(state) {
    return safeSet(KEY.state, JSON.stringify(state));
  }

  function loadMeta() {
    const raw = safeGet(KEY.meta);
    let meta = defaultMeta();
    if (raw) {
      try { meta = Object.assign(meta, JSON.parse(raw)); } catch (e) { /* ignore */ }
    }
    return meta;
  }

  function saveMeta(meta) {
    return safeSet(KEY.meta, JSON.stringify(meta));
  }

  function loadPhoto() {
    return safeGet(KEY.photo) || '';
  }

  function savePhoto(dataUrl) {
    if (!dataUrl) { safeRemove(KEY.photo); return true; }
    if (safeSet(KEY.photo, dataUrl)) return true;
    return false;
  }

  function clearAll() {
    Object.keys(KEY).forEach((k) => safeRemove(KEY[k]));
    try { sessionStorage.removeItem('lb.unlocked'); } catch (e) { /* ignore */ }
  }

  /* ---------- 工作台口令 ---------- */
  function sha256Hex(text) {
    if (window.crypto && window.crypto.subtle && window.isSecureContext) {
      const bytes = new TextEncoder().encode(text);
      return window.crypto.subtle.digest('SHA-256', bytes).then((buf) => {
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      });
    }
    /* file:// 等非安全上下文的降级哈希：本地防误入足够 */
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = (h1 ^ c) * 0x01000193 >>> 0;
      h2 = (h2 + c * 31) >>> 0;
    }
    return Promise.resolve(('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8));
  }

  function randomSalt() {
    let s = '';
    const buf = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else for (let i = 0; i < 8; i++) buf[i] = Math.floor(Math.random() * 256);
    for (let i = 0; i < buf.length; i++) s += buf[i].toString(16).padStart(2, '0');
    return s;
  }

  function loadAuth() {
    const raw = safeGet(KEY.auth);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function setPin(pin) {
    const salt = randomSalt();
    return sha256Hex(salt + ':' + pin).then((hash) => {
      const auth = { salt, hash, at: Date.now() };
      safeSet(KEY.auth, JSON.stringify(auth));
      try { sessionStorage.setItem('lb.unlocked', '1'); } catch (e) { /* ignore */ }
      return true;
    });
  }

  function verifyPin(pin) {
    const auth = loadAuth();
    if (!auth) return Promise.resolve(true);
    return sha256Hex(auth.salt + ':' + pin).then((hash) => {
      const ok = hash === auth.hash;
      if (ok) {
        try { sessionStorage.setItem('lb.unlocked', '1'); } catch (e) { /* ignore */ }
      }
      return ok;
    });
  }

  function isUnlocked() {
    try { return sessionStorage.getItem('lb.unlocked') === '1'; } catch (e) { return false; }
  }

  function resetAuth() {
    safeRemove(KEY.auth);
    try { sessionStorage.removeItem('lb.unlocked'); } catch (e) { /* ignore */ }
  }

  /* ---------- 备份 ---------- */
  function exportJSON() {
    return JSON.stringify({
      app: 'love-bingo',
      v: 2,
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      state: loadState()
    }, null, 2);
  }

  function importJSON(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: '这不是有效的 JSON 文件' }; }
    if (!data || data.app !== 'love-bingo' || !data.profile) {
      return { ok: false, error: '文件格式不正确（缺少 love-bingo 标记）' };
    }
    const profile = normalizeProfile(data.profile);
    saveProfile(profile);
    if (data.state) saveState(normalizeState(data.state));
    return { ok: true, profile };
  }

  LB.Store = {
    KEY, ORDER, CENTER, randomId,
    defaultProfile, defaultState, defaultMeta, normalizeProfile, normalizeState,
    migrateLegacy,
    loadProfile, saveProfile, loadState, saveState,
    loadMeta, saveMeta, loadPhoto, savePhoto,
    loadAuth, setPin, verifyPin, isUnlocked, resetAuth,
    exportJSON, importJSON, clearAll
  };
})(window.LB = window.LB || {});
