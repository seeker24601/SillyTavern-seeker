#!/usr/bin/env python3
"""Shadows in the style of the stage edge.

Writes shadows.css (the shadow tokens for each Stage edge style) and shadow-maps.js (the
patterns the sprite filters threshold against). Run from the repo root:

    python3 scripts/shadows.py

A shadow is a darkness that fades with distance. The smooth style draws it as CSS draws any
shadow. The others draw the same darkness the way the stage edge does:
  dither    the 8x8 ordered (Bayer) pattern in 2px cells, as on the stage edge: a cell is
            inked where the shadow is darker than the cell's threshold, so the cells thin out
            as the shadow fades.
  halftone  dots on a 45-degree screen that grow with the darkness: big and touching near
            the surface, small at the shadow's edge.
  torn      no fade: a hard, flat shadow cast down and to the right, and skewed, wider at
            the bottom right than at the top, like a paper cut-out lifted off the page.

Boxes (panels, menus, toasts, tiles) get theirs as a nine-slice border-image around the box:
it is drawn outside the box without being clipped by the box's own scrolling, and costs
nothing once drawn. The middle of each image is empty, so nothing is drawn over the box.
Sprites get no shadow but a light rim inside their outline, and small round things a small
shadow, both SVG filters (edge-style.js) that threshold against the same patterns.
"""
import base64
import io
import math
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = 2  # image pixels per CSS pixel: crisp cells on high-density screens

# ---------- Patterns (threshold maps, 0..1) ----------
def bayer(n):
    m = np.array([[0]])
    while m.shape[0] < n:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / (n * n)

BAYER8 = bayer(8)
DITHER_CELL = 2  # CSS px, as on the stage edge
# The steps a dithered shadow fades in, as fractions of the 64 cells inked: doubling, so
# the tail thins out to single dots rather than ending at a hard edge.
DITHER_STEPS = np.array([1, 2, 4, 8, 16, 26, 38, 48]) / 64
HALFTONE_PITCH = 6  # CSS px: the screen's repeat; dots sit at its corners and centre


def dither_map(h, w, s=S):
    c = DITHER_CELL * s
    yy, xx = np.mgrid[0:h, 0:w]
    return BAYER8[(yy // c) % 8, (xx // c) % 8]


def halftone_map(h, w, s=S):
    """Distance to the nearest dot centre on a 45-degree screen, mapped so that a darkness
    of d inks about the fraction d of the area (a dot's area grows with the square of its
    radius)."""
    a = HALFTONE_PITCH * s
    yy, xx = np.mgrid[0:h, 0:w].astype(float) + 0.5
    fx = (xx % a) - a / 2
    fy = (yy % a) - a / 2
    centre = np.hypot(fx, fy)
    corner = np.hypot(a / 2 - np.abs(fx), a / 2 - np.abs(fy))
    t = np.minimum(centre, corner) / (a / 2)  # 0 at a dot centre, 1 furthest from any
    return np.minimum(1.0, math.pi * t * t / 2)


# ---------- Shadow images for boxes ----------
def rounded_box(h, w, box, r, s=S):
    """Antialiased mask (0..1) of a rounded rectangle, box = (x0, y0, x1, y1) in image px."""
    k = 4
    im = Image.new('L', (w * k, h * k), 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(im).rounded_rectangle((x0 * k, y0 * k, x1 * k - 1, y1 * k - 1), r * s * k, fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=float) / 255


def encode(alpha):
    """Black with the given alpha, as a lossless WebP data URI."""
    a = np.clip(alpha * 255 + 0.5, 0, 255).astype(np.uint8)
    im = Image.merge('RGBA', [Image.new('L', (a.shape[1], a.shape[0]), 0)] * 3 + [Image.fromarray(a)])
    buf = io.BytesIO()
    im.save(buf, 'WEBP', lossless=True, quality=100, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def soft_shadow(kind, *, dy, sigma, radius, outset, inner, mid=48, strength=1.0):
    """A soft shadow (box offset by dy, blurred by sigma), drawn as kind. outset is the
    (top, right, bottom, left) reach outside the box in CSS px; inner how far each corner's
    influence runs along the edges."""
    ot, orr, ob, ol = outset
    bw = bh = 2 * inner + mid  # the box in the source image, CSS px
    W, H = (ol + bw + orr) * S, (ot + bh + ob) * S
    box = (ol * S, ot * S, (ol + bw) * S, (ot + bh) * S)
    cast = (box[0], box[1] + dy * S, box[2], box[3] + dy * S)
    shade = Image.fromarray((rounded_box(H, W, cast, radius) * 255).astype(np.uint8))
    shade = np.asarray(shade.filter(ImageFilter.GaussianBlur(sigma * S)), dtype=float) / 255
    darkness = np.clip(shade * strength, 0, 1)
    if kind == 'dither':
        # In steps: each band of the fade is one ordered texture (a dense checker, a
        # checker, a grid, sparse dots), and each step's ink is lighter than the last, so
        # the pattern and the opacity fade together. Never solid: at most about half black.
        # (A smooth fade in 2px cells blurs into grain, like spray paint; steps do not.)
        step = np.searchsorted(DITHER_STEPS, darkness, side='right') - 1
        bands = np.where(step >= 0, DITHER_STEPS[np.clip(step, 0, None)], 0)
        inked = bands > dither_map(H, W)
        alpha = inked * (0.12 + 0.48 * bands)
    else:
        # The dots' size carries the fade, and their ink lightens with it.
        inked = darkness > halftone_map(H, W)
        alpha = inked * (0.14 + 0.36 * darkness)
    alpha = np.round(alpha * 16) / 16  # a few ink levels; keeps the files small
    alpha = alpha * (1 - rounded_box(H, W, box, radius))  # nothing under the box
    return alpha, (ot, orr, ob, ol), (inner, bw, bh)


def paper_shadow(*, corners, radius, inner, mid=48):
    """A hard shadow: the box moved by a different (dx, dy) at each corner (top left, top
    right, bottom right, bottom left), so it is skewed. Nine-slice stretching keeps its edges
    straight, so the skew holds at any size."""
    tl, tr, br, bl = corners
    ot = 0
    ol = 0
    orr = max(tr[0], br[0]) + 2
    ob = max(bl[1], br[1]) + 2
    bw = bh = 2 * inner + mid
    W, H = (ol + bw + orr) * S, (ot + bh + ob) * S
    box = (ol * S, ot * S, (ol + bw) * S, (ot + bh) * S)
    # For each pixel, the point of the box it is the shadow of: invert the bilinear map
    # from the box to the skewed quad (offsets are small, so a few fixed-point steps do).
    yy, xx = np.mgrid[0:H, 0:W].astype(float) + 0.5
    x0, y0, x1, y1 = box
    u = (xx - x0) / (x1 - x0)
    v = (yy - y0) / (y1 - y0)
    off = lambda u, v, i: S * ((1 - u) * (1 - v) * tl[i] + u * (1 - v) * tr[i] + u * v * br[i] + (1 - u) * v * bl[i])
    for _ in range(6):
        sx = xx - off(np.clip(u, 0, 1), np.clip(v, 0, 1), 0)
        sy = yy - off(np.clip(u, 0, 1), np.clip(v, 0, 1), 1)
        u = (sx - x0) / (x1 - x0)
        v = (sy - y0) / (y1 - y0)
    # Inside the rounded box at (sx, sy): sample the box mask there.
    k = 4
    mask = Image.new('L', (W * k, H * k), 0)
    ImageDraw.Draw(mask).rounded_rectangle((x0 * k, y0 * k, x1 * k - 1, y1 * k - 1), radius * S * k, fill=255)
    big = np.asarray(mask, dtype=float) / 255
    ix = np.clip((sx * k).astype(int), 0, W * k - 1)
    iy = np.clip((sy * k).astype(int), 0, H * k - 1)
    inside = big[iy, ix]
    # Antialias the shadow's edge by averaging a 2x2 supersample of the lookup.
    alpha = 0.6 * inside
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(0.6)), dtype=float) / 255
    alpha = alpha * (1 - rounded_box(H, W, box, radius))
    return alpha, (ot, orr, ob, ol), (inner, bw, bh)


def border_image(alpha, outset, geometry, repeat):
    """The border-image shorthand that draws this image around a box."""
    ot, orr, ob, ol = outset
    inner = geometry[0]
    widths = (ot + inner, orr + inner, ob + inner, ol + inner)  # CSS px from the outer edge
    slices = ' '.join(str(w * S) for w in widths)
    return (f'url("{encode(alpha)}") {slices} / ' + ' '.join(f'{w}px' for w in widths)
            + ' / ' + ' '.join(f'{o}px' for o in outset) + f' {repeat}')


def encode_mask(alpha, rgb=(0, 0, 0)):
    """An image of the given colour with the given alpha, as a lossless WebP data URI."""
    a = np.clip(alpha * 255 + 0.5, 0, 255).astype(np.uint8)
    chans = [Image.new('L', (a.shape[1], a.shape[0]), c) for c in rgb]
    im = Image.merge('RGBA', chans + [Image.fromarray(a)])
    buf = io.BytesIO()
    im.save(buf, 'WEBP', lossless=True, quality=100, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def stepped(darkness, h, w, s=S):
    """Darkness as dither steps: which cells are inked, and at what step."""
    step = np.searchsorted(DITHER_STEPS, darkness, side='right') - 1
    bands = np.where(step >= 0, DITHER_STEPS[np.clip(step, 0, None)], 0)
    return bands > dither_map(h, w, s), bands


PORTRAIT_INK_REACH = 5


def portrait_ink():
    """The accent ink behind a chat portrait on hover (chat-portraits.css): a shadow of the
    portrait, in each style, cast toward the bottom right by the stylesheet. The mask covers the
    portrait and PORTRAIT_INK_REACH CSS px around it (inset: -5px); the portrait is 56 x 84 CSS
    px by default."""
    pw, ph, r, m = 56, 84, 10, PORTRAIT_INK_REACH
    W, H = (pw + 2 * m) * S, (ph + 2 * m) * S
    box = (m * S, m * S, (m + pw) * S, (m + ph) * S)
    shape = Image.fromarray((rounded_box(H, W, box, r) * 255).astype(np.uint8))
    field = np.asarray(shape.filter(ImageFilter.GaussianBlur(2 * S)), dtype=float) / 255
    darkness = np.clip(field * 1.7, 0, 1)
    inked, bands = stepped(darkness, H, W)
    out = {
        'dither': inked * (0.4 + 0.6 * bands / DITHER_STEPS[-1]),
        'halftone': (darkness > halftone_map(H, W)) * (0.55 + 0.45 * darkness),
        'gradient': darkness,
        'torn': (field > 0.22).astype(float),
    }
    return {k: f'url("{encode_mask(np.round(v * 16) / 16)}")' for k, v in out.items()}


def main():
    images = {}
    for kind in ('dither', 'halftone'):
        repeat = 'repeat' if kind == 'dither' else 'round'
        # Panels, menus, dialogs: like 0 16px 40px. Small things (tiles, toasts, portraits,
        # tooltips): like 0 6px 18px. Dense at the box, thinning and lightening outward.
        lg = soft_shadow(kind, dy=26, sigma=28, radius=16, outset=(46, 72, 100, 72), inner=72, strength=1.3)
        sm = soft_shadow(kind, dy=10, sigma=11, radius=10, outset=(16, 28, 40, 28), inner=32, strength=1.3)
        images[kind] = (border_image(*lg, repeat), border_image(*sm, repeat))
    lg = paper_shadow(corners=((3, 4), (7, 6), (12, 11), (5, 9)), radius=16, inner=40)
    sm = paper_shadow(corners=((2, 3), (4, 4), (7, 7), (3, 5)), radius=10, inner=18)
    images['torn'] = (border_image(*lg, 'stretch'), border_image(*sm, 'stretch'))
    ink = portrait_ink()

    none = '0 0 transparent'  # a shadow that draws nothing but is valid in a list
    tokens = {
        'dither': dict(shadow=none, image=images['dither'][0], sm=none, sm_image=images['dither'][1], raised=none,
                       sprite='url(#seeker-sprite-rim-dither)', filter='url(#seeker-small-shadow-dither)',
                       ink=ink['dither']),
        'gradient': dict(shadow='0 16px 40px rgba(0, 0, 0, 0.5)', image='none', sm='0 6px 18px rgba(0, 0, 0, 0.35)',
                         sm_image='none', raised='0 14px 30px rgba(0, 0, 0, 0.5)',
                         sprite='url(#seeker-sprite-rim-soft)',
                         filter='none', ink=ink['gradient']),
        'halftone': dict(shadow=none, image=images['halftone'][0], sm=none, sm_image=images['halftone'][1], raised=none,
                         sprite='url(#seeker-sprite-rim-halftone)', filter='url(#seeker-small-shadow-halftone)',
                         ink=ink['halftone']),
        'torn': dict(shadow=none, image=images['torn'][0], sm=none, sm_image=images['torn'][1], raised=none,
                     sprite='url(#seeker-sprite-rim-torn)', filter='drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.45))',
                     ink=ink['torn']),
    }
    names = dict(shadow='--seeker-shadow', image='--seeker-shadow-image', sm='--seeker-shadow-sm',
                 sm_image='--seeker-shadow-sm-image', raised='--seeker-shadow-raised',
                 sprite='--seeker-sprite-shadow', filter='--seeker-shadow-filter',
                 ink='--seeker-portrait-ink')
    css = ['/* Generated by scripts/shadows.py: do not edit by hand.',
           '   Shadows follow the Stage edge style (User Settings; data-seeker-edge). Each style sets:',
           '     --seeker-shadow, --seeker-shadow-image        panels, menus, dialogs',
           '     --seeker-shadow-sm, --seeker-shadow-sm-image  tiles, toasts, portraits, tooltips',
           '     --seeker-shadow-raised                        a small thing lifted (hover)',
           '     --seeker-shadow-filter                        a small thing of any shape (a filter; round buttons)',
           '     --seeker-sprite-shadow                        the sprites (a filter: a light rim inside the outline)',
           '     --seeker-portrait-ink                         the accent ink behind a chat portrait on hover (a mask)',
           '   A box uses box-shadow: var(--seeker-shadow) and border-image: var(--seeker-shadow-image):',
           '   the smooth style draws with the first, the others with the second (a picture drawn',
           '   around the box, empty in the middle). */']
    for style, selector in (('dither', ':root'), ('gradient', ':root[data-seeker-edge="gradient"]'),
                            ('halftone', ':root[data-seeker-edge="halftone"]'), ('torn', ':root[data-seeker-edge="torn"]')):
        css.append(f'{selector} {{')
        css += [f'  {names[k]}: {v};' for k, v in tokens[style].items()]
        css.append('}')
    (ROOT / 'shadows.css').write_text('\n'.join(css) + '\n')

    # The patterns for the filters, one repeat each, as squares of black whose opacity is the
    # threshold: vector, not an image, since WebKit draws no image inside the pattern that the
    # filters take in (edge-style.js).
    def squares(values, unit):
        rects = []
        for y, row in enumerate(values):
            x = 0
            while x < len(row):
                run = 1
                while x + run < len(row) and row[x + run] == row[x]:
                    run += 1
                if row[x] > 0:
                    rects.append(f'<rect x="{x * unit:g}" y="{y * unit:g}" width="{run * unit:g}" height="{unit:g}" fill-opacity="{row[x]:.3g}"/>')
                x += run
        return ''.join(rects)
    dither = np.round(BAYER8, 3)
    halftone = np.round(halftone_map(HALFTONE_PITCH * S, HALFTONE_PITCH * S), 3)
    js = ['// Generated by scripts/shadows.py: do not edit by hand.',
          '// The patterns the shadow and rim filters (edge-style.js) threshold against: black squares',
          '// with the threshold as opacity. size is the repeat in CSS px.',
          f"export const DITHER_MAP = {{ size: {8 * DITHER_CELL}, squares: '{squares(dither, DITHER_CELL)}' }};",
          f"export const HALFTONE_MAP = {{ size: {HALFTONE_PITCH}, squares: '{squares(halftone, 1 / S)}' }};"]
    (ROOT / 'shadow-maps.js').write_text('\n'.join(js) + '\n')
    print('wrote shadows.css', round((ROOT / 'shadows.css').stat().st_size / 1024), 'KB and shadow-maps.js')


if __name__ == '__main__':
    main()
