#!/usr/bin/env bash
set -euo pipefail

UUID="touchpad-gestures@sharunkrish.github.io"
EXT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v glib-compile-schemas >/dev/null 2>&1; then
    echo 'Install glib-compile-schemas before running this installer.' >&2
    exit 1
fi

mkdir -p "$EXT_DIR/src" "$EXT_DIR/schemas"
cp "$SRC_DIR"/{metadata.json,extension.js,prefs.js,stylesheet.css,LICENSE} "$EXT_DIR/"
cp "$SRC_DIR"/src/*.js "$EXT_DIR/src/"
cp "$SRC_DIR"/schemas/*.gschema.xml "$EXT_DIR/schemas/"
glib-compile-schemas --strict "$EXT_DIR/schemas"

echo "Installed files in $EXT_DIR"
echo 'If GNOME Shell needs to load the new files, sign out and back in.'
echo "Enable Touchpad Gestures Pro in the Extensions app or run: gnome-extensions enable $UUID"
