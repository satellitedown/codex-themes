#!/usr/bin/env bash
# Builds "Codex Themes.app" (universal, ad-hoc signed) into dist/, plus
# dist/Codex-Themes.zip: the release asset that install.sh downloads, or
# installs locally with `./install.sh --zip dist/Codex-Themes.zip`.
#
# Requires macOS with Node.js 22+ and the Xcode Command Line Tools (swiftc).
set -euo pipefail

cd "$(dirname "$0")/.."

command -v node >/dev/null || { echo "error: Node.js 22+ is required (https://nodejs.org)" >&2; exit 1; }
command -v swiftc >/dev/null || { echo "error: swiftc not found; run: xcode-select --install" >&2; exit 1; }

echo "› building theme bundle"
npm ci --no-audit --no-fund --silent
npm run --silent build

VERSION="$(node -p "require('./package.json').version")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
APP="dist/Codex Themes.app"
rm -rf "$APP" dist/Codex-Themes.zip
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "› compiling launcher (arm64 + x86_64)"
for arch in arm64 x86_64; do
  swiftc -O -swift-version 5 -target "$arch-apple-macos13" macos/CodexThemes.swift -o "$WORK/CodexThemes-$arch"
done
lipo -create "$WORK/CodexThemes-arm64" "$WORK/CodexThemes-x86_64" -output "$APP/Contents/MacOS/CodexThemes"

sed "s/__VERSION__/$VERSION/g" macos/Info.plist > "$APP/Contents/Info.plist"
cp dist/codex-themes.js "$APP/Contents/Resources/codex-themes.js"

echo "› building icon"
ICONSET="$WORK/AppIcon.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" macos/AppIcon.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" macos/AppIcon.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

# Ad-hoc signature only (no Developer ID / notarization). install.sh fetches
# the zip with curl, which doesn't quarantine it, so Gatekeeper lets it open.
codesign --force --sign - "$APP" >/dev/null

ditto -c -k --keepParent "$APP" dist/Codex-Themes.zip
echo "✓ built $APP ($VERSION) and dist/Codex-Themes.zip"
