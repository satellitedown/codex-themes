#!/bin/bash
# Installs or updates Codex Themes, animated wallpapers for Codex on macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/satellitedown/codex-themes/master/install.sh | bash
#
# Run it again to update. Options go after `bash -s --` when piped, e.g.
#   curl -fsSL …/install.sh | bash -s -- --uninstall
set -euo pipefail

REPO="satellitedown/codex-themes"
NAME="Codex Themes.app"
CODEX_ID="com.openai.codex"

usage() {
  cat <<EOF
Usage: install.sh [options]

Installs or updates Codex Themes from the latest GitHub release.

  --version vX.Y.Z  install that release instead of the latest
  --zip FILE        install a local build (scripts/build-app.sh makes dist/Codex-Themes.zip)
  --no-open         don't open Codex Themes afterwards
  --uninstall       remove Codex Themes
  -h, --help        show this help
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

version=latest
zip=""
open_app=1
uninstall=0
while (($#)); do
  case "$1" in
    --version) version="${2:?--version needs a release tag, e.g. v0.1.0}"; shift ;;
    --zip) zip="${2:?--zip needs a file}"; shift ;;
    --no-open) open_app=0 ;;
    --uninstall) uninstall=1 ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option $1 (see --help)" ;;
  esac
  shift
done

[[ "$(uname -s)" == Darwin ]] || die "Codex Themes runs on macOS only."
(("$(sw_vers -productVersion | cut -d. -f1)" >= 13)) || die "Codex Themes needs macOS 13 or later."

# Where Codex Themes is installed, if anywhere.
installed_app() {
  local dir
  for dir in /Applications "$HOME/Applications"; do
    if [[ -d "$dir/$NAME" ]]; then
      echo "$dir/$NAME"
      return
    fi
  done
}

# Codex ships inside the ChatGPT desktop app, which keeps the Codex app's bundle id.
codex_installed() {
  mdfind "kMDItemCFBundleIdentifier == '$CODEX_ID'" 2>/dev/null | grep -q . && return 0
  local app
  for app in /Applications/*.app "$HOME/Applications"/*.app; do
    [[ "$(defaults read "$app/Contents/Info" CFBundleIdentifier 2>/dev/null)" == "$CODEX_ID" ]] && return 0
  done
  return 1
}

if ((uninstall)); then
  pkill -x CodexThemes 2>/dev/null || true
  target="$(installed_app)"
  [[ -n "$target" ]] || { echo "Codex Themes isn't installed."; exit 0; }
  rm -rf "$target" "$HOME/Library/Logs/CodexThemes.log"
  echo "✓ removed $target"
  echo "  Codex keeps the wallpaper in open windows until you quit and reopen it."
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [[ -z "$zip" ]]; then
  if [[ "$version" == latest ]]; then
    url="https://github.com/$REPO/releases/latest/download/Codex-Themes.zip"
  else
    url="https://github.com/$REPO/releases/download/$version/Codex-Themes.zip"
  fi
  echo "› downloading $url"
  curl -fL --progress-bar "$url" -o "$work/Codex-Themes.zip" || die "download failed"
  zip="$work/Codex-Themes.zip"
fi
[[ -f "$zip" ]] || die "no such file: $zip"

ditto -x -k "$zip" "$work/unpacked" || die "couldn't unpack $zip"
app="$work/unpacked/$NAME"
[[ -x "$app/Contents/MacOS/CodexThemes" ]] || die "$zip doesn't contain $NAME"

# Update in place; new installs go to /Applications, or ~/Applications without write access.
target="$(installed_app)"
if [[ -z "$target" ]]; then
  dest=/Applications
  if [[ ! -w "$dest" ]]; then
    dest="$HOME/Applications"
    mkdir -p "$dest"
  fi
  target="$dest/$NAME"
fi

pkill -x CodexThemes 2>/dev/null || true
rm -rf "$target"
ditto "$app" "$target"
# Not notarized: make sure no quarantine flag (from a browser download) blocks the first launch.
xattr -dr com.apple.quarantine "$target" 2>/dev/null || true
echo "✓ installed $target ($(defaults read "$target/Contents/Info" CFBundleShortVersionString))"

if ! codex_installed; then
  echo "! Codex isn't installed. Get the ChatGPT desktop app, which includes Codex:"
  echo "  https://chatgpt.com/features/desktop/ — then open Codex Themes."
  exit 0
fi

echo "  Open Codex through Codex Themes from now on: it starts Codex with wallpapers."
echo "  Pick one at the bottom of the sidebar, type /theme in a chat, or press ⌘⌥T."
if ((open_app)); then
  echo "  Opening it now. If Codex is already running, it asks to restart Codex once."
  open "$target"
fi
