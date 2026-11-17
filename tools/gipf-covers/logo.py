"""The GIPF project logo for the bottom right of a cover, as the original boxes print it: the
discs and "project" that cut_logo.py cuts out of assets/gipf-project-logo-source.jpg, "project"
in white over a blue swoosh, all with a tight dark shadow.

Usage: python3 -I logo.py --stamp IN.jpg OUT.jpg
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
DISCS = os.path.join(HERE, 'assets', 'gipf-project-logo-discs.png')
INK = os.path.join(HERE, 'assets', 'gipf-project-logo-ink.png')
SWOOSH = (38, 76, 142, 255)
SWOOSH_EDGE = (120, 160, 215, 255)


# Laid out in the source's own pixels: the discs at the top left, as cut.
CANVAS = (548, 196)
# On the boxes "project" is a little larger than on the source and tucked up under the discs,
# its letters' tops overlapping their feet: scaled about the start of its baseline, then raised.
INK_SCALE = 1.06
INK_ANCHOR = (139, 155)
INK_RAISE = 22
RIM = np.array([18, 36, 72])


def swoosh(size):
    """The brush stroke under "project", as on the boxes: a fine point below the G that arcs up
    gently and thickens to a rounded end just past the F."""
    w, h = size
    S = 4
    layer = Image.new('RGBA', (w * S, h * S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    # A quadratic curve through the source's pixels: start, control, end.
    (x0, y0), (x1, y1), (x2, y2) = (16, 172), (260, 132), (468, 160)
    full = 19
    top, bottom, centre = [], [], []
    steps = 120
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t**2 * x2
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t**2 * y2
        dx = 2 * (1 - t) * (x1 - x0) + 2 * t * (x2 - x1)
        dy = 2 * (1 - t) * (y1 - y0) + 2 * t * (y2 - y1)
        length = (dx * dx + dy * dy) ** 0.5
        nx, ny = -dy / length, dx / length
        half = full / 2 * t**0.7
        top.append(((x - nx * half) * S, (y - ny * half) * S))
        bottom.append(((x + nx * half) * S, (y + ny * half) * S))
        centre.append((x, y))
    draw.polygon(top + bottom[::-1], fill=SWOOSH)
    ex, ey = centre[-1]
    r = full / 2
    draw.ellipse([(ex - r) * S, (ey - r) * S, (ex + r) * S, (ey + r) * S], fill=SWOOSH)
    # A lighter edge along its top, where the boxes catch the light.
    draw.line(top[steps // 6 :], fill=SWOOSH_EDGE, width=S, joint='curve')
    return layer.resize(size, Image.LANCZOS)


def navy_rims(discs):
    """The source's black rims in the boxes' dark navy."""
    rgba = np.asarray(discs).astype(np.float64)
    lum = rgba[..., :3].mean(axis=2)
    t = np.clip((90 - lum) / 90, 0, 1)[..., None] * 0.85
    rgba[..., :3] += t * (RIM - rgba[..., :3])
    return Image.fromarray(rgba.round().astype(np.uint8), 'RGBA')


def logo(width):
    canvas = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(navy_rims(Image.open(DISCS).convert('RGBA')))
    canvas.alpha_composite(swoosh(CANVAS))
    source = Image.open(INK).getchannel('A')
    scaled = source.resize(
        (round(source.width * INK_SCALE), round(source.height * INK_SCALE)), Image.LANCZOS
    )
    ax, ay = INK_ANCHOR
    alpha = Image.new('L', CANVAS, 0)
    alpha.paste(scaled, (round(ax - ax * INK_SCALE), round(ay - ay * INK_SCALE) - INK_RAISE))
    lettering = Image.new('RGBA', CANVAS, (255, 255, 255, 255))
    lettering.putalpha(alpha)
    canvas.alpha_composite(lettering)
    size = (width, round(CANVAS[1] * width / CANVAS[0]))
    whole = canvas.resize(size, Image.LANCZOS)
    # A tight dark shadow down and to the right, as the original boxes give the logo over their art.
    pad = round(width * 0.04)
    out = Image.new('RGBA', (size[0] + 2 * pad, size[1] + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new('RGBA', size, (0, 0, 0, 255))
    shadow.putalpha(whole.getchannel('A').point(lambda v: int(v * 0.85)))
    blurred = Image.new('RGBA', out.size, (0, 0, 0, 0))
    offset = max(1, round(width * 0.009))
    blurred.alpha_composite(shadow, (pad + offset, pad + offset))
    out.alpha_composite(blurred.filter(ImageFilter.GaussianBlur(width * 0.005)))
    out.alpha_composite(whole, (pad, pad))
    return out.crop(out.getbbox())


def stamp(img):
    """Adds the logo to the bottom right of an RGBA cover, placed and sized as on the original boxes."""
    W, H = img.size
    lg = logo(round(W * 0.18))
    img.alpha_composite(lg, (round(W * 0.97 - lg.width), round(H * 0.975 - lg.height)))


if __name__ == '__main__':
    assert sys.argv[1] == '--stamp', __doc__
    img = Image.open(sys.argv[2]).convert('RGBA')
    stamp(img)
    img.convert('RGB').save(sys.argv[3], quality=92)
