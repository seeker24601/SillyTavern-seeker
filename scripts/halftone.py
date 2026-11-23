# Draws the dither mask (style.css, "The halftone") and writes it into style.css as a lossless
# WebP in a data URI. Usage: python3 scripts/halftone.py style.css   (needs numpy and Pillow)
#
# A fine ordered dither, as on old screens: the band is a grid of small square cells, and a
# cell is inked when the tone there beats its threshold in a repeating 8 x 8 (Bayer) pattern.
# The tone rises from nothing at the far end to solid at the column, pushed around by slow
# cloud noise so the edge billows rather than running straight, and a little grain loosens the
# pattern. Far cells are faint as well as sparse. The coverage is in the image's alpha channel.
# The image is a tile at twice CSS size: it repeats down the stage and is never scaled.
import base64, io, sys
import numpy as np
from PIL import Image
CELL = 2                    # cell size, CSS px
BAND, TILE = 128, 1024      # the tile in CSS px; both multiples of 8 * CELL
rng = np.random.default_rng(5)
gw, gh = BAND // CELL, TILE // CELL
def sstep(a, b, v): v = np.clip((v - a) / (b - a), 0, 1); return v * v * (3 - 2 * v)
def bayer(n):
    if n == 1: return np.zeros((1, 1))
    b = bayer(n // 2); return np.block([[4 * b, 4 * b + 2], [4 * b + 3, 4 * b + 1]])
def clouds():               # slow noise that wraps top to bottom, about -1..1
    fy = np.fft.fftfreq(gh)[:, None] * gh; fx = np.fft.fftfreq(2 * gw)[None, :] * 2 * gw
    spec = np.fft.fft2(rng.normal(size=(gh, 2 * gw))) / (1 + (fy / 2.2) ** 2 + (fx / 2.2) ** 2) ** 1.3
    n = np.real(np.fft.ifft2(spec))[:, :gw]; return (n - n.mean()) / n.std() / 2
y, x = np.mgrid[0:gh, 0:gw]
u = (x + 0.5) / gw                                         # 0 at the far end .. 1 at the column
tone = 1.10 * u ** 2.1 + 0.26 * clouds() * np.sin(np.pi * u) ** 0.8
thr = (bayer(8)[y % 8, x % 8] + 0.5) / 64 + rng.normal(0, 0.05, (gh, gw))
on = tone > thr
ink = 0.16 + 0.84 * u ** 1.6                               # cells darken steadily; full ink only at the column
alpha = np.where(on, ink, 0.0); alpha[:, -2:] = 1
a = np.kron(alpha, np.ones((2 * CELL, 2 * CELL)))
img = Image.fromarray(np.dstack([np.zeros(a.shape + (3,)), a * 255]).astype("uint8"))
buf = io.BytesIO(); img.save(buf, "WEBP", lossless=True, quality=100, method=6)
if len(sys.argv) > 2: img.save(sys.argv[2])
uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
block = f""":root {{
  --seeker-halftone-image: linear-gradient(#000, #000), url("{uri}");
  --seeker-halftone-position: right top, right calc(var(--seeker-halftone-solid) - 1px) top 0;
  --seeker-halftone-size: var(--seeker-halftone-solid) 100%, {BAND}px {TILE}px;
  --seeker-halftone-repeat: no-repeat, repeat-y;
}}
"""
p = sys.argv[1]; css = open(p).read()
i = css.index(":root {\n  --seeker-halftone-image:"); e = css.index("}\n", i) + 2
open(p, "w").write(css[:i] + block + css[e:])
print(len(buf.getvalue()) // 1024, "KB image")
