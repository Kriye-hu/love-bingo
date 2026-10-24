/* ==========================================================
   恋爱刮刮 Bingo · 主题 / 背景
   主题预设 · 强调色 · 合照背景（模糊、压暗）· 底纹
   ========================================================== */
(function (LB) {
  'use strict';

  const PATTERN_SVG = {
    hearts: function (color) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
        '<path d="M28 36c-8-6-12-10-12-15a6 6 0 0111-3 6 6 0 0111 3c0 5-4 9-12 15z" fill="' + color + '" opacity="0.5"/>' +
        '</svg>';
    },
    stars: function (color) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        '<path d="M32 14l3 12 12 3-12 3-3 12-3-12-12-3 12-3z" fill="' + color + '" opacity="0.55"/>' +
        '<circle cx="14" cy="48" r="1.6" fill="' + color + '" opacity="0.5"/>' +
        '<circle cx="50" cy="42" r="1.2" fill="' + color + '" opacity="0.45"/>' +
        '</svg>';
    },
    petals: function (color) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">' +
        '<ellipse cx="30" cy="30" rx="7" ry="12" fill="' + color + '" opacity="0.4" transform="rotate(25 30 30)"/>' +
        '<ellipse cx="30" cy="30" rx="7" ry="12" fill="' + color + '" opacity="0.3" transform="rotate(-55 30 30)"/>' +
        '</svg>';
    },
    leaves: function (color) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
        '<path d="M18 38c0-12 8-20 20-20 0 12-8 20-20 20z" fill="' + color + '" opacity="0.4"/>' +
        '<path d="M18 38c6-8 12-12 20-16" stroke="' + color + '" stroke-width="1" opacity="0.35" fill="none"/>' +
        '</svg>';
    }
  };

  function hexToRgb(hex) {
    let v = String(hex || '').replace('#', '');
    if (v.length === 3) v = v.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(v)) return { r: 232, g: 80, b: 126 };
    return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  function themeById(id) {
    return LB.DATA.THEMES.filter((t) => t.id === id)[0] || LB.DATA.THEMES[0];
  }

  function resolve(profile) {
    const base = themeById(profile.theme.id);
    return Object.assign({}, base, {
      accent: profile.theme.accent || base.accent,
      accent2: profile.theme.accent2 || base.accent2,
      pattern: profile.theme.pattern || base.pattern
    });
  }

  function apply(profile, photoUrl) {
    const theme = resolve(profile);
    const root = document.documentElement;
    const body = document.body;
    const hasPhoto = !!(photoUrl && profile.theme.usePhoto);

    root.dataset.theme = theme.dark ? 'dark' : 'light';
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-2', theme.accent2);
    root.style.setProperty('--accent-soft', rgba(theme.accent, 0.12));
    root.style.setProperty('--accent-line', rgba(theme.accent, 0.28));
    root.style.setProperty('--accent-glow', rgba(theme.accent, 0.35));
    root.style.setProperty('--ink', theme.ink);
    root.style.setProperty('--ink-soft', theme.soft);
    root.style.setProperty('--ink-faint', theme.faint);
    root.style.setProperty('--card', theme.card);
    root.style.setProperty('--card-border', theme.border);
    root.style.setProperty('--bg-1', theme.bg[0]);
    root.style.setProperty('--bg-2', theme.bg[1]);
    root.style.setProperty('--bg-3', theme.bg[2]);
    root.style.setProperty('--bg-4', theme.bg[3]);
    const dim = Math.max(0, Math.min(0.95, profile.theme.dim));
    root.style.setProperty('--wash', rgba(theme.bg[0], dim));
    root.style.setProperty('--wash-strong', rgba(theme.bg[0], Math.min(0.94, dim + 0.18)));

    /* 深色/浅色主题下的卡片与输入框表面 */
    if (theme.dark) {
      root.style.setProperty('--cell-bg', 'linear-gradient(150deg,#3b2c58,#332549)');
      root.style.setProperty('--cell-bg-open', 'linear-gradient(150deg,rgba(72,54,104,.92),rgba(58,42,86,.86))');
      root.style.setProperty('--cell-border', 'rgba(255,255,255,0.1)');
      root.style.setProperty('--shadow', '0 18px 44px rgba(0,0,0,0.38)');
      root.style.setProperty('--input-bg', 'rgba(255,255,255,0.06)');
      root.style.setProperty('--input-border', 'rgba(255,255,255,0.14)');
      root.style.setProperty('--glass', 'rgba(46,35,70,0.72)');
      root.style.setProperty('--modal-bg', 'rgba(48,37,74,0.96)');
    } else {
      root.style.setProperty('--cell-bg', 'linear-gradient(150deg,#fffafd,#fff5ec)');
      root.style.setProperty('--cell-bg-open', 'linear-gradient(150deg,rgba(255,255,255,0.96),rgba(255,250,246,0.92))');
      root.style.setProperty('--cell-border', 'rgba(232,80,126,0.16)');
      root.style.setProperty('--shadow', '0 18px 44px rgba(180,100,140,0.16)');
      root.style.setProperty('--input-bg', 'rgba(255,255,255,0.72)');
      root.style.setProperty('--input-border', 'rgba(232,80,126,0.16)');
      root.style.setProperty('--glass', 'rgba(255,255,255,0.74)');
      root.style.setProperty('--modal-bg', 'rgba(255,253,252,0.96)');
    }

    body.classList.toggle('has-photo', hasPhoto);
    root.style.setProperty('--photo-blur', (profile.theme.blur || 0) + 'px');

    const photoLayer = document.getElementById('bgPhoto');
    if (photoLayer) {
      photoLayer.style.backgroundImage = hasPhoto ? 'url("' + photoUrl + '")' : 'none';
    }

    const patternLayer = document.getElementById('bgPattern');
    if (patternLayer) {
      const pattern = theme.pattern;
      if (pattern && pattern !== 'none' && PATTERN_SVG[pattern]) {
        const svg = PATTERN_SVG[pattern](theme.accent);
        patternLayer.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
      } else {
        patternLayer.style.backgroundImage = 'none';
      }
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.dark ? theme.bg[0] : theme.bg[0]);
    return theme;
  }

  /* 把用户选的合照压到合适尺寸，避免撑爆 localStorage */
  function compressImage(file, opts) {
    const options = Object.assign({ maxSize: 1400, quality: 0.82, minQuality: 0.55 }, opts);
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('请选择图片文件'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片解析失败'));
        img.onload = () => {
          const attempt = (maxSize, quality) => {
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            return canvas.toDataURL('image/jpeg', quality);
          };
          let maxSize = options.maxSize;
          let quality = options.quality;
          let dataUrl = attempt(maxSize, quality);
          /* 尝试压到 1.6MB 以内，localStorage 通常有 5MB */
          while (dataUrl.length > 1.6 * 1024 * 1024 && (maxSize > 700 || quality > options.minQuality)) {
            if (quality > options.minQuality) quality -= 0.1;
            else maxSize = Math.round(maxSize * 0.8);
            dataUrl = attempt(maxSize, quality);
          }
          resolve(dataUrl);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* 读取图片尺寸，用于告知用户照片会成为竖屏还是横屏背景 */
  function imageSize(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
  }

  LB.Theme = { apply, resolve, themeById, PATTERN_SVG, compressImage, imageSize, rgba, hexToRgb };
})(window.LB = window.LB || {});
