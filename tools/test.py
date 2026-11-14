"""Runs Astrelle's checks: each tests/*.test.js in a browser of its own, several at once.

    python3 tools/test.py                  # all of them
    python3 tools/test.py compact split    # those whose names contain one of these words
    python3 tools/test.py -j 2             # at most two browsers at once (default 4)

A check is a script like the ones `dev.py js` runs (privileged, async, in a browser window): it
returns true when it passes, or an object {ok, ...} whose other fields say what it saw. Its first
line can ask for more time (// timeout: 60) or the dark look (// dark). Set ASTRELLE_UI to check
another copy of ui/.
"""
import argparse
import concurrent.futures
import glob
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(path):
    with open(path) as f:
        head = f.readline()
    match = re.search(r"timeout:\s*(\d+)", head)
    timeout = int(match.group(1)) if match else 30
    command = [sys.executable, os.path.join(ROOT, "tools", "dev.py"), "js", path, "--timeout", str(timeout)]
    if re.search(r"\bdark\b", head):
        command.append("--dark")
    started = time.time()
    try:
        done = subprocess.run(command, capture_output=True, text=True, timeout=timeout + 120)
    except subprocess.TimeoutExpired:
        return path, False, "timed out", time.time() - started
    output = done.stdout.strip()
    try:
        value = json.loads(output)
    except json.JSONDecodeError:
        return path, False, (output or done.stderr.strip())[-800:], time.time() - started
    if isinstance(value, str) and value.startswith("{"):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            pass
    ok = value is True or (isinstance(value, dict) and value.get("ok") is True)
    return path, ok, "" if value is True else value, time.time() - started


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("words", nargs="*")
    ap.add_argument("-j", type=int, default=4, help="browsers at once")
    args = ap.parse_args()
    paths = sorted(glob.glob(os.path.join(ROOT, "tests", "*.test.js")))
    if args.words:
        paths = [p for p in paths if any(w in os.path.basename(p) for w in args.words)]
    if not paths:
        sys.exit("No checks found")
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(args.j) as pool:
        for path, ok, detail, seconds in pool.map(run, paths):
            name = os.path.basename(path)
            print(f"{'pass' if ok else 'FAIL'}  {name}  ({seconds:.0f}s)")
            if not ok:
                failed += 1
                print("      " + json.dumps(detail)[:1500])
    print(f"\n{len(paths) - failed} of {len(paths)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
