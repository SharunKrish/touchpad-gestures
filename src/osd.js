import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Universal OSD helper compatible with GNOME 45-47 and GNOME 48-51+.
 * In GNOME 50+, Main.osdWindowManager.showAll(icon, label, level, maxLevel)
 * or show(icon, label, levels) is used.
 * In GNOME 45-47, Main.osdWindowManager.show(-1, icon, label, level, maxLevel) was used.
 */
export function showOsd(iconOrName, label = null, level = null, maxLevel = 1.0) {
    if (!Main.osdWindowManager) return;

    let icon = null;
    if (typeof iconOrName === 'string') {
        try {
            icon = Gio.Icon.new_for_string(iconOrName);
        } catch (e) {
            console.warn('[TouchpadGestures] Failed to create icon for string:', iconOrName, e);
        }
    } else {
        icon = iconOrName;
    }

    try {
        if (typeof Main.osdWindowManager.showAll === 'function') {
            // GNOME 50+
            Main.osdWindowManager.showAll(icon, label, level, maxLevel ?? 1.0);
        } else if (typeof Main.osdWindowManager.show === 'function') {
            // GNOME 45-47
            Main.osdWindowManager.show(-1, icon, label, level, maxLevel ?? 1.0);
        }
    } catch (e) {
        console.warn('[TouchpadGestures] OSD show error:', e);
    }
}

/**
 * Removes ease_property animations on OSD level bars to prevent high-frequency
 * gesture stutter and lag during continuous swiping.
 */
export function resetOsdLevelTransitions(level) {
    if (Main.osdWindowManager?._osdWindows) {
        for (const osdWin of Main.osdWindowManager._osdWindows) {
            if (osdWin?._level) {
                try {
                    osdWin._level.remove_all_transitions();
                    osdWin._level.value = level;
                } catch (_e) {
                    // Safe ignore if transition cannot be canceled
                }
            }
        }
    }
}
