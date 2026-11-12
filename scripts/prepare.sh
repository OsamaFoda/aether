#!/usr/bin/env bash
# Downloads a Firefox ESR source release, checks it against Mozilla's published checksums,
# and turns it into our browser's source tree in ./src: our files copied over, patches applied.
#
#   scripts/prepare.sh 153.7.0esr
set -euo pipefail

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/release.env"
BASE="https://archive.mozilla.org/pub/firefox/releases/$VERSION"
TARBALL="firefox-$VERSION.source.tar.xz"

cd "$ROOT"
curl -fsSL --retry 3 -o "$TARBALL" "$BASE/source/$TARBALL"
curl -fsSL --retry 3 "$BASE/SHA512SUMS" \
  | awk -v f="source/$TARBALL" '$2 == f { print $1 "  '"$TARBALL"'" }' > "$TARBALL.sha512"
test -s "$TARBALL.sha512" || { echo "No checksum published for $TARBALL" >&2; exit 1; }
sha512sum -c "$TARBALL.sha512"

rm -rf src
mkdir src
tar -xf "$TARBALL" -C src --strip-components=1
rm "$TARBALL" "$TARBALL.sha512"

# Our own files (branding, interface styles) go in overlay/ at the paths they take in Firefox.
cp -a overlay/. src/
rm -f src/.gitkeep

for patch in patches/*.patch; do
  [ -e "$patch" ] || continue
  echo "Applying $patch"
  patch -d src -p1 --forward --batch < "$patch"
done

# Branding: start from Firefox's unofficial branding (which calls itself "Nightly") and rename it.
# Checked here, before any compiling, so a mistake costs minutes rather than a whole build.
BRAND=src/browser/branding/$APP_NAME
BRAND_TEXT=(configure.sh locales/en-US/brand.ftl locales/en-US/brand.properties)
rm -rf "$BRAND"
cp -a src/browser/branding/unofficial "$BRAND"
for f in "${BRAND_TEXT[@]}"; do
  test -f "$BRAND/$f" || { echo "Branding file missing: $f" >&2; exit 1; }
  sed -i "s/Nightly/$DISPLAY_NAME/g" "$BRAND/$f"
  if grep -q Nightly "$BRAND/$f"; then echo "Still says Nightly: $f" >&2; exit 1; fi
done
grep -q "MOZ_APP_DISPLAYNAME=$DISPLAY_NAME" "$BRAND/configure.sh" \
  || { echo "Display name not set in configure.sh" >&2; exit 1; }

# Our icons and wordmarks (branding/, made by branding-src/render.py) replace Firefox's file for
# file. A name Firefox doesn't use would be silently ignored, so treat it as a mistake.
while IFS= read -r f; do
  test -f "$BRAND/$f" || { echo "Not a Firefox branding file: $f" >&2; exit 1; }
  cp "branding/$f" "$BRAND/$f"
done < <(cd branding && find . -type f -printf '%P\n')

cp mozconfig src/mozconfig
echo "ac_add_options --with-app-name=$APP_NAME" >> src/mozconfig
echo "ac_add_options --with-branding=browser/branding/$APP_NAME" >> src/mozconfig
