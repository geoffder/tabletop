"""Draw a GIPF-project title disc: dark bevel, silver ring, coloured face, embossed silver serif letter.

Usage: python3 -I disc.py LETTER FACE_HEX DIAMETER OUT.png
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'EBGaramond.ttf')
SS = 4  # supersampling


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255


def fbm(n, seed, octaves=5):
    rng = np.random.default_rng(seed)
    out = np.zeros((n, n))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        size = 4 * 2 ** o
        g = rng.random((size, size))
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        out += amp * np.asarray(img, float) / 255
        total += amp
        amp *= 0.55
    return out / total


def disc(letter, face_hex, diameter, seed=1):
    d = diameter * SS
    pad = int(d * 0.12)
    n = d + 2 * pad
    c = n / 2
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    dx, dy = (xx - c) / (d / 2), (yy - c) / (d / 2)
    r = np.hypot(dx, dy)
    ang = np.arctan2(dy, dx)
    # light from the top left
    light = np.cos(ang - np.deg2rad(-135))

    face = hex_rgb(face_hex)
    rgb = np.zeros((n, n, 3))
    alpha = np.zeros((n, n))

    # outer bevel: dark, lit a little on the top-left shoulder
    bevel = (r <= 1.0) & (r > 0.925)
    t = (r - 0.925) / 0.075
    shoulder = 0.10 + 0.22 * np.clip(light, 0, 1) * (1 - t) + 0.05 * (1 - t)
    rgb[bevel] = (face * 0.25 + 0.04)[None, :] * 0 + np.stack([shoulder] * 3, -1)[bevel] * (0.55 + 0.45 * face)[None, :]

    # silver ring
    ring = (r <= 0.925) & (r > 0.865)
    tr = (r - 0.865) / 0.06
    metal = 0.62 + 0.30 * light + 0.10 * np.sin(tr * np.pi)
    edge = np.minimum(tr, 1 - tr)
    metal = metal * np.clip(edge / 0.18, 0.35, 1.0)
    rgb[ring] = np.stack([metal] * 3, -1)[ring] * np.array([0.97, 0.98, 1.0])[None, :]

    # face: gradient, mottling and a recessed shadow under the ring
    inner = r <= 0.865
    tex = fbm(n, seed)
    grad = 1.0 - 0.28 * (dx + dy) / 2.0
    shade = grad * (0.82 + 0.36 * (tex - 0.5))
    recess = np.clip((r - 0.74) / 0.125, 0, 1) ** 2
    recess_dir = 0.55 + 0.45 * np.clip(-light, 0, 1) * 0 + 0.45 * np.clip(-np.cos(ang - np.deg2rad(45)), 0, 1)
    shade = shade * (1 - 0.45 * recess * (0.4 + 0.6 * np.clip(np.cos(ang - np.deg2rad(-135)), 0, 1)))
    spec = 0.20 * np.exp(-((dx + 0.35) ** 2 + (dy + 0.40) ** 2) / 0.12)
    face_rgb = np.clip(face[None, None, :] * shade[..., None] + spec[..., None] * (0.6 + 0.4 * face), 0, 1)
    rgb[inner] = face_rgb[inner]
    alpha[r <= 1.0] = 1.0
    # antialias the rim
    alpha = np.clip((1.0 - r) * d / 2 / SS + 0.5, 0, 1) * (r <= 1.02)

    img = Image.fromarray((np.dstack([np.clip(rgb, 0, 1), alpha]) * 255).astype(np.uint8), 'RGBA')

    # letter
    font = ImageFont.truetype(FONT, int(d * 0.84))
    try:
        font.set_variation_by_axes([430])
    except Exception:
        pass
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).text((c, c + d * 0.012), letter, font=font, fill=255, anchor='mm')
    bb = mask.getbbox()
    # centre the ink box exactly
    shift = (int(c - (bb[0] + bb[2]) / 2), int(c - (bb[1] + bb[3]) / 2))
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).text((c + shift[0], c + d * 0.012 + shift[1]), letter, font=font, fill=255, anchor='mm')
    m = np.asarray(mask, float) / 255

    def shifted(a, sx, sy):
        return np.roll(np.roll(a, sy, 0), sx, 1)

    # drop shadow and dark outline
    sh = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(d * 0.012))
    sh = shifted(np.asarray(sh, float) / 255, int(d * 0.022), int(d * 0.030))
    out = np.asarray(img, float) / 255
    base = out[..., :3]
    base = base * (1 - 0.75 * sh[..., None])
    outline = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * int(d * 0.006) + 1)), float) / 255
    base = base * (1 - 0.85 * outline[..., None])
    # silver fill with a soft emboss
    blur = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(d * 0.010)), float) / 255
    gy, gx = np.gradient(blur)
    emb = -(gx + gy) * d * 0.020
    vert = 1.0 - 0.22 * (yy - (c - d * 0.3)) / (d * 0.6)
    silver = np.clip(0.95 * vert + 0.30 * emb, 0.5, 1.0)
    letter_rgb = np.stack([silver * 0.985, silver * 0.99, silver], -1)
    if face.mean() > 0.6:  # pale face: dark engraved letter instead of silver
        dark = np.clip(0.20 + 0.10 * emb, 0.08, 0.4)
        letter_rgb = np.stack([dark, dark, dark * 1.05], -1)
    base = base * (1 - m[..., None]) + letter_rgb * m[..., None]
    out[..., :3] = base

    # cast shadow of the whole disc
    a = out[..., 3]
    cast = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(d * 0.035))
    cast = shifted(np.asarray(cast, float) / 255, int(d * 0.025), int(d * 0.04)) * 0.6
    final_a = a + cast * (1 - a)
    final_rgb = np.where(final_a[..., None] > 0, out[..., :3] * (a / np.maximum(final_a, 1e-6))[..., None], 0)
    res = Image.fromarray((np.dstack([final_rgb, final_a]) * 255).clip(0, 255).astype(np.uint8), 'RGBA')
    return res.resize((n // SS, n // SS), Image.LANCZOS)


if __name__ == '__main__':
    letter, face, dia, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    seed = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    disc(letter, face, dia, seed).save(out)
