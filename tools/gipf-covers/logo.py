"""Build the Don & Co era "GIPF project" logo: four blue discs, white "project" script, blue swoosh.

Usage: python3 -I logo.py OUT.png DISC_DIAMETER
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from disc import disc  # noqa: E402

WORD = os.path.join(HERE, 'assets', 'project-word.png')


def shadow_of(im, blur, alpha):
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * alpha))
    s = Image.new('RGBA', im.size, (0, 0, 0, 255))
    s.putalpha(a)
    return s


def logo(D):
    W, H = int(D * 4.6), int(D * 2.0)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # swoosh: a tapered, slightly curved blue stroke under the word
    S = 4
    sw = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(sw)
    pts_top, pts_bot = [], []
    x0, x1 = 0.0 * D, 4.0 * D
    for i in range(61):
        t = i / 60
        x = x0 + (x1 - x0) * t
        y = 1.50 * D - 0.08 * D * np.sin(np.pi * t * 0.9) + 0.04 * D * t
        thick = 0.09 * D * np.sin(np.pi * min(1, t * 1.05)) ** 0.6
        pts_top.append((x * S, (y - thick / 2) * S))
        pts_bot.append((x * S, (y + thick / 2) * S))
    d.polygon(pts_top + pts_bot[::-1], fill=(62, 112, 184, 255))
    d.line(pts_top, fill=(150, 190, 235, 255), width=max(1, int(0.012 * D * S)))
    sw = sw.resize((W, H), Image.LANCZOS)
    out.alpha_composite(shadow_of(sw, D * 0.03, 0.6), (int(D * 0.03), int(D * 0.05)))
    out.alpha_composite(sw)

    # discs
    step = D * 0.97
    for i, letter in enumerate('GIPF'):
        dimg = disc(letter, '#3d6db3', D, seed=40 + i)
        pad = (dimg.width - D) / 2
        out.alpha_composite(dimg, (int(D * 0.05 + i * step - pad), int(D * 0.08 - pad)))

    # "project" script, white with a dark shadow, over the lower half of I, P and F
    word = Image.open(WORD).convert('RGBA')
    ww = int(D * 3.0)
    word = word.resize((ww, int(word.height * ww / word.width)), Image.LANCZOS)
    pos = (int(D * 1.10), int(D * 0.70))
    sh = shadow_of(word, D * 0.025, 0.85)
    out.alpha_composite(sh, (pos[0] + int(D * 0.03), pos[1] + int(D * 0.045)))
    out.alpha_composite(word, pos)
    return out


if __name__ == '__main__':
    logo(int(sys.argv[2])).save(sys.argv[1])
