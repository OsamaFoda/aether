"""Drives a local Astrelle (or Firefox ESR with ui/ linked in) for development checks.

Starts the browser headless with a throwaway profile over Marionette, then:

    python3 tools/dev.py check            # is the interface layer loaded? settings applied?
    python3 tools/dev.py shot out.png     # screenshot of a browser window
    python3 tools/dev.py js file.js       # run privileged JS in the browser window, print result

The browser defaults to ~/Applications/astrelle, falling back to ~/Applications/firefox-esr153.
Set AETHER_BIN to use another one. The page shown defaults to the new tab page; pass --url.
Each run gets its own throwaway profile and Marionette port, so several can run at once.
Set ASTRELLE_UI to a ui/ folder (say, in a git worktree) to test that copy of the interface.
"""
import argparse
import base64
import fcntl
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

PROFILES = os.path.expanduser("~/.cache")
# At most this many test browsers at once, however many runs are started (each takes ~0.5 GB).
SLOTS = int(os.environ.get("ASTRELLE_DEV_SLOTS", "6"))


def take_slot():
    """Waits for one of the SLOTS browser slots; it's free again when the lock file is closed
    (or this process ends)."""
    folder = os.path.join(PROFILES, "astrelle-dev-slots")
    os.makedirs(folder, exist_ok=True)
    while True:
        for i in range(SLOTS):
            lock = open(os.path.join(folder, f"{i}.lock"), "w")
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return lock
            except BlockingIOError:
                lock.close()
        time.sleep(0.5)


def find_browser():
    if os.environ.get("AETHER_BIN"):
        return os.environ["AETHER_BIN"]
    for path in ("~/Applications/astrelle/aether", "~/Applications/firefox-esr153/firefox"):
        path = os.path.expanduser(path)
        if os.path.exists(path):
            return path
    sys.exit("No browser found; set AETHER_BIN")


class Marionette:
    def __init__(self, port):
        for _ in range(60):
            try:
                self.sock = socket.create_connection(("127.0.0.1", port))
                break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError("browser did not open Marionette")
        self.buf = b""
        self.msg_id = 0
        self._read()

    def _read(self):
        while b":" not in self.buf:
            self.buf += self.sock.recv(65536)
        length, rest = self.buf.split(b":", 1)
        length = int(length)
        while len(rest) < length:
            rest += self.sock.recv(65536)
        self.buf = rest[length:]
        return json.loads(rest[:length])

    def call(self, name, params=None):
        self.msg_id += 1
        data = json.dumps([0, self.msg_id, name, params or {}]).encode()
        self.sock.sendall(b"%d:%s" % (len(data), data))
        while True:
            msg = self._read()
            if msg[0] == 1 and msg[1] == self.msg_id:
                if msg[2]:
                    raise RuntimeError(f"{name}: {msg[2].get('message', msg[2])}")
                return msg[3]

    def js(self, script, timeout=30):
        """Runs async privileged JS in the browser window; `return` its result.
        Use window.Services: Marionette's own sandbox has only a partial Services."""
        wrapped = f"const done = arguments[arguments.length - 1]; (async () => {{ {script} }})().then(done, e => done('ERROR: ' + e + '\\n' + e.stack));"
        return self.call("WebDriver:ExecuteAsyncScript", {"script": wrapped, "args": [], "scriptTimeout": int(timeout * 1000)})["value"]


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start(width=1280, height=800, dark=None, show=False):
    slot = take_slot()
    profile = tempfile.mkdtemp(prefix="astrelle-dev-", dir=PROFILES)
    port = free_port()
    with open(os.path.join(profile, "user.js"), "w") as f:
        f.write(f'user_pref("marionette.port", {port});\n')
        if dark is not None:
            f.write(f'user_pref("ui.systemUsesDarkTheme", {1 if dark else 0});\n')
    # Its own XDG data folder, so a test run never repoints the real desktop launcher's icon.
    env = dict(os.environ, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS="1", XDG_DATA_HOME=os.path.join(profile, "xdg-data"))
    proc = subprocess.Popen(
        [find_browser(), *([] if show else ["--headless"]), "--marionette", "--no-remote", "-purgecaches",
         "--profile", profile, "--width", str(width), "--height", str(height)],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    proc.profile = profile
    proc.slot = slot
    try:
        m = Marionette(port)
    except Exception:
        stop(proc)
        raise
    m.call("WebDriver:NewSession", {"capabilities": {}})
    m.call("Marionette:SetContext", {"value": "chrome"})
    # Firefox stripes the address bar while it's remote-controlled; hide that from screenshots.
    m.js("document.documentElement.removeAttribute('remotecontrol'); return true;")
    return proc, m


def stop(proc):
    proc.terminate()
    try:
        proc.wait(10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(10)
    shutil.rmtree(proc.profile, ignore_errors=True)
    proc.slot.close()


CHECK = """
const Services = window.Services;
const reg = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
let ui;
try { ui = reg.convertChromeURL(Services.io.newURI("chrome://aether/content/boot.sys.mjs")).spec; }
catch (e) { ui = "NOT REGISTERED: " + e; }
// Firefox 153 moved the search service out of Services into its own module.
const { SearchService } = ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs");
await SearchService.init();
return {
  interfaceLayer: ui,
  verticalTabs: Services.prefs.getBoolPref("sidebar.verticalTabs", false),
  newTabsAtEnd: !Services.prefs.getBoolPref("browser.tabs.insertAfterCurrent", true),
  unsignedAddonsAllowed: !Services.prefs.getBoolPref("xpinstall.signatures.required", true),
  searchEngine: (await SearchService.getDefault()).name,
  policies: Services.policies.status === Services.policies.ACTIVE ? Object.keys(Services.policies.getActivePolicies()) : "inactive",
  browser: Services.appinfo.name + " " + Services.appinfo.version,
};
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["check", "shot", "js"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--url", default="about:newtab")
    ap.add_argument("--wait", type=float, default=2)
    ap.add_argument("--timeout", type=float, default=30, help="seconds a js file may run")
    ap.add_argument("--dark", action="store_true", help="dark mode (default: light)")
    ap.add_argument("--before", help="JS file to run in the browser window before a screenshot")
    ap.add_argument("--show", action="store_true",
                    help="open a real window instead of a hidden one (hidden windows don't draw glass blur)")
    args = ap.parse_args()

    proc, m = start(dark=args.dark, show=args.show)
    try:
        m.js(f"gBrowser.selectedBrowser.fixupAndLoadURIString({json.dumps(args.url)}, "
             "{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); return true;")
        time.sleep(args.wait)
        if args.command == "check":
            print(json.dumps(m.js(CHECK), indent=2))
        elif args.command == "shot":
            if args.before:
                with open(args.before) as f:
                    m.js(f.read())
                time.sleep(1)
            png = m.call("WebDriver:TakeScreenshot", {"full": False, "hash": False})["value"]
            with open(args.arg, "wb") as f:
                f.write(base64.b64decode(png))
            print(args.arg)
        elif args.command == "js":
            with open(args.arg) as f:
                print(json.dumps(m.js(f.read(), args.timeout), indent=2))
    finally:
        stop(proc)


if __name__ == "__main__":
    main()
