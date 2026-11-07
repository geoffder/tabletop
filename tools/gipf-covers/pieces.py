"""Scatter potential pieces over the GIPF with Potentials cover art, Set-box style, each with a soft
drop shadow.

Usage: python3 -I pieces.py BASE OUT < PLACEMENTS
PLACEMENTS: lines "file cx cy width" (files relative to the working directory; # comments).
"""
import sys

from PIL import Image, ImageFilter

base = Image.open(sys.argv[1]).convert('RGBA')
for line in sys.stdin:
    if not line.strip() or line.startswith('#'):
        continue
    f, cx, cy, w = line.split()
    cx, cy, w = int(cx), int(cy), int(w)
    p = Image.open(f).convert('RGBA')
    p = p.crop(p.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    h = round(p.height * w / p.width)
    p = p.resize((w, h), Image.LANCZOS)
    x, y = cx - w // 2, cy - h // 2
    pad = 60
    sh = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    a = Image.new('L', sh.size, 0)
    a.paste(p.getchannel('A'), (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.75))
    sh.putalpha(a)
    base.alpha_composite(sh, (x - pad + 12, y - pad + 20))
    base.alpha_composite(p, (x, y))
base.convert('RGB').save(sys.argv[2], quality=90)
