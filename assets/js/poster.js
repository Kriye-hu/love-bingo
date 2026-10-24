/* ==========================================================
   恋爱刮刮 Bingo · 纪念海报
   把当前进度画成一张 1080×1620 的分享图
   ========================================================== */
(function (LB) {
  'use strict';

  const { modal, closeModal, toast, esc } = LB.UI;

  const W = 1080;
  const H = 1620;
  const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth, startSize, weight) {
    let size = startSize;
    do {
      ctx.font = (weight || '700') + ' ' + size + 'px ' + FONT;
      if (ctx.measureText(text).width <= maxWidth) return size;
      size -= 4;
    } while (size > 22);
    return size;
  }

  function drawBackground(ctx, profile, photo) {
    const theme = LB.Theme.resolve(profile);
    if (photo && profile.theme.usePhoto) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.max(W / img.width, H / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.save();
          try { ctx.filter = 'blur(14px) saturate(1.05)'; } catch (e) { /* ignore */ }
          ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
          ctx.restore();
          const grad = ctx.createLinearGradient(0, 0, 0, H);
          grad.addColorStop(0, 'rgba(255,255,255,0.62)');
          grad.addColorStop(1, 'rgba(255,255,255,0.8)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
          resolve(theme);
        };
        img.onerror = () => {
          ctx.fillStyle = theme.bg[0];
          ctx.fillRect(0, 0, W, H);
          resolve(theme);
        };
        img.src = photo;
      });
    }
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(0.45, theme.bg[1]);
    grad.addColorStop(1, theme.bg[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    return Promise.resolve(theme);
  }

  function build(profile, state, photo) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('画布不可用')); return; }

      drawBackground(ctx, profile, photo).then((theme) => {
        const accent = theme.accent;
        const accent2 = theme.accent2;
        const ink = theme.ink;
        const dark = !!theme.dark;

        /* 底纹：斜向小圆点 */
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = accent;
        for (let y = 0; y < H; y += 44) {
          for (let x = (y / 44 % 2) * 22; x < W; x += 44) {
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        /* 主面板 */
        const pad = 72;
        ctx.save();
        ctx.shadowColor = 'rgba(120,60,90,0.18)';
        ctx.shadowBlur = 48;
        ctx.shadowOffsetY = 18;
        ctx.fillStyle = dark ? 'rgba(40,30,62,0.9)' : 'rgba(255,255,255,0.9)';
        roundRect(ctx, pad, 96, W - pad * 2, H - 192, 56);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        roundRect(ctx, pad, 96, W - pad * 2, H - 192, 56);
        ctx.stroke();
        ctx.restore();

        const cx = W / 2;
        let y = 208;

        /* 顶部小标签 */
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.font = '700 24px ' + FONT;
        ctx.globalAlpha = 0.75;
        ctx.fillText('5 2 0   L O V E   B I N G O', cx, y);
        ctx.restore();

        /* 标题 */
        y += 92;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = ink;
        const size = fitText(ctx, profile.title, W - pad * 2 - 120, 76, '800');
        ctx.font = '800 ' + size + 'px ' + FONT;
        ctx.fillText(profile.title, cx, y);
        ctx.restore();

        /* 名字 */
        y += 66;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.82)' : 'rgba(90,62,78,0.78)';
        ctx.font = '500 34px ' + FONT;
        const names = profile.couple.a + '  ♥  ' + profile.couple.b;
        ctx.fillText(names, cx, y);
        ctx.restore();

        /* 纪念日 / 天数 */
        const days = LB.UI.daysSince(profile.since);
        if (days > 0) {
          y += 46;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = accent;
          ctx.font = '600 26px ' + FONT;
          ctx.globalAlpha = 0.85;
          ctx.fillText('一起走过 ' + days + ' 天', cx, y);
          ctx.restore();
        }

        /* 5×5 格子 */
        const cell = 148;
        const gap = 14;
        const total = cell * 5 + gap * 4;
        const gx = (W - total) / 2;
        const gy = y + 62;
        const revealed = state.revealed || [];
        const center = LB.Store.CENTER;

        for (let pos = 0; pos < 25; pos++) {
          const r = Math.floor(pos / 5);
          const c = pos % 5;
          const x = gx + c * (cell + gap);
          const yy = gy + r * (cell + gap);
          const isCenter = pos === center;
          const isOpen = isCenter || revealed.indexOf(pos) !== -1;

          ctx.save();
          roundRect(ctx, x, yy, cell, cell, 30);
          if (isCenter) {
            const g = ctx.createLinearGradient(x, yy, x + cell, yy + cell);
            g.addColorStop(0, accent);
            g.addColorStop(1, accent2);
            ctx.fillStyle = g;
            ctx.fill();
          } else if (isOpen) {
            ctx.fillStyle = LB.Theme.rgba(accent, dark ? 0.22 : 0.13);
            ctx.fill();
            ctx.strokeStyle = LB.Theme.rgba(accent, 0.32);
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            ctx.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(120,90,110,0.06)';
            ctx.fill();
            ctx.setLineDash([7, 7]);
            ctx.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(160,120,140,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (isCenter) {
            ctx.font = '64px ' + FONT;
            ctx.fillText('💝', x + cell / 2, yy + cell / 2);
          } else if (isOpen) {
            const parsed = LB.Game.parseTask(profile.tasks[LB.Store.ORDER.indexOf(pos)]);
            ctx.font = '56px ' + FONT;
            ctx.fillText(parsed.icon, x + cell / 2, yy + cell / 2);
          } else {
            const idx = LB.Store.ORDER.indexOf(pos);
            ctx.font = '600 28px ' + FONT;
            ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(160,120,140,0.65)';
            ctx.fillText(String(idx + 1).padStart(2, '0'), x + cell / 2, yy + cell / 2);
          }
          ctx.restore();
        }

        /* 连线高亮 */
        const board = {};
        for (let pos = 0; pos < 25; pos++) board[pos] = pos === center || revealed.indexOf(pos) !== -1;
        LB.Game.LINE_DEFS.forEach((line) => {
          const doneLine = line.cells.every((pos) => board[pos]);
          if (!doneLine) return;
          const first = line.cells[0];
          const last = line.cells[4];
          const p1 = { x: gx + (first % 5) * (cell + gap) + cell / 2, y: gy + Math.floor(first / 5) * (cell + gap) + cell / 2 };
          const p2 = { x: gx + (last % 5) * (cell + gap) + cell / 2, y: gy + Math.floor(last / 5) * (cell + gap) + cell / 2 };
          ctx.save();
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.restore();
        });

        /* 统计 */
        const statsY = gy + total + 92;
        const lines = (state.lines || []).length;
        const awards = (state.awards || []).length;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.72)' : 'rgba(90,62,78,0.72)';
        ctx.font = '500 30px ' + FONT;
        ctx.fillText('已刮开 ' + revealed.length + ' / 24    ·    连线 ' + lines + '    ·    奖励券 ' + awards, cx, statsY);
        ctx.restore();

        /* 一句话 */
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.font = '600 28px ' + FONT;
        ctx.fillText('一起刮开的小事，都算数', cx, statsY + 62);
        ctx.restore();

        /* 页脚 */
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.3)' : 'rgba(120,90,110,0.42)';
        ctx.font = '500 22px ' + FONT;
        ctx.fillText('LOVE BINGO · ' + (LB.REPO || 'github.com/Kriye-hu/love-bingo'), cx, H - 128);
        ctx.restore();

        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    });
  }

  function download(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function dataUrlToFile(dataUrl, filename) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  function open(context) {
    const ctxData = context || LB.App.ctx;
    toast('正在生成海报…', { icon: '🎨', duration: 1200 });
    build(ctxData.profile, ctxData.state, ctxData.photo).then((dataUrl) => {
      const filename = 'love-bingo-' + new Date().toISOString().slice(0, 10) + '.png';
      modal({
        ribbon: '',
        title: '纪念海报',
        subtitle: '长按图片也可以直接保存',
        className: 'modal-poster',
        body: '<div class="poster-wrap"><img class="poster-img" src="' + dataUrl + '" alt="恋爱 Bingo 纪念海报"></div>',
        actions:
          '<button class="btn btn-ghost" data-save>保存图片</button>' +
          '<button class="btn btn-primary" data-share>分享出去</button>',
        onMount: (node) => {
          node.querySelector('[data-save]').addEventListener('click', () => {
            download(dataUrl, filename);
            toast('已保存到相册/下载目录', { icon: '✅' });
          });
          node.querySelector('[data-share]').addEventListener('click', () => {
            const file = dataUrlToFile(dataUrl, filename);
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({
                files: [file],
                title: ctxData.profile.title,
                text: '我们的恋爱 Bingo 💕'
              }).catch(() => { /* 用户取消 */ });
            } else {
              download(dataUrl, filename);
              toast('当前浏览器不支持直接分享图片，已为你保存', { icon: '💾' });
            }
          });
        }
      });
    }).catch((err) => {
      toast('海报生成失败：' + (err && err.message ? err.message : '未知错误'), { tone: 'warn' });
    });
  }

  LB.Poster = { build, open };
})(window.LB = window.LB || {});
