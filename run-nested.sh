#!/usr/bin/env bash
set -euo pipefail

UUID="touchpad-gestures@sharunkrish.github.io"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_dir=$(mktemp -d)
trap 'rm -rf -- "$test_dir"' EXIT

# Use temporary extension files and settings for the nested shell.
export XDG_DATA_HOME="$test_dir/data"
export XDG_CONFIG_HOME="$test_dir/config"
export GSETTINGS_BACKEND=keyfile
"$SRC_DIR/install.sh"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell enabled-extensions "['$UUID']"

shell_help=$(gnome-shell --help)
wrapper=()
if [[ "$shell_help" == *--devkit* ]]; then
    shell_args=(--devkit)
    local_devkit="$HOME/.local/libexec/mutter-devkit"
    if [[ ! -x /usr/libexec/mutter-devkit && -x "$local_devkit" ]] && command -v bwrap >/dev/null; then
        original_libexec="$test_dir/libexec-original"
        overlay_libexec="$test_dir/libexec-overlay"
        mkdir -p "$original_libexec" "$overlay_libexec"
        for helper in /usr/libexec/*; do
            name=${helper##*/}
            ln -s "$original_libexec/$name" "$overlay_libexec/$name"
        done
        ln -sf "$local_devkit" "$overlay_libexec/mutter-devkit"
        wrapper=(bwrap --dev-bind / / --ro-bind /usr/libexec "$original_libexec"
            --ro-bind "$overlay_libexec" /usr/libexec)
    fi
else
    export MUTTER_DEBUG_DUMMY_MODE_SPECS=1280x720
    shell_args=(--nested --wayland)
fi

dbus-run-session -- "${wrapper[@]}" gnome-shell "${shell_args[@]}"
