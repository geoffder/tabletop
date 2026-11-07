"""Compose a GIPF-project style cover: scene, board, frosted window, title discs, GIPF project logo.

Usage: python3 -I cover.py OUT.jpg SCENE.png BOARD.png DISC_COLOURS [board_scale] [board_cy]
DISC_COLOURS: one hex colour for all discs, or five comma-separated.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from disc import disc  # noqa: E402
from logo import logo  # noqa: E402

TITLE = 'LYNGK'


def shadow(im, blur, alpha):
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * alpha))
    s = Image.new('RGBA', im.size, (0, 0, 0, 255))
    s.putalpha(a)
    return s


def perspective(im, squeeze):
    """Narrow the top edge by `squeeze` (fraction of width) so the board recedes."""
    w, h = im.size
    dx = w * squeeze / 2
    # PIL maps output -> input; coefficients from four point pairs
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = [(dx, 0), (w - dx, 0), (w, h), (0, h)]
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    coeffs = np.linalg.solve(np.array(A, float), np.array(B, float))
    return im.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)


def compose(scene_path, board_path, colours, board_scale=0.52, board_cy=0.70, squeeze=0.22, window_light=0.22, flatten=0.82, reflect=0.22):
    img = Image.open(scene_path).convert('RGBA')
    W, H = img.size

    board = Image.open(board_path).convert('RGBA')
    bw = int(W * board_scale)
    board = board.resize((bw, int(board.height * bw / board.width * flatten)), Image.LANCZOS)
    board = perspective(board, squeeze)
    # tint the board toward the scene's light so it sits in the same weather
    sa = np.asarray(img.convert('RGB')).astype(np.float32) / 255
    mean = sa[int(H * 0.3):int(H * 0.9), int(W * 0.25):int(W * 0.75)].reshape(-1, 3).mean(0)
    tint = 0.80 + 0.28 * mean / mean.max()
    tint = tint * min(1.0, 0.38 + 1.0 * mean.mean() + float(__import__('os').environ.get('BOARD_LIFT', 0)))
    k = float(os.environ.get('BOARD_TINT', 1))
    tint = 1 + (tint - 1) * k
    ba = np.asarray(board).astype(np.float32)
    ba[..., :3] *= tint
    light = os.environ.get('BOARD_LIGHT')
    keep = None
    if light and os.environ.get('KEEP_BOLTS'):
        # the board's own LYNGK bolts give off light; keep them out of the lighting pass
        r_, g_, b_ = ba[..., 0], ba[..., 1], ba[..., 2]
        keep = ((b_ - r_ > 50) & (g_ - r_ > 30) & (g_ > 150) & (b_ > 180)).astype(np.float32)
        keep = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32)[..., None] / 255
        keep_px = ba[..., :3].copy()
    if light:
        # coloured key light that keeps contrast, brighter toward the back of the board
        lc = np.array([float(v) for v in light.split(',')], np.float32)
        hh = ba.shape[0]
        grad = (1.08 - 0.22 * np.arange(hh) / hh)[:, None, None]
        ba[..., :3] = ba[..., :3] * lc * grad
        sky = os.environ.get('SKY_FLASH')
        if sky:
            # light from the strikes in the sky: falls off with distance from each strike point
            pts, amt_s = sky.split('@')
            amt_s = float(amt_s)
            bh_, bw_ = ba.shape[:2]
            ox, oy = (W - bw_) / 2, H * board_cy - bh_ / 2
            gy_, gx_ = np.mgrid[0:bh_, 0:bw_].astype(np.float32)
            lm = np.zeros((bh_, bw_), np.float32)
            for pt in pts.split(';'):
                fx, fy = [float(v) for v in pt.split(',')]
                d = np.hypot(gx_ + ox - fx * W, (gy_ + oy - fy * H) * 1.6) / W
                lm += np.exp(-d / 0.30)
            lm = np.clip(lm, 0, 1.2) * amt_s
            ba[..., :3] = ba[..., :3] * (1 + lm[..., None] * np.array([0.80, 0.92, 1.05], np.float32))
        glow = os.environ.get('BOARD_GLOW')
        if glow:
            gr, gg, gb, amt = [float(v) for v in glow.split(',')]
            al = Image.fromarray(ba[..., 3].astype(np.uint8))
            inner = al.filter(ImageFilter.MinFilter(9))
            edge = np.asarray(al, np.float32) - np.asarray(inner, np.float32)
            edge = np.asarray(Image.fromarray(np.clip(edge, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
            # environment bounce: strongest at the back and on the rims
            back = float(os.environ.get('GLOW_BACK', 0.55))
            env = (back * (1 - np.arange(hh) / hh)[:, None] + edge) * amt
            ba[..., :3] += env[..., None] * np.array([gr, gg, gb], np.float32) * 255
    if keep is not None:
        spill = float(os.environ.get('BOLT_SPILL', 0))
        if spill:
            k8 = Image.fromarray((keep[..., 0] * 255).astype(np.uint8))
            near = np.asarray(k8.filter(ImageFilter.GaussianBlur(ba.shape[1] * 0.03)), np.float32) / 255
            near = np.clip(near * 6, 0, 1)
            ba[..., :3] += near[..., None] * np.array([0.35, 0.75, 1.0], np.float32) * 255 * spill * (ba[..., 3:4] > 0)
        ba[..., :3] = ba[..., :3] * (1 - keep) + keep_px * keep
    board = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), 'RGBA')
    bx, by = (W - bw) // 2, int(H * board_cy - board.height / 2)
    if reflect:
        # a faint, rippled mirror image below the board, as if it sat on the water
        ref = board.transpose(Image.FLIP_TOP_BOTTOM)
        ra = np.asarray(ref).astype(np.float32)
        rows = np.arange(ra.shape[0])[:, None]
        wob = (np.sin(rows / 3.0) * 2).astype(np.int32)
        cols_idx = np.clip(np.arange(ra.shape[1])[None, :] + wob, 0, ra.shape[1] - 1)
        ra = ra[rows, cols_idx]
        fade = np.clip(1 - rows / (ra.shape[0] * 0.6), 0, 1)
        ra[..., 3] *= reflect * fade
        ref = Image.fromarray(ra.astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(1.2))
        img.alpha_composite(ref, (bx, by + board.height - int(board.height * 0.10)))
    gm = os.environ.get('GLOW_MASK')
    if gm:
        # underglow for the parts of the board that sit on the dark scene (push lines, dots)
        gcol = [float(v) for v in os.environ.get('GLOW_COL', '0.25,1.0,0.45,1.0').split(',')]
        m = Image.open(gm).convert('RGBA').getchannel('A')
        src_w, src_h = Image.open(board_path).size
        m = m.resize((bw, int(src_h * bw / src_w * flatten)), Image.LANCZOS)
        m = perspective(Image.merge('RGBA', [m, m, m, m]), squeeze).getchannel('A')
        wide = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(W * 0.006))
        tight = m.filter(ImageFilter.GaussianBlur(W * 0.0018))
        ga = np.clip(np.asarray(wide, np.float32) / 255 * 1.6 * gcol[3] + np.asarray(tight, np.float32) / 255 * 1.4 * gcol[3], 0, 1)
        glow_im = np.zeros(ga.shape + (4,), np.float32)
        glow_im[..., :3] = np.array(gcol[:3]) * 255
        glow_im[..., 3] = ga * 255
        img.alpha_composite(Image.fromarray(glow_im.astype(np.uint8), 'RGBA'), (bx, by))
    img.alpha_composite(shadow(board, W * 0.010, 0.45), (bx + int(W * 0.004), by + int(H * 0.012)))
    img.alpha_composite(board, (bx, by))

    # frosted window
    x0, x1 = int(W * 0.285), int(W * 0.715)
    y0, y1 = int(H * 0.305), int(H * 0.885)
    a = np.asarray(img).astype(np.float32) / 255
    win = a[y0:y1, x0:x1, :3]
    rel = os.environ.get('WINDOW_REL')
    if rel:
        # frost in proportion to the scene: a gentle lift that keeps dark scenes dark
        m, a_ = [float(v) for v in rel.split(',')]
        win = np.clip(win * (1 + m) + a_ * np.array([0.97, 0.98, 1.0]), 0, 1)
    else:
        win = win * (1 - window_light) + window_light * np.array([0.97, 0.98, 1.0])
    a[y0:y1, x0:x1, :3] = win
    a = (a * 255).astype(np.uint8)
    img = Image.fromarray(a, 'RGBA')
    frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rectangle([x0 - 2, y0 - 2, x1 + 1, y1 + 1], outline=(0, 0, 0, 60), width=2)
    d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(255, 255, 255, 150), width=2)
    d.rectangle([x0 + 2, y0 + 2, x1 - 3, y1 - 3], outline=(255, 255, 255, 50), width=1)
    img.alpha_composite(frame)

    # title discs: one or more rows ("MATRX/GIPF"), colours per row separated the same way
    rows = os.environ.get('TITLE', TITLE).split('/')
    col_rows = colours.split('/')
    if len(col_rows) == 1:
        col_rows = col_rows * len(rows)
    two = len(rows) > 1
    D = int(W * (0.092 if two else 0.122))
    step = W * (0.104 if two else 0.138)
    row_cy = [H * 0.080, H * 0.212] if two else [H * 0.112]
    longest = max(len(r) for r in rows)
    for r, (word, cols_) in enumerate(zip(rows, col_rows)):
        cols = cols_.split(',')
        if len(cols) == 1:
            cols = cols * len(word)
        cx0 = W / 2 - step * (len(word) - 1) / 2
        cy = row_cy[r]
        for i, (letter, col) in enumerate(zip(word, cols)):
            di = disc(letter, col, D, seed=10 + 7 * r + i)
            img.alpha_composite(di, (int(cx0 + i * step - di.width / 2), int(cy - di.height / 2)))
        if r == 0:
            last_x = cx0 + (len(word) - 1) * step
            first_cy = cy
    # registered mark
    rm = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rm)
    rx, ry, rr = last_x + D * 0.62, first_cy - D * 0.42, D * 0.07
    rd.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], outline=(255, 255, 255, 220), width=max(1, int(rr * 0.18)))
    from PIL import ImageFont
    f = ImageFont.truetype('/usr/share/fonts/liberation/LiberationSans-Regular.ttf', int(rr * 1.4))
    rd.text((rx, ry + rr * 0.05), 'R', font=f, fill=(255, 255, 255, 220), anchor='mm')
    img.alpha_composite(rm)

    # GIPF project logo, bottom right
    lg = logo(int(W * 0.045))
    lg = lg.crop(lg.getbbox())
    img.alpha_composite(lg, (int(W * 0.975 - lg.width), int(H * 0.965 - lg.height)))
    return img.convert('RGB')


if __name__ == '__main__':
    out, scene, board, colours = sys.argv[1:5]
    kw = {}
    if len(sys.argv) > 5:
        kw['board_scale'] = float(sys.argv[5])
    if len(sys.argv) > 6:
        kw['board_cy'] = float(sys.argv[6])
    if len(sys.argv) > 7:
        kw['squeeze'] = float(sys.argv[7])
    if len(sys.argv) > 8:
        kw['flatten'] = float(sys.argv[8])
    compose(scene, board, colours, **kw).save(out, quality=92)
