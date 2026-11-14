#!/usr/bin/env bash
# Opens the development Astrelle on your desktop: the interface layer comes live from ui/,
# in its own profile (~/.aether-dev), so it never touches Zen or another browser.
# After editing anything in ui/, close it and run this again.
set -euo pipefail
for BIN in ~/Applications/aether/aether ~/Applications/firefox-esr153/firefox; do
  [ -x "$BIN" ] && break
done
[ -x "$BIN" ] || { echo "No Astrelle or Firefox ESR found in ~/Applications" >&2; exit 1; }
mkdir -p ~/.aether-dev
exec "$BIN" --no-remote --profile ~/.aether-dev -purgecaches "$@"
