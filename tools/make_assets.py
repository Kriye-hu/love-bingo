# -*- coding: utf-8 -*-
"""生成恋爱刮刮 Bingo 的图标与社交分享图（纯本地，无第三方素材）"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "assets", "icons")
ASSET_DIR = os.path.join(ROOT, "assets")
os.makedirs(ICON_DIR, exist_ok=True)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
]


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def gradient(w, h, stops, angle=135):
    """stops: [(pos, (r,g,b)), ...]"""
    xs = np.linspace(0, 1, w)[None, :]
    ys = np.linspace(0, 1, h)[:, None]
    rad = math.radians(angle)
    t = xs * math.cos(rad) + ys * math.sin(rad)
    t = (t - t.min()) / (t.max() - t.min() + 1e-9)
    arr = np.zeros((h, w, 3), dtype=np.float32)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        mask = (t >= p0) & (t <= p1)
        local = (t - p0) / max(p1 - p0, 1e-9)
        for ch in range(3):
            arr[..., ch] = np.where(mask, c0[ch] + (c1[ch] - c0[ch]) * local, arr[..., ch])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def heart_points(cx, cy, size, n=160):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 17.0, cy - y * size / 17.0))
    return pts


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def soft_blob(size, center, radius, color):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(
        [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
        fill=color,
    )
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))


def make_icon(size, maskable=False, rounded=True):
    bg = gradient(size, size, [(0.0, (255, 176, 205)), (0.5, (232, 80, 126)), (1.0, (246, 161, 95))], angle=130).convert("RGBA")
    bg.alpha_composite(soft_blob(size, (size * 0.22, size * 0.16), size * 0.42, (255, 255, 255, 60)))
    bg.alpha_composite(soft_blob(size, (size * 0.85, size * 0.9), size * 0.38, (255, 214, 160, 70)))

    draw = ImageDraw.Draw(bg)
    scale = 0.62 if maskable else 0.72
    heart_size = size * scale * 0.62

    # 白色心形 + 柔和投影
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon(heart_points(size / 2, size * 0.52, heart_size), fill=(120, 30, 60, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.022))
    bg.alpha_composite(shadow)
    draw = ImageDraw.Draw(bg)
    draw.polygon(heart_points(size / 2, size * 0.51, heart_size), fill=(255, 255, 255, 255))

    # 小心跳（右上角）
    small = size * 0.085
    draw.polygon(heart_points(size * 0.755, size * 0.27, small), fill=(255, 236, 244, 235))

    if rounded and not maskable:
        bg.putalpha(rounded_mask(size, int(size * 0.22)))
    return bg


def make_og():
    w, h = 1200, 630
    img = gradient(w, h, [(0.0, (255, 238, 248)), (0.45, (255, 246, 234)), (1.0, (255, 224, 204))], angle=120).convert("RGBA")
    img.alpha_composite(soft_blob(w, (90, 60), 330, (255, 184, 208, 150)))
    img.alpha_composite(soft_blob(w, (1120, 600), 300, (255, 205, 168, 160)))
    img.alpha_composite(soft_blob(w, (760, 120), 220, (232, 180, 216, 90)))

    draw = ImageDraw.Draw(img)

    # 左侧文案
    x = 88
    draw.rounded_rectangle([x, 96, x + 236, 140], radius=22, fill=(255, 255, 255, 190), outline=(232, 80, 126, 70), width=2)
    draw.text((x + 18, 106), "5 × 5 · 24 件小事", font=font(22), fill=(176, 122, 158, 255))

    draw.text((x, 176), "恋爱刮刮", font=font(86), fill=(90, 62, 78, 255))
    draw.text((x, 268), "Bingo", font=font(96), fill=(232, 80, 126, 255))

    draw.text((x, 402), "刮开今天的小任务，连成一线", font=font(30), fill=(140, 96, 120, 255))
    draw.text((x, 448), "换一张只属于你们的奖励券", font=font(30), fill=(140, 96, 120, 255))

    # 底部标签
    tags = ["🎨 专属定制", "🖼️ 合照背景", "📴 可离线安装"]
    tx = x
    # emoji 字体在 Pillow 下不可靠，改用纯文字标签
    tags = ["专属定制", "合照背景", "离线可装", "开源 MIT"]
    for label in tags:
        tw = draw.textlength(label, font=font(22))
        draw.rounded_rectangle([tx, 520, tx + tw + 34, 566], radius=999, fill=(255, 255, 255, 175), outline=(232, 80, 126, 55), width=2)
        draw.text((tx + 17, 531), label, font=font(22), fill=(160, 100, 130, 255))
        tx += tw + 46

    # 右侧卡片
    card_x, card_y, card_w = 690, 92, 430
    card_h = 486
    card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([0, 0, card_w - 1, card_h - 1], radius=40, fill=(255, 255, 255, 205), outline=(255, 255, 255, 230), width=2)

    # 卡头
    cd.text((30, 28), "我们的恋爱 Bingo", font=font(28), fill=(90, 62, 78, 255))
    cd.text((30, 68), "阿狸  ♥  桃子", font=font(20), fill=(176, 122, 158, 255))
    cd.text((card_w - 92, 30), "18/24", font=font(24), fill=(232, 80, 126, 255))

    # 5x5 网格
    grid = 5
    gap = 10
    cell = (card_w - 60 - gap * (grid - 1)) // grid
    gx, gy = 30, 112
    revealed = {0, 1, 4, 5, 7, 9, 10, 11, 12, 13, 16, 18, 19, 21, 22, 24}
    for r in range(grid):
        for c in range(grid):
            pos = r * grid + c
            cx0 = gx + c * (cell + gap)
            cy0 = gy + r * (cell + gap)
            if pos == 12:
                cd.rounded_rectangle([cx0, cy0, cx0 + cell, cy0 + cell], radius=18, fill=(232, 80, 126, 255))
                cd.polygon(heart_points(cx0 + cell / 2, cy0 + cell / 2 + 2, cell * 0.3), fill=(255, 255, 255, 255))
            elif pos in revealed:
                cd.rounded_rectangle([cx0, cy0, cx0 + cell, cy0 + cell], radius=18, fill=(232, 80, 126, 31), outline=(232, 80, 126, 60), width=2)
                cd.polygon(heart_points(cx0 + cell / 2, cy0 + cell / 2 + 2, cell * 0.2), fill=(232, 80, 126, 150))
            else:
                cd.rounded_rectangle([cx0, cy0, cx0 + cell, cy0 + cell], radius=18, outline=(180, 140, 160, 90), width=2, fill=(250, 244, 248, 180))
    img.alpha_composite(card, (card_x, card_y))

    # 页脚
    draw.text((x, h - 52), "github.com/Kriye-hu/love-bingo", font=font(20), fill=(190, 150, 170, 255))
    draw.text((w - 260, h - 52), "MIT License", font=font(20), fill=(190, 150, 170, 255))

    return img.convert("RGB")


FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffb0cd"/>
      <stop offset="0.5" stop-color="#e8507e"/>
      <stop offset="1" stop-color="#f6a15f"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <path d="M32 47c-9.4-6.9-14-11.6-14-17.2a6.9 6.9 0 0 1 12.4-4.1L32 27l1.6-1.3A6.9 6.9 0 0 1 46 29.8c0 5.6-4.6 10.3-14 17.2z" fill="#fff"/>
</svg>
"""


def main():
    make_icon(512, maskable=False).save(os.path.join(ICON_DIR, "icon-512.png"))
    make_icon(192, maskable=False).save(os.path.join(ICON_DIR, "icon-192.png"))
    make_icon(512, maskable=True).save(os.path.join(ICON_DIR, "icon-maskable-512.png"))
    make_icon(180, maskable=True).save(os.path.join(ICON_DIR, "apple-touch-icon.png"))
    make_icon(32, maskable=False).save(os.path.join(ICON_DIR, "favicon-32.png"))
    with open(os.path.join(ICON_DIR, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(FAVICON)
    make_og().save(os.path.join(ASSET_DIR, "og-image.png"), optimize=True)
    print("assets written")


if __name__ == "__main__":
    main()
