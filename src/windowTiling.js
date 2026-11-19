import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { showOsd } from './osd.js';

function isMaximized(window) {
    return window.is_maximized?.() ?? window.get_maximized() === Meta.MaximizeFlags.BOTH;
}

function setMaximized(window, maximize) {
    const method = maximize ? 'maximize' : 'unmaximize';
    if (typeof window.is_maximized === 'function')
        window[method]();
    else
        window[method](Meta.MaximizeFlags.BOTH);
}

export class WindowTilingManager {
    constructor() {
        this._preview = new St.Widget({
            style_class: 'touchpad-gesture-preview',
            reactive: false,
            visible: false,
        });
        Main.layoutManager.uiGroup.add_child(this._preview);
    }

    _getFocusWindow() {
        return global.display.get_focus_window();
    }

    showPreviewForAction(action, window) {
        if (!window) return;

        const monitor = window.get_monitor();
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor);
        if (!workArea) return;

        let targetX = workArea.x;
        let targetY = workArea.y;
        let targetW = workArea.width;
        let targetH = workArea.height;

        if (action === 'left') {
            targetW = Math.floor(workArea.width / 2);
        } else if (action === 'right') {
            const halfW = Math.floor(workArea.width / 2);
            targetX = workArea.x + halfW;
            targetW = workArea.width - halfW;
        } else if (action === 'down') {
            // Centered restore/minimize indicator preview
            targetW = Math.floor(workArea.width * 0.70);
            targetH = Math.floor(workArea.height * 0.70);
            targetX = workArea.x + Math.floor((workArea.width - targetW) / 2);
            targetY = workArea.y + Math.floor((workArea.height - targetH) / 2);
        }

        this._preview.remove_all_transitions();
        this._preview.set_position(targetX, targetY);
        this._preview.set_size(targetW, targetH);
        this._preview.opacity = 220;
        this._preview.show();
    }

    hidePreview() {
        if (this._preview && this._preview.visible) {
            this._preview.remove_all_transitions();
            this._preview.ease({
                opacity: 0,
                duration: 140,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._preview.hide();
                },
            });
        }
    }

    _showOsd(iconName, label) {
        showOsd(iconName, label, null, null);
    }

    handleSwipeUp(allowFullscreen = true) {
        const window = this._getFocusWindow();
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL) {
            this.hidePreview();
            return;
        }

        if (window.is_fullscreen()) {
            this.hidePreview();
            return;
        }

        if (isMaximized(window)) {
            if (allowFullscreen) {
                window.make_fullscreen();
                this._showOsd('view-fullscreen-symbolic', 'Fullscreen');
            }
        } else {
            setMaximized(window, true);
            this._showOsd('view-fullscreen-symbolic', 'Maximized');
        }
        this.hidePreview();
    }

    handleSwipeDown(allowMinimize = true) {
        const window = this._getFocusWindow();
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL) {
            this.hidePreview();
            return;
        }

        if (window.is_fullscreen()) {
            window.unmake_fullscreen();
            this._showOsd('view-restore-symbolic', 'Restored');
        } else if (isMaximized(window)) {
            setMaximized(window, false);
            this._showOsd('view-restore-symbolic', 'Restored');
        } else if (allowMinimize && window.can_minimize()) {
            window.minimize();
            this._showOsd('window-minimize-symbolic', 'Minimized');
        }
        this.hidePreview();
    }

    handleSwipeLeft() {
        const window = this._getFocusWindow();
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL) {
            this.hidePreview();
            return;
        }

        const monitor = window.get_monitor();
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor);
        if (!workArea) {
            this.hidePreview();
            return;
        }

        if (window.is_fullscreen()) {
            window.unmake_fullscreen();
        }
        if (isMaximized(window))
            setMaximized(window, false);

        const halfWidth = Math.floor(workArea.width / 2);
        window.move_to_monitor(monitor);
        // Some Wayland clients resize without moving unless the move is requested first.
        window.move_frame(true, workArea.x, workArea.y);
        window.move_resize_frame(true, workArea.x, workArea.y, halfWidth, workArea.height);
        this._showOsd('view-restore-symbolic', 'Snapped Left');
        this.hidePreview();
    }

    handleSwipeRight() {
        const window = this._getFocusWindow();
        if (!window || window.get_window_type() !== Meta.WindowType.NORMAL) {
            this.hidePreview();
            return;
        }

        const monitor = window.get_monitor();
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor);
        if (!workArea) {
            this.hidePreview();
            return;
        }

        if (window.is_fullscreen()) {
            window.unmake_fullscreen();
        }
        if (isMaximized(window))
            setMaximized(window, false);

        const halfWidth = Math.floor(workArea.width / 2);
        const rightX = workArea.x + halfWidth;
        const rightW = workArea.width - halfWidth;

        window.move_to_monitor(monitor);
        window.move_frame(true, rightX, workArea.y);
        window.move_resize_frame(true, rightX, workArea.y, rightW, workArea.height);
        this._showOsd('view-restore-symbolic', 'Snapped Right');
        this.hidePreview();
    }

    destroy() {
        if (this._preview) {
            this._preview.destroy();
            this._preview = null;
        }
    }
}
