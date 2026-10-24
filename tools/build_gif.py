# -*- coding: utf-8 -*-
"""把 docs/raw/gif 的帧序列合成 README 顶部的演示 GIF（顺带产出 WebP）。"""
import json
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "raw", "gif")
OUT_GIF = os.path.join(ROOT, "docs", "demo.gif")
OUT_WEBP = os.path.join(ROOT, "docs", "demo.webp")

WIDTH = 320
COLORS = 160
CROP_BOTTOM = 0.055   # 去掉底部纯装饰区，GIF 更小
MAX_BYTES = 2.2 * 1024 * 1024


def draw_touch(img, x, y):
    """画一个手指触点：白色光晕 + 粉色中心，方便看清在刮哪里。"""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    r = 13
    d.ellipse([x - r - 3, y - r - 3, x + r + 3, y + r + 3], outline=(232, 80, 126, 110), width=2)
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 90), outline=(255, 255, 255, 220), width=3)
    d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(232, 80, 126, 220))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def load_frames(width):
    with open(os.path.join(SRC, "manifest.json"), encoding="utf-8") as fh:
        data = json.load(fh)
    manifest = data["frames"] if isinstance(data, dict) else data
    viewport_width = data.get("viewport", {}).get("width", 390) if isinstance(data, dict) else 390

    frames = []
    durations = []
    for item in manifest:
        img = Image.open(os.path.join(SRC, item["file"])).convert("RGB")
        # 截图是 2 倍图：先按像素缩放；触点坐标是 CSS 像素，用另一个比例
        img = img.crop((0, 0, img.width, round(img.height * (1 - CROP_BOTTOM))))
        pixel_scale = width / img.width
        img = img.resize((width, round(img.height * pixel_scale)), Image.LANCZOS)
        if item.get("x") is not None:
            css_scale = width / viewport_width
            img = draw_touch(img, item["x"] * css_scale, item["y"] * css_scale)
        frames.append(img)
        durations.append(max(40, int(item.get("delay", 90))))
    return frames, durations


def build(width=WIDTH, colors=COLORS, dither=Image.Dither.NONE):
    frames, durations = load_frames(width)

    # 用几张代表帧生成统一调色板，避免逐帧闪色
    probes = [frames[0], frames[len(frames) // 3], frames[len(frames) // 2], frames[-1]]
    probe = Image.new("RGB", (width * len(probes), frames[0].height))
    for i, f in enumerate(probes):
        probe.paste(f, (width * i, 0))
    palette = probe.quantize(colors=colors, method=Image.Quantize.MEDIANCUT)

    quantized = [f.quantize(palette=palette, dither=dither) for f in frames]
    quantized[0].save(
        OUT_GIF, save_all=True, append_images=quantized[1:],
        duration=durations, loop=0, optimize=True, disposal=2
    )

    frames[0].save(
        OUT_WEBP, save_all=True, append_images=frames[1:], duration=durations, loop=0,
        format="WEBP", quality=76, method=4
    )

    size = os.path.getsize(OUT_GIF)
    print(f"gif  {width}px / {colors} colors / {len(frames)} frames -> {size / 1024:.0f} KB, {frames[0].size[1]}px tall")
    print(f"webp -> {os.path.getsize(OUT_WEBP) / 1024:.0f} KB")
    print("total duration", sum(durations), "ms")
    return size


if __name__ == "__main__":
    size = build()
    while size > MAX_BYTES and COLORS > 96:
        COLORS -= 32
        size = build(colors=COLORS)
    if size > MAX_BYTES:
        size = build(width=280, colors=128)
    print("done", round(size / 1024), "KB")
