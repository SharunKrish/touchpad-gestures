import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { captureScreenshot, showScreenshotUI } from 'resource:///org/gnome/shell/ui/screenshot.js';

import { getKeyboard } from './keyboard.js';
import { VolumeManager } from './volume.js';
import { BrightnessManager } from './brightness.js';
import { WindowTilingManager } from './windowTiling.js';
import { WorkspaceManager } from './workspaceManager.js';
import { AltTabManager } from './altTab.js';
import { NativeGestureTracker } from './nativeGestureTracker.js';
import { showOsd } from './osd.js';

// Unified Action Enum matching schema
export const Action = {
    NONE: 0,
    OVERVIEW: 1,
    APP_GRID: 2,
    WORKSPACE_NEXT: 3,
    WORKSPACE_PREV: 4,
    WINDOW_SWITCHING: 5,
    CLOSE_WINDOW: 6,
    MAXIMIZE_WINDOW: 7,
    MINIMIZE_WINDOW: 8,
    SNAP_LEFT: 9,
    SNAP_RIGHT: 10,
    SHOW_DESKTOP: 11,
    SHOW_NOTIFICATIONS: 12,
    SHOW_QUICK_SETTINGS: 13,
    SCREENSHOT_FULL: 14,
    SCREENSHOT_UI: 15,
    VOLUME_UP: 16,
    VOLUME_DOWN: 17,
    VOLUME_CONTROL: 18,
    BRIGHTNESS_UP: 19,
    BRIGHTNESS_DOWN: 20,
    BRIGHTNESS_CONTROL: 21,
    TAB_NEXT: 22,
    TAB_PREV: 23,
    TAB_NEW: 24,
    TAB_CLOSE: 25,
    LAUNCH_TERMINAL: 26,
};

const SWIPE_THRESHOLD = 32;
const PINCH_IN_THRESHOLD = 0.93;
const PINCH_OUT_THRESHOLD = 1.07;

export class GestureEngine {
    constructor(settings) {
        this._settings = settings;
        this._keyboard = getKeyboard();
        this._volume = new VolumeManager();
        this._brightness = new BrightnessManager();
        this._windowTiling = new WindowTilingManager();
        this._workspaceManager = new WorkspaceManager(settings);
        this._altTab = new AltTabManager();
        this._nativeTracker = new NativeGestureTracker(settings);

        this._stageEventId = 0;

        // Swipe tracking state
        this._cumDx = 0;
        this._cumDy = 0;
        this._dominantAxis = null;
        this._swipeFingers = 0;
        this._swipeAction = Action.NONE;

        // Pinch tracking state
        this._pinchGesture = null;
        this._focusWindow = null;

        // Desktop toggle tracking
        this._desktopMinimizedWindows = new Set();

        this._connectStageEvents();
    }

    _connectStageEvents() {
        if (this._stageEventId === 0) {
            this._stageEventId = global.stage.connect('captured-event::touchpad', (_actor, event) => {
                return this._handleTouchpadEvent(event);
            });
        }
    }

    _handleTouchpadEvent(event) {
        if (Main.sessionMode?.isLocked) {
            return Clutter.EVENT_PROPAGATE;
        }

        const type = event.type();
        if (type === Clutter.EventType.TOUCHPAD_SWIPE) {
            return this._handleSwipeEvent(event);
        } else if (type === Clutter.EventType.TOUCHPAD_PINCH) {
            return this._handlePinchEvent(event);
        } else if (type === Clutter.EventType.BUTTON_PRESS) {
            return this._handleButtonPress(event);
        }

        return Clutter.EVENT_PROPAGATE;
    }

    // ==========================================
    // MULTI-FINGER CLICK / TAP
    // ==========================================
    _handleButtonPress(event) {
        const button = event.get_button();
        let action = Action.NONE;

        if (button === 3) {
            // 2-finger click / right-click
            action = this._settings.get_enum('click-2fg');
        } else if (button === 2) {
            // 3-finger click / middle-click
            action = this._settings.get_enum('click-3fg');
        } else if (button === 8 || button === 9) {
            // 4-finger click
            action = this._settings.get_enum('click-4fg');
        }

        if (action !== Action.NONE) {
            this._executeAction(action);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    // ==========================================
    // SWIPE HANDLING
    // ==========================================
    _getSwipeAction(fingers, isVertical, dy, dx) {
        if (fingers !== 3 && fingers !== 4) return Action.NONE;

        let key = '';
        if (isVertical) {
            key = dy < 0 ? `swipe-${fingers}fg-up` : `swipe-${fingers}fg-down`;
        } else {
            key = dx < 0 ? `swipe-${fingers}fg-left` : `swipe-${fingers}fg-right`;
        }

        const action = this._settings.get_enum(key);

        if (fingers === 3 && !isVertical && this._nativeTracker.handlesWorkspaceSwipe()) {
            return Action.NONE;
        }

        // Let GNOME handle its own three-finger opening animation when its tracker is available.
        if (fingers === 3 && action === Action.OVERVIEW && isVertical && dy < 0 &&
            this._nativeTracker.handlesOverviewSwipe() &&
            !Main.overview?.visible && !this._hasDesktopMinimizedWindows()) {
            return Action.NONE;
        }

        return action;
    }

    _handleSwipeEvent(event) {
        const phase = event.get_gesture_phase();
        const fingers = event.get_touchpad_gesture_finger_count();

        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._cumDx = 0;
            this._cumDy = 0;
            this._dominantAxis = null;
            this._swipeFingers = fingers;
            this._swipeAction = Action.NONE;

            if (fingers !== 3 && fingers !== 4) {
                return Clutter.EVENT_PROPAGATE;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        if (phase === Clutter.TouchpadGesturePhase.UPDATE) {
            if (this._swipeFingers !== 3 && this._swipeFingers !== 4) {
                return Clutter.EVENT_PROPAGATE;
            }

            const [dx, dy] = event.get_gesture_motion_delta();
            const sensitivity = this._settings.get_double('swipe-sensitivity') || 1.0;

            this._cumDx += dx * sensitivity;
            this._cumDy += dy * sensitivity;

            if (!this._dominantAxis) {
                const totalDist = Math.hypot(this._cumDx, this._cumDy);
                if (totalDist >= 18) {
                    const absX = Math.abs(this._cumDx);
                    const absY = Math.abs(this._cumDy);
                    const isVert = absY > absX;
                    const ratio = isVert ? absY / Math.max(1, absX) : absX / Math.max(1, absY);

                    if (ratio > 1.2 || totalDist >= 28) {
                        this._dominantAxis = isVert ? 'vertical' : 'horizontal';
                        this._swipeAction = this._getSwipeAction(this._swipeFingers, isVert, this._cumDy, this._cumDx);
                    }
                }
            }

            if (this._dominantAxis && this._swipeAction !== Action.NONE) {
                return this._handleSwipeUpdate(dx, dy);
            }
            return Clutter.EVENT_PROPAGATE;
        }

        if (phase === Clutter.TouchpadGesturePhase.END) {
            if (this._dominantAxis && this._swipeAction !== Action.NONE) {
                const consumed = this._handleSwipeEnd();
                this._resetSwipeState();
                return consumed ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
            }
            this._resetSwipeState();
            return Clutter.EVENT_PROPAGATE;
        }

        if (phase === Clutter.TouchpadGesturePhase.CANCEL) {
            this._windowTiling.hidePreview();
            if (this._altTab?.isGestureActive()) {
                this._altTab.cancelGesture();
            }
            this._resetSwipeState();
            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _handleSwipeUpdate(dx, dy) {
        const isVertical = this._dominantAxis === 'vertical';

        if (this._swipeAction === Action.VOLUME_CONTROL) {
            const speed = this._settings.get_double('volume-speed') || 1.0;
            const delta = isVertical ? -dy : dx;
            this._volume.adjust(delta * 0.003 * speed);
            return Clutter.EVENT_STOP;
        }

        if (this._swipeAction === Action.BRIGHTNESS_CONTROL) {
            const speed = this._settings.get_double('brightness-speed') || 1.0;
            const delta = isVertical ? -dy : dx;
            this._brightness.adjust(delta * 0.18 * speed);
            return Clutter.EVENT_STOP;
        }

        if (this._swipeAction === Action.WINDOW_SWITCHING) {
            const sensitivity = this._settings.get_double('swipe-sensitivity') || 1.0;
            const distance = isVertical ? 300 : 400;

            if (!this._altTab.isGestureActive()) {
                const started = this._altTab.beginGesture();
                if (!started) return Clutter.EVENT_STOP;
                const initialDelta = isVertical ? this._cumDy : this._cumDx;
                this._altTab.updateGesture(initialDelta, distance);
                return Clutter.EVENT_STOP;
            }

            const delta = (isVertical ? dy : dx) * sensitivity;
            this._altTab.updateGesture(delta, distance);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_STOP;
    }

    _handleSwipeEnd() {
        if (!this._dominantAxis || this._swipeAction === Action.NONE) return false;

        if (this._swipeAction === Action.VOLUME_CONTROL || this._swipeAction === Action.BRIGHTNESS_CONTROL)
            return true;

        const isVertical = this._dominantAxis === 'vertical';
        const dist = isVertical ? Math.abs(this._cumDy) : Math.abs(this._cumDx);

        if (dist >= SWIPE_THRESHOLD) {
            if (this._swipeAction === Action.WINDOW_SWITCHING && this._altTab.isGestureActive()) {
                this._altTab.endGesture();
                return true;
            }
            return this._executeAction(this._swipeAction);
        }

        return false;
    }

    _resetSwipeState() {
        if (this._swipeAction === Action.VOLUME_CONTROL) {
            this._volume?.finish();
        } else if (this._swipeAction === Action.BRIGHTNESS_CONTROL) {
            this._brightness?.finish();
        } else if (this._swipeAction === Action.WINDOW_SWITCHING) {
            if (this._altTab?.isGestureActive()) {
                this._altTab.cancelGesture();
            }
        }

        this._cumDx = 0;
        this._cumDy = 0;
        this._dominantAxis = null;
        this._swipeFingers = 0;
        this._swipeAction = Action.NONE;
    }

    // ==========================================
    // PINCH HANDLING
    // ==========================================
    _handlePinchEvent(event) {
        const phase = event.get_gesture_phase();

        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._resetPinchState();
            const fingers = event.get_touchpad_gesture_finger_count();
            if (fingers !== 2 && fingers !== 3 && fingers !== 4)
                return Clutter.EVENT_PROPAGATE;

            const inAction = this._settings.get_enum(`pinch-${fingers}fg-in`);
            const outAction = this._settings.get_enum(`pinch-${fingers}fg-out`);
            if (inAction === Action.NONE && outAction === Action.NONE)
                return Clutter.EVENT_PROPAGATE;

            this._pinchGesture = {inAction, outAction, triggered: false};
            this._focusWindow = global.display.get_focus_window();
            return Clutter.EVENT_STOP;
        }

        const gesture = this._pinchGesture;
        if (!gesture)
            return Clutter.EVENT_PROPAGATE;

        if (phase === Clutter.TouchpadGesturePhase.UPDATE && !gesture.triggered) {
            const scale = event.get_gesture_pinch_scale();
            const sensitivity = this._settings.get_double('pinch-sensitivity') || 1.0;
            const effectiveScale = 1.0 + ((scale - 1.0) * sensitivity);

            if (effectiveScale <= PINCH_IN_THRESHOLD && gesture.inAction !== Action.NONE) {
                gesture.triggered = true;
                this._executeAction(gesture.inAction);
            } else if (effectiveScale >= PINCH_OUT_THRESHOLD && gesture.outAction !== Action.NONE) {
                gesture.triggered = true;
                this._executeAction(gesture.outAction);
            }
        }

        if (phase === Clutter.TouchpadGesturePhase.END || phase === Clutter.TouchpadGesturePhase.CANCEL)
            this._resetPinchState();

        return Clutter.EVENT_STOP;
    }

    _resetPinchState() {
        this._pinchGesture = null;
        this._focusWindow = null;
    }

    // ==========================================
    // UNIFIED ACTION DISPATCHER
    // ==========================================
    _executeAction(action) {
        if (!action || action === Action.NONE) return false;

        const activeWs = global.workspace_manager.get_active_workspace();
        const wsWindows = activeWs.list_windows().filter(w => !w.skip_taskbar && w.get_window_type() === Meta.WindowType.NORMAL);
        const window = this._focusWindow || global.display.get_focus_window() || wsWindows.find(w => !w.minimized) || wsWindows[0];

        switch (action) {
            case Action.OVERVIEW:
                Main.overview.toggle();
                return true;

            case Action.APP_GRID: {
                if (Main.overview.visible) {
                    const controls = Main.overview?._overview?.controls;
                    if (controls && typeof controls._shiftState === 'function') {
                        controls._shiftState(Meta.MotionDirection.UP);
                    }
                } else {
                    Main.overview.show();
                    const controls = Main.overview?._overview?.controls;
                    if (controls && typeof controls._shiftState === 'function') {
                        controls._shiftState(Meta.MotionDirection.UP);
                    }
                }
                return true;
            }

            case Action.WORKSPACE_NEXT:
                this._workspaceManager.switchWorkspace(1);
                return true;

            case Action.WORKSPACE_PREV:
                this._workspaceManager.switchWorkspace(-1);
                return true;

            case Action.WINDOW_SWITCHING:
                this._keyboard.sendKeyCombination([Clutter.KEY_Alt_L, Clutter.KEY_Tab]);
                return true;

            case Action.CLOSE_WINDOW:
                if (window) {
                    window.delete(global.get_current_time());
                    this._showPinchOsd('window-close-symbolic', 'Window Closed');
                }
                return true;

            case Action.MAXIMIZE_WINDOW:
                if (window) {
                    this._windowTiling.handleSwipeUp(true);
                }
                return true;

            case Action.MINIMIZE_WINDOW:
                if (window) {
                    this._windowTiling.handleSwipeDown(true);
                }
                return true;

            case Action.SNAP_LEFT:
                if (window) {
                    this._windowTiling.handleSwipeLeft();
                }
                return true;

            case Action.SNAP_RIGHT:
                if (window) {
                    this._windowTiling.handleSwipeRight();
                }
                return true;

            case Action.SHOW_DESKTOP:
                this._toggleShowDesktop();
                return true;

            case Action.SHOW_NOTIFICATIONS:
                Main.panel?.toggleCalendar();
                return true;

            case Action.SHOW_QUICK_SETTINGS:
                Main.panel?.toggleQuickSettings();
                return true;

            case Action.SCREENSHOT_FULL:
                this._captureFullScreen();
                return true;

            case Action.SCREENSHOT_UI:
                this._toggleScreenshotUI();
                return true;

            case Action.VOLUME_UP:
                this._volume.adjust(0.05);
                return true;

            case Action.VOLUME_DOWN:
                this._volume.adjust(-0.05);
                return true;

            case Action.VOLUME_CONTROL:
                this._volume.adjust(0.02);
                return true;

            case Action.BRIGHTNESS_UP:
                this._brightness.adjust(0.08);
                return true;

            case Action.BRIGHTNESS_DOWN:
                this._brightness.adjust(-0.08);
                return true;

            case Action.BRIGHTNESS_CONTROL:
                this._brightness.adjust(0.05);
                return true;

            case Action.TAB_NEXT:
                this._keyboard.nextTab();
                return true;

            case Action.TAB_PREV:
                this._keyboard.prevTab();
                return true;

            case Action.TAB_NEW:
                this._keyboard.newTab();
                this._showPinchOsd('tab-new-symbolic', 'New Tab');
                return true;

            case Action.TAB_CLOSE:
                this._keyboard.closeTab();
                this._showPinchOsd('window-close-symbolic', 'Tab Closed');
                return true;

            case Action.LAUNCH_TERMINAL: {
                const term = GLib.find_program_in_path('ptyxis') ||
                             GLib.find_program_in_path('gnome-terminal') ||
                             GLib.find_program_in_path('kgx') ||
                             'x-terminal-emulator';
                GLib.spawn_command_line_async(term);
                this._showPinchOsd('utilities-terminal-symbolic', 'Terminal Launched');
                return true;
            }

            default:
                return false;
        }
    }

    _captureFullScreen() {
        try {
            const shooter = new Shell.Screenshot();
            shooter.screenshot_stage_to_content().then(([content]) => {
                captureScreenshot(content.get_texture(), null, 1, null);
            }).catch(_err => {
                this._keyboard.sendKeyCombination([Clutter.KEY_Shift_L, 0xff61]);
            });
        } catch (_e) {
            this._keyboard.sendKeyCombination([Clutter.KEY_Shift_L, 0xff61]);
        }
    }

    _toggleScreenshotUI() {
        try {
            if (Main.screenshotUI?.visible) {
                Main.screenshotUI.close();
            } else {
                showScreenshotUI();
            }
        } catch (_e) {
            this._keyboard.sendKeyCombination([0xff61]);
        }
    }

    _showPinchOsd(iconName, label) {
        showOsd(iconName, label, null, null);
    }

    // ==========================================
    // SHOW DESKTOP
    // ==========================================
    _hasDesktopMinimizedWindows() {
        if (this._desktopMinimizedWindows.size === 0) return false;
        const activeWs = global.workspace_manager.get_active_workspace();
        for (const win of this._desktopMinimizedWindows) {
            try {
                const ws = win.get_workspace ? win.get_workspace() : null;
                const onThisWs = (ws === activeWs) || (win.is_on_all_workspaces && win.is_on_all_workspaces());
                if (win && win.minimized && onThisWs) {
                    return true;
                }
            } catch (_e) {
                // Ignore destroyed or invalid window
            }
        }
        return false;
    }

    _toggleShowDesktop(forceMinimize = null) {
        const activeWs = global.workspace_manager.get_active_workspace();
        const windows = activeWs.list_windows().filter(w => !w.skip_taskbar && w.get_window_type() === Meta.WindowType.NORMAL);

        let shouldMinimize;
        if (forceMinimize !== null) {
            shouldMinimize = forceMinimize;
        } else {
            shouldMinimize = windows.some(w => !w.minimized);
        }

        if (shouldMinimize) {
            const toMinimize = windows.filter(w => w.can_minimize() && !w.minimized);
            if (toMinimize.length === 0) return;

            this._desktopMinimizedWindows.clear();
            for (const win of toMinimize) {
                this._desktopMinimizedWindows.add(win);
                win.minimize();
            }
            if (Main.overview?.visible) {
                Main.overview.hide();
            }
            this._showPinchOsd('preferences-desktop-display-symbolic', 'Desktop Shown');
        } else {
            const toRestore = this._desktopMinimizedWindows.size > 0
                ? Array.from(this._desktopMinimizedWindows)
                : windows.filter(w => w.minimized);

            if (toRestore.length === 0) return;

            let lastWin = null;
            for (const win of toRestore) {
                try {
                    const ws = win.get_workspace ? win.get_workspace() : null;
                    const onThisWs = (ws === activeWs) || (win.is_on_all_workspaces && win.is_on_all_workspaces());
                    if (win && win.minimized && onThisWs) {
                        win.unminimize();
                        lastWin = win;
                    }
                } catch (_e) {
                    // Ignore destroyed or invalid window
                }
            }
            if (lastWin) {
                try {
                    lastWin.activate(global.get_current_time());
                } catch (_e) {}
            }
            this._desktopMinimizedWindows.clear();
            this._showPinchOsd('preferences-desktop-display-symbolic', 'Windows Restored');
        }
    }

    destroy() {
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }

        this._nativeTracker?.destroy();
        this._volume?.destroy();
        this._brightness?.destroy();
        this._windowTiling?.destroy();
        this._workspaceManager?.destroy();
        this._altTab?.destroy();

        this._nativeTracker = null;
        this._volume = null;
        this._brightness = null;
        this._windowTiling = null;
        this._workspaceManager = null;
        this._altTab = null;
        this._settings = null;
        this._desktopMinimizedWindows.clear();
    }
}
