"""Cut the GIPF project logo out of its white background (assets/gipf-project-logo-source.jpg).

The four discs are kept whole, white letters and rings included; everything else is ink whose
opacity is its darkness, so "project" keeps its anti-aliased edges and can be recoloured.

Usage: python3 -I cut_logo.py OUT_DISCS.png OUT_INK.png
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, 'assets', 'gipf-project-logo-source.jpg')


def components(mask):
    """Bounding boxes and sizes of the 4-connected regions of a boolean mask."""
    seen = np.zeros_like(mask)
    h, w = mask.shape
    found = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        ys, xs = [], []
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        found.append((min(ys), max(ys), min(xs), max(xs), len(ys)))
    return found


def cut():
    rgb = np.asarray(Image.open(SOURCE).convert('RGB')).astype(np.float64)
    h, w, _ = rgb.shape
    lum = rgb.mean(axis=2)
    # Discs: the large round regions of ink, each bounded by its dark outer ring.
    regions = components(lum < 160)
    round_ = [r for r in regions if r[4] > 2000 and abs((r[1] - r[0]) - (r[3] - r[2])) < 12]
    # A thin white ring parts each disc's dark rim from its blue middle; keep the rims.
    discs = sorted(
        (
            r
            for r in round_
            if not any(o is not r and o[0] <= r[0] and o[1] >= r[1] and o[2] <= r[2] and o[3] >= r[3] for o in round_)
        ),
        key=lambda r: r[2],
    )
    assert len(discs) == 4, f'found {len(discs)} discs'
    yy, xx = np.mgrid[0:h, 0:w]
    disc_alpha = np.zeros((h, w))
    near_disc = np.zeros((h, w), dtype=bool)
    for top, bottom, left, right, _ in discs:
        cy, cx = (top + bottom) / 2, (left + right) / 2
        radius = ((bottom - top) + (right - left)) / 4 + 0.5
        distance = np.hypot(yy - cy, xx - cx)
        disc_alpha = np.maximum(disc_alpha, np.clip(radius - distance + 0.5, 0, 1))
        # The source's soft grey halo round each disc is not ink.
        near_disc |= distance < radius + 5
    # Ink: opacity from darkness against the white page, as black.
    ink_alpha = np.clip((245 - lum) / (245 - 20), 0, 1)
    discs_out = np.zeros((h, w, 4))
    discs_out[..., :3] = rgb
    # Where a disc's edge fades out, its colour is the dark rim's, not the page's white.
    edge = (disc_alpha > 0) & (disc_alpha < 1)
    discs_out[edge, :3] = np.minimum(rgb[edge], 40)
    discs_out[..., 3] = disc_alpha * 255
    ink_out = np.zeros((h, w, 4))
    ink_out[..., 3] = np.where(near_disc, 0, ink_alpha) * 255
    layers = [Image.fromarray(a.round().astype(np.uint8), 'RGBA') for a in (discs_out, ink_out)]
    # Both layers cropped to the same box, so they stack.
    box = Image.alpha_composite(*layers).getbbox()
    return [layer.crop(box) for layer in layers]


if __name__ == '__main__':
    discs, ink = cut()
    discs.save(sys.argv[1])
    ink.save(sys.argv[2])
