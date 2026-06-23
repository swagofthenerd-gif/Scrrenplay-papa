#!/usr/bin/env bash
# Build ScrivenLight for macOS.
# Produces:
#   dist/ScrivenLight.app            (the app bundle)
#   dist/ScrivenLight-mac.dmg        (installable disk image)
#   dist/ScrivenLight-mac-portable.zip (portable — unzip and run anywhere)
#
# Requirements: macOS, Python 3.9+ (python.org build or Homebrew).
# Run from the project root:  bash build_macos.sh
set -euo pipefail

APP_NAME="ScrivenLight"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "==> [1/5] Creating an isolated build environment"
python3 -m venv .build-venv
source .build-venv/bin/activate
python -m pip install --upgrade pip wheel >/dev/null
echo "==> Installing dependencies (PyQt6, reportlab, pyinstaller)…"
pip install PyQt6 reportlab pyinstaller >/dev/null

echo "==> [2/5] Generating the .icns app icon from PNG"
if [ -f scrivenlight_1024.png ]; then
    ICONSET="scrivenlight.iconset"
    rm -rf "$ICONSET"; mkdir "$ICONSET"
    sips -z 16 16     scrivenlight_1024.png --out "$ICONSET/icon_16x16.png"      >/dev/null
    sips -z 32 32     scrivenlight_1024.png --out "$ICONSET/icon_16x16@2x.png"   >/dev/null
    sips -z 32 32     scrivenlight_1024.png --out "$ICONSET/icon_32x32.png"      >/dev/null
    sips -z 64 64     scrivenlight_1024.png --out "$ICONSET/icon_32x32@2x.png"   >/dev/null
    sips -z 128 128   scrivenlight_1024.png --out "$ICONSET/icon_128x128.png"    >/dev/null
    sips -z 256 256   scrivenlight_1024.png --out "$ICONSET/icon_128x128@2x.png" >/dev/null
    sips -z 256 256   scrivenlight_1024.png --out "$ICONSET/icon_256x256.png"    >/dev/null
    sips -z 512 512   scrivenlight_1024.png --out "$ICONSET/icon_256x256@2x.png" >/dev/null
    sips -z 512 512   scrivenlight_1024.png --out "$ICONSET/icon_512x512.png"    >/dev/null
    cp scrivenlight_1024.png "$ICONSET/icon_512x512@2x.png"
    iconutil -c icns "$ICONSET" -o scrivenlight.icns
    rm -rf "$ICONSET"
    echo "    created scrivenlight.icns"
else
    echo "    WARNING: scrivenlight_1024.png missing; building without a custom icon"
fi

echo "==> [3/5] Building the .app bundle with PyInstaller"
rm -rf build dist
pyinstaller scrivenlight.spec --noconfirm

if [ ! -d "dist/${APP_NAME}.app" ]; then
    echo "ERROR: build failed — dist/${APP_NAME}.app not found"; exit 1
fi
echo "    built dist/${APP_NAME}.app"

echo "==> [4/5] Creating portable zip"
( cd dist && zip -r -q "${APP_NAME}-mac-portable.zip" "${APP_NAME}.app" )
echo "    wrote dist/${APP_NAME}-mac-portable.zip"

echo "==> [5/5] Creating installable .dmg"
DMG="dist/${APP_NAME}-mac.dmg"
STAGING="$(mktemp -d)"
cp -R "dist/${APP_NAME}.app" "$STAGING/"
ln -s /Applications "$STAGING/Applications"   # drag-to-install affordance
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGING" \
    -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGING"
echo "    wrote $DMG"

deactivate
echo ""
echo "✓ Done. In dist/ you now have:"
echo "    ${APP_NAME}.app                  — the app (double-click to run)"
echo "    ${APP_NAME}-mac.dmg             — installer (open, drag to Applications)"
echo "    ${APP_NAME}-mac-portable.zip    — portable (unzip and run anywhere)"
echo ""
echo "NOTE on Gatekeeper: this build is unsigned, so the first launch needs"
echo "  right-click ▸ Open  (or System Settings ▸ Privacy & Security ▸ Open Anyway)."
echo "  To distribute without that step you'd need an Apple Developer ID to sign"
echo "  and notarize. See PACKAGING.md."
