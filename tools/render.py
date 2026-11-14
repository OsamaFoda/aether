"""Renders Astrelle in a real window and saves a screenshot: a real window draws the glass blur,
which a hidden (headless) one doesn't. Each run gets its own X display (a rootful Xwayland window
on the desktop), browser profile and Marionette port, so several can run at once.

    python3 tools/render.py out.png                       # the new tab page, light
    python3 tools/render.py out.png --dark --setup s.js   # run s.js in the browser window first
    python3 tools/render.py out.png --crop 640x400+0+0    # just part of the window

s.js runs like `dev.py js` (privileged, async, `return` a value, which is printed).
"""
import argparse
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dev  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--setup", help="JS file to run in the browser window before the screenshot")
    ap.add_argument("--dark", action="store_true", help="dark mode (default: light)")
    ap.add_argument("--size", default="1280x800")
    ap.add_argument("--crop", help="ImageMagick geometry, e.g. 640x400+0+0")
    ap.add_argument("--wait", type=float, default=2, help="seconds to wait after the setup")
    ap.add_argument("--timeout", type=float, default=60, help="seconds the setup may run")
    args = ap.parse_args()
    width, height = (int(n) for n in args.size.split("x"))

    # Xwayland picks a free display itself and says which on the pipe.
    read_end, write_end = os.pipe()
    xserver = subprocess.Popen(["Xwayland", "-displayfd", str(write_end), "-geometry", args.size, "-noreset"],
                               pass_fds=(write_end,), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.close(write_end)
    try:
        number = b""
        while not number.endswith(b"\n"):
            chunk = os.read(read_end, 16)
            if not chunk:
                sys.exit("Xwayland didn't start")
            number += chunk
        display = ":" + number.decode().strip()
        os.environ.update(DISPLAY=display, GDK_BACKEND="x11", MOZ_ENABLE_WAYLAND="0")
        os.environ.pop("WAYLAND_DISPLAY", None)

        proc, m = dev.start(width, height, dark=args.dark, show=True)
        try:
            time.sleep(2)
            if args.setup:
                with open(args.setup) as f:
                    result = m.js(f.read(), args.timeout)
                if result is not None:
                    print(json.dumps(result, indent=2))
            time.sleep(args.wait)
            crop = ["-crop", args.crop] if args.crop else []
            subprocess.run(["import", "-display", display, "-window", "root", *crop, args.out], check=True)
            print(args.out)
        finally:
            dev.stop(proc)
    finally:
        os.close(read_end)
        xserver.terminate()
        try:
            xserver.wait(10)
        except subprocess.TimeoutExpired:
            xserver.kill()


if __name__ == "__main__":
    main()
