import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Manages interception and temporary suspension of GNOME Shell's built-in
 * SwipeTracker instances to prevent them from hijacking user-configured
 * 3-finger gestures (such as Window Switching, Volume, Tabs, or Window Tiling).
 */
export class NativeGestureTracker {
    constructor(settings) {
        this._settings = settings;
        this._overriddenTrackers = new Map();
        this._syncNativeInterception();
    }

    _syncNativeInterception() {
        // In GNOME Shell:
        // - Main.wm._workspaceAnimation._swipeTracker handles 3-finger horizontal workspace switching.
        // - Main.overview._swipeTracker handles 3-finger vertical overview activation.

        const up3 = this._settings.get_enum('swipe-3fg-up');
        const down3 = this._settings.get_enum('swipe-3fg-down');
        const left3 = this._settings.get_enum('swipe-3fg-left');
        const right3 = this._settings.get_enum('swipe-3fg-right');
        const cyclicWs = this._settings.get_boolean('cyclic-workspaces');

        const isNativeH = (left3 === 3 && right3 === 4 && !cyclicWs);
        const shouldDisableNativeH = !isNativeH;
        const hTracker = Main.wm?._workspaceAnimation?._swipeTracker;
        if (hTracker) {
            this._setTrackerDisabled(hTracker, shouldDisableNativeH);
        }

        const isNativeV = (up3 === 1 && down3 === 11);
        const shouldDisableNativeV = !isNativeV;
        const vTracker = Main.overview?._swipeTracker;
        if (vTracker) {
            this._setTrackerDisabled(vTracker, shouldDisableNativeV);
        }
    }

    handlesWorkspaceSwipe() {
        return Main.wm?._workspaceAnimation?._swipeTracker?._touchpadGesture?.enabled === true;
    }

    handlesOverviewSwipe() {
        return Main.overview?._swipeTracker?._touchpadGesture?.enabled === true;
    }

    _setTrackerDisabled(tracker, disabled) {
        const gesture = tracker._touchpadGesture;
        if (!gesture) return;

        if (disabled) {
            if (!this._overriddenTrackers.has(gesture)) {
                // Safely intercept the GObject 'enabled' property using defineProperty getter/setter
                // This guarantees that internal GNOME Shell resets (e.g. on overview hide or animation complete)
                // cannot override our setting while this extension is active.
                const originalDesc = Object.getOwnPropertyDescriptor(gesture, 'enabled');
                Object.defineProperty(gesture, 'enabled', {
                    get: () => false,
                    set: () => {},
                    configurable: true,
                    enumerable: true,
                });
                this._overriddenTrackers.set(gesture, originalDesc);
            }
        } else {
            if (this._overriddenTrackers.has(gesture)) {
                delete gesture.enabled;
                const originalDesc = this._overriddenTrackers.get(gesture);
                if (originalDesc) {
                    try {
                        Object.defineProperty(gesture, 'enabled', originalDesc);
                    } catch (_e) {
                        // In GJS, deleting the override restores the GObject prototype property
                    }
                }
                this._overriddenTrackers.delete(gesture);
            }
        }
    }

    destroy() {
        // Cleanly restore all overridden trackers
        for (const [gesture, originalDesc] of this._overriddenTrackers.entries()) {
            try {
                delete gesture.enabled;
                if (originalDesc) {
                    Object.defineProperty(gesture, 'enabled', originalDesc);
                }
            } catch (e) {
                console.warn('[TouchpadGestures] Error restoring tracker descriptor:', e);
            }
        }
        this._overriddenTrackers.clear();
        this._settings = null;
    }
}
