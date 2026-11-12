#!/usr/bin/env bash
# Puts Aether's interface layer (ui/) into an installed or unpacked Aether.
#
#   scripts/install_ui.sh <install-dir>          copy (what release builds ship)
#   scripts/install_ui.sh <install-dir> --link   link to this checkout, for live editing
set -euo pipefail

INSTALL="$1"
MODE="${2:-copy}"
UI="$(cd "$(dirname "$0")/../ui" && pwd)"
test -f "$INSTALL/application.ini" || { echo "Not an Aether install: $INSTALL" >&2; exit 1; }

if [ "$MODE" = --link ]; then put() { rm -rf "$2"; ln -s "$1" "$2"; } else put() { rm -rf "$2"; cp -a "$1" "$2"; } fi

mkdir -p "$INSTALL/defaults/pref" "$INSTALL/distribution"
put "$UI/autoconfig.js" "$INSTALL/defaults/pref/autoconfig.js"
put "$UI/aether.cfg" "$INSTALL/aether.cfg"
put "$UI/policies.json" "$INSTALL/distribution/policies.json"
put "$UI" "$INSTALL/aether-ui"

# Built-in add-ons (Sip). Firefox installs these into each profile on first run.
mkdir -p "$INSTALL/distribution/extensions"
cp "$UI"/extensions/*.xpi "$INSTALL/distribution/extensions/"
