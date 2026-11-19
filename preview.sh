#!/usr/bin/env bash
# Quick launcher to preview the Touchpad Gestures Pro preferences window directly
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GI_TYPELIB_PATH="/usr/lib/gnome-shell/girepository-1.0:$GI_TYPELIB_PATH"
gjs -m "$DIR/preview_prefs.js" "$@"
