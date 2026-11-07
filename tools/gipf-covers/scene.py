"""Render a Bryce-style landscape (sky, cloud deck, mountains, lake) for a GIPF-project style cover.

Usage: python3 -I scene.py OUT.png PRESET [W H]
"""
import sys

import numpy as np
from PIL import Image


def value_noise(shape, scale, rng):
    h, w = shape
    gh, gw = max(2, int(h / scale) + 3), max(2, int(w / scale) + 3)
    g = rng.random((gh, gw)).astype(np.float32)
    img = Image.fromarray(g, 'F').resize((int(round(gw * scale)), int(round(gh * scale))), Image.BICUBIC)
    a = np.asarray(img)
    return np.pad(a, ((0, max(0, h - a.shape[0])), (0, max(0, w - a.shape[1]))), mode='wrap')[:h, :w]


def tile_noise(T, cells, rng):
    """Seamless value noise on a TxT torus with `cells` lattice cells per side."""
    g = rng.random((cells, cells)).astype(np.float32)
    big = np.tile(g, (3, 3))
    step = T / cells
    img = Image.fromarray(big, 'F').resize((int(round(3 * cells * step)),) * 2, Image.BICUBIC)
    a = np.asarray(img)
    return a[T:2 * T, T:2 * T]


def tile_fbm(T, cells, octaves, rng, gain=0.5):
    out = np.zeros((T, T), np.float32)
    amp, total = 1.0, 0.0
    for _ in range(octaves):
        if cells > T // 2:
            break
        out += amp * tile_noise(T, cells, rng)
        total += amp
        amp *= gain
        cells *= 2
    return out / total


def fbm(shape, base, octaves, rng, gain=0.5):
    out = np.zeros(shape, np.float32)
    amp, total, scale = 1.0, 0.0, base
    for _ in range(octaves):
        if scale < 1:
            break
        out += amp * value_noise(shape, scale, rng)
        total += amp
        amp *= gain
        scale /= 2
    return out / total


def ridged(shape, base, octaves, rng):
    out = np.zeros(shape, np.float32)
    amp, total, scale = 1.0, 0.0, base
    weight = np.ones(shape, np.float32)
    for _ in range(octaves):
        if scale < 1:
            break
        n = 1 - np.abs(2 * value_noise(shape, scale, rng) - 1)
        n = n * n * weight
        weight = np.clip(n * 2, 0, 1)
        out += amp * n
        total += amp
        amp *= 0.5
        scale /= 2
    return out / total


def lerp(a, b, t):
    return a + (b - a) * t


def c(v):
    return np.array(v, np.float32)


def bolt_points(a, b, rng, rough=0.22, depth=7):
    pts = [np.array(a, float), np.array(b, float)]
    for _ in range(depth):
        new = [pts[0]]
        for p0, p1 in zip(pts[:-1], pts[1:]):
            d = p1 - p0
            n = np.array([-d[1], d[0]])
            mid = (p0 + p1) / 2 + n * rng.normal(0, rough)
            new += [mid, p1]
        pts = new
        rough *= 0.62
    return pts


def draw_lightning(img, bolts, rng, scale):
    """Additive glow + body + white core, in the LYNGK bolt colours."""
    from PIL import ImageDraw, ImageFilter
    H, W = img.shape[:2]
    layers = {k: Image.new('L', (W, H), 0) for k in ('glow', 'body', 'core', 'halo')}
    for bolt in bolts:
        a, b, branches = bolt[:3]
        rough = bolt[3] if len(bolt) > 3 else 0.22
        a = (a[0] * W, a[1] * H)
        b = (b[0] * W, b[1] * H)
        main = bolt_points(a, b, rng, rough)
        paths = [(main, 1.0)]
        for _ in range(branches):
            i = rng.integers(len(main) // 5, len(main) * 3 // 4)
            start = main[i]
            d = np.array(b) - np.array(a)
            ang = np.arctan2(d[1], d[0]) + rng.choice([-1, 1]) * rng.uniform(0.35, 0.9)
            ln = np.hypot(*d) * rng.uniform(0.18, 0.4)
            end = start + ln * np.array([np.cos(ang), np.sin(ang)])
            paths.append((bolt_points(start, end, rng, 0.25, 6), 0.55))
        for pts, wgt in paths:
            xy = [tuple(p) for p in pts]
            ImageDraw.Draw(layers['glow']).line(xy, fill=int(255 * wgt), width=max(1, int(16 * scale * wgt)), joint='curve')
            ImageDraw.Draw(layers['body']).line(xy, fill=int(255 * wgt), width=max(1, int(4.5 * scale * wgt)), joint='curve')
            ImageDraw.Draw(layers['core']).line(xy, fill=255, width=max(1, int(1.8 * scale * wgt)), joint='curve')
        hx, hy = a
        ImageDraw.Draw(layers['halo']).ellipse([hx - 160 * scale, hy - 90 * scale, hx + 160 * scale, hy + 90 * scale], fill=255)
    glow = np.asarray(layers['glow'].filter(ImageFilter.GaussianBlur(14 * scale)), np.float32) / 255
    body = np.asarray(layers['body'].filter(ImageFilter.GaussianBlur(1.6 * scale)), np.float32) / 255
    core = np.asarray(layers['core'].filter(ImageFilter.GaussianBlur(0.6 * scale)), np.float32) / 255
    halo = np.asarray(layers['halo'].filter(ImageFilter.GaussianBlur(70 * scale)), np.float32) / 255
    out = img + halo[..., None] * 0.30 * c((0.55, 0.75, 1.0))
    out = out + glow[..., None] * 0.9 * c((0.44, 0.89, 1.0))
    out = out + body[..., None] * c((0.07, 0.72, 0.94))
    out = lerp(out, c((1, 1, 1)), np.clip(core, 0, 1)[..., None])
    return out


RAIN_CHARS = [chr(c_) for c_ in range(0xFF66, 0xFF9E)] + list('012345789Z:.=*+-<>|')
_GLYPHS = {}


def _glyph(ch, size):
    from PIL import ImageDraw, ImageFont
    key = (ch, size)
    if key not in _GLYPHS:
        f = ImageFont.truetype('/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc', size, index=0)
        im = Image.new('L', (size * 2, size * 2), 0)
        ImageDraw.Draw(im).text((size, size), ch, font=f, fill=255, anchor='mm')
        im = im.transpose(Image.FLIP_LEFT_RIGHT)  # the film's code is mirrored
        _GLYPHS[key] = np.asarray(im, np.float32) / 255
    return _GLYPHS[key]


def draw_rain(img, cfg, rng, hz, zbuf, water):
    """Falling green code: columns of mirrored katakana, bright heads and fading tails."""
    from PIL import ImageFilter
    H, W = img.shape[:2]
    sc = W / 1600
    trail = np.zeros((H, W), np.float32)
    heads = np.zeros((H, W), np.float32)
    for size, count, bright in cfg['layers']:
        size = max(6, int(size * sc))
        step = int(size * 1.05)
        for _ in range(count):
            x = int(rng.integers(0, W // step)) * step + step // 2
            length = int(rng.integers(cfg.get('min_len', 6), cfg.get('max_len', 26)))
            head_y = rng.uniform(0, H * cfg.get('reach', 0.6)) + length * step * 0.3
            for i in range(length):
                y = int(head_y - i * step)
                if y < -size or y >= H + size:
                    continue
                b = bright * (1 - i / length) ** 1.6
                if rng.random() < 0.12:
                    b *= 0.35
                gl = _glyph(rng.choice(RAIN_CHARS), size)
                gh, gw = gl.shape
                ya, xa = y - gh // 2, x - gw // 2
                y0, x0 = max(ya, 0), max(xa, 0)
                y1, x1 = min(ya + gh, H), min(xa + gw, W)
                if y1 <= y0 or x1 <= x0:
                    continue
                patch = gl[y0 - ya:y1 - ya, x0 - xa:x1 - xa] * b
                tgt = heads if i == 0 else trail
                tgt[y0:y1, x0:x1] = np.maximum(tgt[y0:y1, x0:x1], patch)
    # where the rain may show: full in the sky, fading in front of land and below the horizon
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
    top = cfg.get('top_only')
    show = np.ones((H, W), np.float32)
    if top:
        show *= np.clip((top * H - yy) / (0.18 * H), 0, 1)
    show *= np.where(zbuf > 0, cfg.get('over_land', 0.35), 1.0)
    show *= np.where(water, 0.0, 1.0)
    trail *= show
    heads *= show
    glow = np.asarray(Image.fromarray((np.clip(trail + heads, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4 * sc)), np.float32) / 255
    col = c(cfg.get('colour', (0.20, 1.0, 0.42)))
    out = img * (1 - 0.55 * np.clip(trail + heads, 0, 1))[..., None]
    out = out + trail[..., None] * col + glow[..., None] * col * 0.6
    out = lerp(out, c((0.85, 1.0, 0.90)), np.clip(heads, 0, 1)[..., None])
    return out


PRESETS = {
    # the full construct: green wireframe mountains on black, code falling through the sky
    'construct': dict(
        seed=41, sky_top=(0.0, 0.01, 0.0), sky_mid=(0.0, 0.03, 0.01), sky_low=(0.02, 0.12, 0.05),
        sun=(0.5, -0.6), sun_col=(0, 0, 0), cloud_lit=(0.05, 0.16, 0.08), cloud_dark=(0.0, 0.02, 0.0),
        cover=0.25, rock=(0.05, 0.12, 0.07), grass=(0.03, 0.08, 0.04), snow=(0.15, 0.35, 0.20),
        fog=(0.02, 0.10, 0.04), water=(0.0, 0.03, 0.01), light=(-0.4, -0.5, 0.6), light_col=(0.5, 1.0, 0.6),
        wire=dict(spacing=7.0, colour=(0.25, 1.0, 0.45), darken=0.85, fade=0.75),
        rain=dict(layers=[(11, 160, 0.45), (17, 90, 0.75), (26, 40, 1.0)], reach=0.75, over_land=0.25),
    ),
    # a moonlit mountain lake with the code falling from the sky
    'code_night': dict(
        seed=43, sky_top=(0.0, 0.02, 0.01), sky_mid=(0.02, 0.08, 0.05), sky_low=(0.10, 0.26, 0.16),
        sun=(0.5, -0.6), sun_col=(0, 0, 0), cloud_lit=(0.18, 0.42, 0.26), cloud_dark=(0.01, 0.04, 0.02),
        cover=0.45, billow=5.0, crags=0.10,
        rock=(0.30, 0.42, 0.34), grass=(0.10, 0.18, 0.12), snow=(0.80, 1.0, 0.86),
        fog=(0.10, 0.26, 0.15), water=(0.01, 0.07, 0.03), light=(-0.45, -0.5, 0.6), light_col=(0.75, 1.25, 0.85),
        rain=dict(layers=[(11, 150, 0.40), (17, 80, 0.70), (26, 34, 1.0)], reach=0.7, over_land=0.30),
    ),
    # the original GIPF blue day, with the far range turning to wireframe and code in the upper sky
    'bleed': dict(
        seed=11, sky_top=(0.03, 0.10, 0.16), sky_mid=(0.30, 0.52, 0.80), sky_low=(0.84, 0.90, 0.97),
        sun=(0.28, 0.20), sun_col=(1.0, 1.0, 0.95), cloud_lit=(1.0, 1.0, 1.0), cloud_dark=(0.52, 0.60, 0.74),
        cover=0.48, crags=0.08, rock=(0.38, 0.38, 0.42), grass=(0.18, 0.32, 0.20), snow=(0.98, 0.99, 1.0),
        fog=(0.76, 0.85, 0.96), water=(0.08, 0.26, 0.46), light=(-0.55, -0.3, 0.6), light_col=(1.0, 0.98, 0.94),
        wire=dict(spacing=7.0, colour=(0.25, 1.0, 0.45), darken=0.92, fade=0.3, yramp=(0.48, 0.86)),
        rain=dict(layers=[(11, 140, 0.45), (17, 80, 0.75), (26, 30, 1.0)], reach=0.45, top_only=0.42, over_land=0.0),
    ),
    'storm': dict(
        seed=31, sky_top=(0.07, 0.08, 0.12), sky_mid=(0.18, 0.20, 0.27), sky_low=(0.44, 0.48, 0.58),
        sun=(0.5, -0.6), sun_col=(0.0, 0.0, 0.0), cloud_lit=(0.66, 0.73, 0.88), cloud_dark=(0.07, 0.08, 0.12),
        cover=0.62, billow=6.0, crags=0.10, flash_terrain=0.16, gamma=1.35,
        rock=(0.24, 0.24, 0.29), grass=(0.10, 0.14, 0.13), snow=(0.86, 0.90, 0.98),
        fog=(0.38, 0.42, 0.52), water=(0.05, 0.07, 0.12), light=(-0.45, -0.5, 0.6), light_col=(0.92, 0.97, 1.10),
        bolts=[((0.10, 0.17), (0.163, 0.405), 3), ((0.165, 0.41), (0.757, 0.35), 2, 0.05), ((0.84, 0.13), (0.758, 0.345), 2)],
    ),
    'dawn': dict(
        seed=7, sky_top=(0.18, 0.24, 0.46), sky_mid=(0.70, 0.55, 0.62), sky_low=(1.0, 0.80, 0.60),
        sun=(0.64, 0.40), sun_col=(1.0, 0.90, 0.72), cloud_lit=(1.0, 0.85, 0.74), cloud_dark=(0.40, 0.36, 0.52),
        cover=0.50, rock=(0.44, 0.37, 0.40), grass=(0.22, 0.28, 0.24), snow=(1.0, 0.92, 0.88),
        fog=(0.92, 0.74, 0.68), water=(0.22, 0.24, 0.40), light=(-0.5, -0.35, 0.55), light_col=(1.0, 0.86, 0.72),
    ),
    'day': dict(
        seed=11, sky_top=(0.10, 0.28, 0.64), sky_mid=(0.36, 0.58, 0.86), sky_low=(0.84, 0.90, 0.97),
        sun=(0.28, 0.12), sun_col=(1.0, 1.0, 0.95), cloud_lit=(1.0, 1.0, 1.0), cloud_dark=(0.52, 0.60, 0.74),
        cover=0.50, rock=(0.38, 0.38, 0.42), grass=(0.18, 0.32, 0.20), snow=(0.98, 0.99, 1.0),
        fog=(0.76, 0.85, 0.96), water=(0.08, 0.26, 0.46), light=(-0.55, -0.3, 0.6), light_col=(1.0, 0.98, 0.94),
    ),
    'dusk': dict(
        seed=23, sky_top=(0.03, 0.05, 0.15), sky_mid=(0.20, 0.18, 0.40), sky_low=(0.86, 0.48, 0.36),
        sun=(0.78, 0.49), sun_col=(1.0, 0.66, 0.42), cloud_lit=(0.98, 0.58, 0.46), cloud_dark=(0.13, 0.12, 0.25),
        cover=0.44, rock=(0.25, 0.22, 0.30), grass=(0.10, 0.12, 0.15), snow=(0.84, 0.74, 0.84),
        fog=(0.50, 0.36, 0.46), water=(0.05, 0.07, 0.16), light=(0.7, -0.2, 0.35), light_col=(1.0, 0.62, 0.48),
    ),
}


def render(preset, W=1600, H=1180, horizon=0.56, wl=None, camh=None, tseed=None):
    p = PRESETS[preset]
    rng = np.random.default_rng(p['seed'])
    hz = H * horizon
    focal = W * 0.75
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # --- sky -------------------------------------------------------------
    t = np.clip(yy / hz, 0, 1)[..., None]
    sky = np.where(t < 0.55, lerp(c(p['sky_top']), c(p['sky_mid']), (t / 0.55) ** 1.1),
                   lerp(c(p['sky_mid']), c(p['sky_low']), np.clip((t - 0.55) / 0.45, 0, 1) ** 0.9))
    sx, sy = p['sun'][0] * W, p['sun'][1] * H
    dist = np.hypot(xx - sx, (yy - sy) * 1.3) / W
    glow = (np.exp(-dist / 0.16) * 0.45 + np.exp(-dist / 0.035) * 0.6 + (dist < 0.012) * 0.8)[..., None]
    sky = sky + glow * c(p['sun_col'])

    # cloud deck: a textured plane above the camera, seen in perspective
    T = 2048
    tex = tile_fbm(T, 7, 8, rng)
    tex2 = tile_fbm(T, 23, 6, rng)
    cloud_h = 120.0
    above = yy < hz - 2
    depth = cloud_h / np.maximum(hz - yy, 2)  # distance along the ground to the cloud point
    u = ((xx - W / 2) * depth / focal * 0.9 * T / 6 + T / 2).astype(np.int64) % T
    v = (depth * T / 14).astype(np.int64) % T
    if p.get('billow'):
        wu = tile_fbm(T, 8, 4, rng) - 0.5
        wv = tile_fbm(T, 8, 4, rng) - 0.5
        k = 260
        u2 = (u + (wu[v, u] * k).astype(np.int64)) % T
        v2 = (v + (wv[v, u] * k).astype(np.int64)) % T
        u, v = u2, v2
    cn = tex[v, u]
    cn2 = tex2[v, u]
    sharp = p.get('billow', 4.0)
    dens = np.clip((cn + 0.22 * cn2 - (1.08 - p['cover'])) * sharp, 0, 1) * above
    # self-shadowing: compare with the texture a little toward the sun
    vs = ((depth + 0.6) * T / 14).astype(np.int64) % T
    lit = np.clip(0.55 + (cn - tex[vs, u]) * 7 + 0.3 * (cn2 - 0.5), 0, 1)
    fade = np.clip((hz - yy) / (H * 0.05), 0, 1)  # clouds thin into haze at the horizon
    flash = np.zeros((H, W), np.float32)
    if p.get('bolts'):
        from PIL import ImageFilter as _IF
        for bolt in p['bolts']:
            for (fx, fy) in (bolt[0], bolt[1]):
                d = np.hypot(xx - fx * W, (yy - fy * H) * 1.2) / W
                flash += np.exp(-d / 0.11)
        flash = 1 - np.exp(-flash * 1.4)
        db = np.asarray(Image.fromarray((dens * 255).astype(np.uint8)).filter(_IF.GaussianBlur(6 * W / 1600)), np.float32) / 255
        gy_, gx_ = np.gradient(db)
        # light comes from the nearest bolt end: approximate by the flash gradient
        fy_, fx_ = np.gradient(flash)
        fl = np.hypot(fx_, fy_) + 1e-6
        rim = np.clip(-(gx_ * fx_ + gy_ * fy_) / fl * 40 * W / 1600, -1, 1)
        lit = np.clip(lit * 0.45 + 0.05 + (0.35 + 0.6 * rim) * flash + 0.25 * rim, 0, 1)
    ccol = lerp(c(p['cloud_dark']), c(p['cloud_lit']), lit[..., None]) + glow * 0.5 * c(p['sun_col'])
    ccol = lerp(c(p['sky_low']), ccol, fade[..., None] * 0.85 + 0.15)
    sky = lerp(sky, ccol, (dens * fade)[..., None] ** 0.9)

    # --- terrain (voxel space) -------------------------------------------
    rng = np.random.default_rng(tseed if tseed is not None else p['seed'] + 1000)  # terrain independent of image size
    N = 1024
    HS = 175.0  # height scale in grid units
    hm = ridged((N, N), 240, 7, rng) * 0.8 + fbm((N, N), 260, 6, rng) * 0.2
    hm = (hm - hm.min()) / (hm.max() - hm.min())
    if p.get('crags'):
        hm = hm + p['crags'] * ridged((N, N), 24, 4, rng) * hm
        hm = (hm - hm.min()) / (hm.max() - hm.min())
    gz, gx = np.mgrid[0:N, 0:N] / N
    # a winding lake valley down the middle, mountains rising on each side
    centre = 0.5 + 0.05 * np.sin(gz * 11)
    valley = np.clip(np.abs(gx - centre) / (0.10 + 0.18 * gz), 0, 1) ** 1.3
    hm = hm * (0.04 + 0.96 * valley) * (0.55 + 0.45 * np.clip(gz * 3, 0, 1))
    hgz, hgx = np.gradient(hm * HS)
    L = c(p['light'])
    L = L / np.linalg.norm(L)
    nl = np.sqrt(hgx ** 2 + hgz ** 2 + 1)
    diffuse = np.clip((-hgx * L[0] - hgz * L[1] + L[2]) / nl, 0, 1)
    slope = 1 - 1 / nl
    det = fbm((N, N), 8, 5, rng)
    rock, grass, snow = c(p['rock']), c(p['grass']), c(p['snow'])
    base = lerp(grass, rock, np.clip(hm * 2.6 + slope * 2.2 - 0.35, 0, 1)[..., None])
    snowmask = np.clip((hm - 0.48) * 7 + (det - 0.5) * 1.2 - slope * 2.2, 0, 1)
    base = lerp(base, snow, snowmask[..., None])
    shade = 0.28 + 0.95 * diffuse
    base = base * shade[..., None] * (0.85 + 0.3 * det[..., None])
    base = base * lerp(c((0.55, 0.58, 0.75)), c(p['light_col']), diffuse[..., None])

    world = hm * HS
    water_level = (wl if wl is not None else p.get("wl", 0.05)) * HS
    cam_h = camh if camh is not None else p.get("camh", 62.0)
    img = sky.copy()
    is_water_px = np.zeros((H, W), bool)
    ybuf = np.full(W, H, np.int32)
    cols = np.arange(W)
    fog = c(p['fog'])
    z, zmax = 4.0, N * 0.95
    cam_x, cam_z = N * 0.5, 0.0
    wire = p.get('wire')
    grid = np.zeros((H, W), np.float32)
    zbuf = np.zeros((H, W), np.float32)
    g = wire['spacing'] if wire else 8.0
    prev_cz = None
    while z < zmax:
        fx = cam_x + (cols - W / 2) / focal * z
        fz = cam_z + z
        x0 = np.floor(fx).astype(np.int64)
        tx = (fx - x0)
        z0 = int(np.floor(fz))
        tz = fz - z0
        xa, xb = x0 % N, (x0 + 1) % N
        za, zb = z0 % N, (z0 + 1) % N

        def samp(a):
            ta = tx if a.ndim == 2 else tx[:, None]
            r0 = a[za, xa] * (1 - ta) + a[za, xb] * ta
            r1 = a[zb, xa] * (1 - ta) + a[zb, xb] * ta
            return r0 * (1 - tz) + r1 * tz
        h = samp(world)
        water = h < water_level
        hd = np.where(water, water_level, h)
        sy_ = np.clip((hz - (hd - cam_h) / z * focal).astype(np.int32), 0, H)
        fogt = min(1.0, (z / zmax) ** 0.65 * 1.05)
        col = lerp(samp(base), fog, fogt)
        draw = np.where(sy_ < ybuf)[0]
        cz = int(np.floor(fz / g))
        zline = prev_cz is not None and cz != prev_cz
        prev_cz = cz
        cxs = np.floor(fx / g)
        xline = cxs != np.roll(cxs, 1)
        for x in draw:
            y0, y1 = sy_[x], ybuf[x]
            if water[x]:
                is_water_px[y0:y1, x] = True
            else:
                img[y0:y1, x] = col[x]
                zbuf[y0:y1, x] = z / zmax
                if wire:
                    if zline:
                        grid[y0:y0 + 2, x] = 1.0
                    if xline[x]:
                        grid[y0:y1, x] = np.maximum(grid[y0:y1, x], 0.8)
        ybuf = np.minimum(ybuf, sy_)
        z += 0.6 + z * 0.006

    if wire:
        from PIL import ImageFilter as _IF
        land = ~is_water_px & (zbuf > 0)
        # how much of the land turns to wireframe: by depth (near -> far ramp)
        a0, a1 = wire.get('ramp', (0.0, 0.0))
        amt = np.clip((zbuf - a0) / max(a1 - a0, 1e-6), 0, 1) if a1 > a0 else np.ones_like(zbuf)
        if wire.get('yramp'):
            yf, yn = wire['yramp']
            amt = amt * np.clip((yn * H - yy) / ((yn - yf) * H), 0, 1)
        amt = amt * land
        dark = c(wire.get('fill', (0.0, 0.02, 0.01)))
        img = lerp(img, dark, (amt * wire.get('darken', 0.9))[..., None])
        gfade = (1 - zbuf * wire.get('fade', 0.6)) * amt
        gl = np.asarray(Image.fromarray((np.clip(grid * gfade, 0, 1) * 255).astype(np.uint8)).filter(_IF.GaussianBlur(2.2 * W / 1600)), np.float32) / 255
        wc = c(wire.get('colour', (0.3, 1.0, 0.5)))
        img = img + (grid * gfade)[..., None] * wc * 0.95 + gl[..., None] * wc * 0.9
    if p.get('rain'):
        img = draw_rain(img, p['rain'], np.random.default_rng(p['seed'] + 4000), hz, zbuf, is_water_px)
        sky = draw_rain(sky, p['rain'], np.random.default_rng(p['seed'] + 4000), hz, np.zeros_like(zbuf), np.zeros_like(is_water_px))

    # --- water: mirrored scene, darkened and rippled ----------------------
    if p.get('bolts'):
        terrain = ~is_water_px & (yy >= hz * 0.0)
        is_sky = np.all(np.abs(img - sky) < 1e-6, axis=-1)
        lift = (flash * p.get('flash_terrain', 0.3))[..., None] * c((0.80, 0.88, 1.0))
        img = np.where((~is_sky & ~is_water_px)[..., None], img + lift, img)
        img = draw_lightning(img, p['bolts'], np.random.default_rng(p['seed'] + 3000), W / 1600)
        sky = draw_lightning(sky, p['bolts'], np.random.default_rng(p['seed'] + 3000), W / 1600)
    rng = np.random.default_rng(p['seed'] + 2000)
    if is_water_px.any():
        tops = []
        for x in range(W):
            ys = np.where(is_water_px[:, x])[0]
            if len(ys):
                tops.append(ys.min())
        ml = int(np.percentile(tops, 30))
        rip = value_noise((H, W), 24, rng) - 0.5
        rip_f = value_noise((H, W), 7, rng) - 0.5
        depth_t = np.clip((yy - ml) / (H - ml), 0, 1)
        src = 2 * ml - yy + rip * 18 * depth_t + rip_f * 6 * depth_t
        src = np.clip(src.astype(np.int32), 0, H - 1)
        refl = np.take_along_axis(img, src[..., None].repeat(3, 2), 0)
        refl = np.where(np.take_along_axis(is_water_px, src, 0)[..., None], np.take_along_axis(sky, src[..., None].repeat(3, 2), 0), refl)
        streak = 1 + 0.10 * (value_noise((H, W // 6 + 1), 3, rng)[:, np.minimum(np.arange(W) // 6, W // 6)] - 0.5)
        wcol = lerp(refl, c(p['water']), 0.30 + 0.25 * depth_t[..., None]) * streak[..., None]
        img = np.where(is_water_px[..., None], wcol, img)
    img = np.clip(img, 0, 1)
    if p.get('gamma'):
        img = img ** p['gamma']
    return img


if __name__ == '__main__':
    out, preset = sys.argv[1], sys.argv[2]
    W = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
    H = int(sys.argv[4]) if len(sys.argv) > 4 else 1180
    wl = float(sys.argv[5]) if len(sys.argv) > 5 else None
    camh = float(sys.argv[6]) if len(sys.argv) > 6 else None
    tseed = int(sys.argv[7]) if len(sys.argv) > 7 else None
    im = render(preset, W, H, wl=wl, camh=camh, tseed=tseed)
    Image.fromarray((im * 255).astype(np.uint8)).save(out)
