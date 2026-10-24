/* ==========================================================
   恋爱刮刮 Bingo · 专属链接编解码
   纯前端、零依赖：压缩（可选 deflate-raw）+ base64url
   ========================================================== */
(function (LB) {
  'use strict';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function bytesToB64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function toBase64Url(bytes) {
    return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return b64ToBytes(s);
  }

  function supportsCompression() {
    return typeof window.CompressionStream === 'function' && typeof window.DecompressionStream === 'function';
  }

  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()
      .then((buf) => new Uint8Array(buf));
  }

  /* 分享链接只需要「内容与外观」，口令、照片、进度都不离开本机 */
  function toPack(p) {
    const th = p.theme || {};
    return {
      v: 2,
      n: [p.couple.a, p.couple.b],
      t: p.title,
      s: p.subtitle,
      d: p.since || '',
      k: p.tasks,
      c: p.center,
      u: p.coupons.map((c) => [c.emoji, c.title, c.desc]),
      th: [th.id, th.accent || '', th.accent2 || '', th.pattern || '', th.usePhoto ? 1 : 0, Math.round(th.blur), Math.round((th.dim || 0) * 100)],
      ac: p.access.mode === 'pin' ? ['p', p.access.pin] : ['o', '']
    };
  }

  function fromPack(pack) {
    if (!pack || pack.v !== 2) throw new Error('unsupported-version');
    const p = LB.Store.defaultProfile();
    p.couple = { a: pack.n[0] || '我', b: pack.n[1] || '你' };
    p.title = pack.t || p.title;
    p.subtitle = pack.s || '';
    p.since = pack.d || '';
    if (Array.isArray(pack.k) && pack.k.length === 24) p.tasks = pack.k.slice();
    p.center = pack.c || p.center;
    if (Array.isArray(pack.u) && pack.u.length) {
      p.coupons = pack.u.map((c) => ({ emoji: c[0] || '🎁', title: c[1] || '奖励券', desc: c[2] || '' }));
    }
    const th = pack.th || [];
    p.theme = {
      id: th[0] || 'peach',
      accent: th[1] || '',
      accent2: th[2] || '',
      pattern: th[3] || '',
      usePhoto: th[4] !== 0,
      blur: typeof th[5] === 'number' ? th[5] : 6,
      dim: typeof th[6] === 'number' ? th[6] / 100 : 0.3
    };
    p.access = pack.ac && pack.ac[0] === 'p'
      ? { mode: 'pin', pin: String(pack.ac[1] || '') }
      : { mode: 'open', pin: '' };
    return LB.Store.normalizeProfile(p);
  }

  function encode(profile) {
    const json = JSON.stringify(toPack(profile));
    const raw = enc.encode(json);
    const plain = () => 'j' + toBase64Url(raw);
    if (!supportsCompression()) return Promise.resolve(plain());
    return pipe(raw, new CompressionStream('deflate-raw'))
      .then((bytes) => 'z' + toBase64Url(bytes))
      .catch(plain);
  }

  function decode(code) {
    if (!code || typeof code !== 'string') return Promise.reject(new Error('empty'));
    const body = code.trim().replace(/\s+/g, '');
    const kind = body.charAt(0);
    const payload = body.slice(1);
    let bytes;
    try { bytes = fromBase64Url(payload); } catch (e) { return Promise.reject(new Error('bad-base64')); }

    const parse = (buf) => Promise.resolve().then(() => fromPack(JSON.parse(dec.decode(buf))));

    if (kind === 'z') {
      if (!supportsCompression()) return Promise.reject(new Error('no-decompression'));
      return pipe(bytes, new DecompressionStream('deflate-raw')).then(parse);
    }
    if (kind === 'j') return parse(bytes);
    return Promise.reject(new Error('bad-format'));
  }

  function buildLink(profile) {
    const base = location.href.split('#')[0];
    return encode(profile).then((code) => base + '#c=' + code);
  }

  LB.Codec = { encode, decode, buildLink, toPack, fromPack };
})(window.LB = window.LB || {});
