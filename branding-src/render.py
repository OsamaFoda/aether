"""Renders Aether's branding from orb.svg ("Celestial Nebula Orb") into ../branding/,
using the same file names and sizes as Firefox's own branding folder, which they replace.

    python3 branding-src/render.py
"""
import os
import shutil

import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf

HERE = os.path.dirname(os.path.abspath(__file__))
ORB = os.path.join(HERE, "orb.svg")
OUT = os.path.join(HERE, "..", "branding")

# Firefox branding file -> square size in pixels.
SQUARE = {f"default{s}.png": s for s in (16, 22, 24, 32, 48, 64, 128, 256)}
SQUARE.update({
    "content/about-logo.png": 192,
    "content/about-logo@2x.png": 384,
    "content/about-logo-private.png": 192,
    "content/about-logo-private@2x.png": 384,
})

# The name as drawn in the About window. Same 372x99 canvas as Firefox's wordmarks.
WORDMARK = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 372 99"{fill}>
  <text x="186" y="74" text-anchor="middle" font-family="system-ui, sans-serif"
        font-size="80" font-weight="600" letter-spacing="2">Aether</text>
</svg>
"""


def orb(size):
    return GdkPixbuf.Pixbuf.new_from_file_at_size(ORB, size, size)


def save(pixbuf, name):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pixbuf.savev(path, "png", [], [])


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    for name, size in SQUARE.items():
        save(orb(size), name)

    # about.png is 300x236: the orb centred on a transparent canvas.
    canvas = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, True, 8, 300, 236)
    canvas.fill(0x00000000)
    small = orb(236)
    small.copy_area(0, 0, 236, 236, canvas, 32, 0)
    save(canvas, "content/about.png")

    shutil.copy(ORB, os.path.join(OUT, "content/about-logo.svg"))
    with open(os.path.join(OUT, "content/about-wordmark.svg"), "w") as f:
        f.write(WORDMARK.format(fill=' fill="#fff"'))
    with open(os.path.join(OUT, "content/firefox-wordmark.svg"), "w") as f:
        f.write(WORDMARK.format(fill=' fill="context-fill #20123a"'))


if __name__ == "__main__":
    main()
