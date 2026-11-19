#!/usr/bin/env bash
set -euo pipefail

src_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
schema_dir=$(mktemp -d)
trap 'rm -f -- "$schema_dir/gschemas.compiled"; rmdir -- "$schema_dir"' EXIT

glib-compile-schemas --strict --targetdir="$schema_dir" "$src_dir/schemas"
export GI_TYPELIB_PATH="/usr/lib/gnome-shell/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
GSETTINGS_BACKEND=memory GSETTINGS_SCHEMA_DIR="$schema_dir" gjs -m "$src_dir/preview_prefs.js" "$@"
