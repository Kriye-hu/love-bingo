# -*- coding: utf-8 -*-
"""把 docs/raw 里的原始截图压成 README 用的尺寸（480 宽 JPEG）"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "docs", "raw")
OUT = os.path.join(ROOT, "docs")
WIDTH = 480
QUALITY = 88

# 原始文件名 -> README 里的文件名
SELECT = {
    "01-home": "home",
    "02-role": "role",
    "03-play": "play",
    "04-scratched": "scratched",
    "05-bingo": "bingo",
    "06-line": "line",
    "07-wallet": "wallet",
    "08-poster": "poster",
    "09-studio-gate": "studio-gate",
    "10-studio": "studio-content",
    "11-studio-look": "studio-look",
    "12-studio-photo": "studio-photo",
    "13-studio-share": "studio-share",
    "14-studio-night": "studio-night",
    "15-night-play": "night-play",
    "16-photo-play": "photo-play",
    "17-studio-login": "studio-login",
    "18-import-pin": "import-pin",
    "19-import-role": "role-import",
    "20-small": "small",
    "detail-sheet": "detail",
    "desktop": "desktop",
    "21-memory": "memory",
    "22-album": "album",
}


def main():
    if not os.path.isdir(RAW):
        raise SystemExit("缺少 docs/raw，请先运行 node tools/shot.mjs")
    total = 0
    for src, name in SELECT.items():
        path = os.path.join(RAW, src + ".png")
        if not os.path.exists(path):
            print("skip", src)
            continue
        img = Image.open(path).convert("RGB")
        width = 720 if name == "desktop" else WIDTH
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)
        target = os.path.join(OUT, name + ".jpg")
        img.save(target, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        size = os.path.getsize(target)
        total += size
        print(f"{name}.jpg  {width}x{height}  {size / 1024:.0f} KB")
    print(f"共 {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
