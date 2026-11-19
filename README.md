# Touchpad Gestures Pro

Customize touchpad gestures in GNOME Shell on Wayland. Assign actions by finger count and direction in the extension preferences.

- **Three- and four-finger swipes** can switch workspaces, cycle recent windows, tile windows, switch browser tabs, and adjust volume or brightness.
- **Two-, three-, and four-finger pinches** can trigger actions such as opening a tab, taking a screenshot, or toggling Quick Settings. Two-finger pinch actions are off by default so apps can handle pinch-to-zoom.
- **Native gestures** remain available for supported mappings such as Overview and linear workspace switching.

## Install from source

You’ll need a GNOME Shell Wayland session, a touchpad that reports the gestures you want to use, and `glib-compile-schemas` from GLib. The extension metadata targets GNOME Shell 45–51. Gesture handling depends on GNOME Shell internals and can vary by version and hardware.

```bash
git clone https://github.com/SharunKrish/touchpad-gestures.git
cd touchpad-gestures
./install.sh
```

Disable other touchpad gesture extensions if they handle the same gestures. If GNOME Shell hasn’t discovered the extension yet, sign out and back in, then enable **Touchpad Gestures Pro** in the Extensions app. Open preferences there or run:

```bash
gnome-extensions prefs touchpad-gestures@sharunkrish.github.io
```

## Report bugs and contribute

Include your GNOME Shell version (`gnome-shell --version`), distribution, touchpad model, gesture configuration, and steps to reproduce. For gesture conflicts, mention any other enabled gesture extensions. Pull requests are welcome.

Distributed under the [GNU General Public License, version 3](LICENSE).
