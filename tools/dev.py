"""Drives a local Aether (or Firefox ESR with ui/ linked in) for development checks.

Starts the browser headless with a throwaway profile over Marionette, then:

    python3 tools/dev.py check            # is the interface layer loaded? settings applied?
    python3 tools/dev.py shot out.png     # screenshot of a browser window
    python3 tools/dev.py js file.js       # run privileged JS in the browser window, print result

The browser defaults to ~/Applications/aether, falling back to ~/Applications/firefox-esr153.
Set AETHER_BIN to use another one. The page shown defaults to the new tab page; pass --url.
"""
import argparse
import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import time

PROFILE = os.path.expanduser("~/.cache/aether-dev-profile")
PORT = 2830


def find_browser():
    if os.environ.get("AETHER_BIN"):
        return os.environ["AETHER_BIN"]
    for path in ("~/Applications/aether/aether", "~/Applications/firefox-esr153/firefox"):
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

    def js(self, script):
        """Runs async privileged JS in the browser window; `return` its result.
        Use window.Services: Marionette's own sandbox has only a partial Services."""
        wrapped = f"const done = arguments[arguments.length - 1]; (async () => {{ {script} }})().then(done, e => done('ERROR: ' + e + '\\n' + e.stack));"
        return self.call("WebDriver:ExecuteAsyncScript", {"script": wrapped, "args": [], "scriptTimeout": 30000})["value"]


def start(width=1280, height=800, dark=None, show=False):
    shutil.rmtree(PROFILE, ignore_errors=True)
    os.makedirs(PROFILE)
    with open(os.path.join(PROFILE, "user.js"), "w") as f:
        f.write(f'user_pref("marionette.port", {PORT});\n')
        if dark is not None:
            f.write(f'user_pref("ui.systemUsesDarkTheme", {1 if dark else 0});\n')
    env = dict(os.environ, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS="1")
    proc = subprocess.Popen(
        [find_browser(), *([] if show else ["--headless"]), "--marionette", "--no-remote", "-purgecaches",
         "--profile", PROFILE, "--width", str(width), "--height", str(height)],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    m = Marionette(PORT)
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
    shutil.rmtree(PROFILE, ignore_errors=True)


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
                print(json.dumps(m.js(f.read()), indent=2))
    finally:
        stop(proc)


if __name__ == "__main__":
    main()
