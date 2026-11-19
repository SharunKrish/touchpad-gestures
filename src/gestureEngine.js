import Clutter from 'gi://Clutter';
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

import { Action, resolveAdjustmentAction } from './actions.js';

const SWIPE_THRESHOLD = 32;
const AXIS_LOCK_DISTANCE = 18;
const CONTINUOUS_AXIS_LOCK_DISTANCE = 6;
const PINCH_IN_THRESHOLD = 0.93;
const PINCH_OUT_THRESHOLD = 1.07;

function isVolumeSwipe(action) {
    return action === Action.VOLUME_UP || action === Action.VOLUME_DOWN;
}

function isBrightnessSwipe(action) {
    return action === Action.BRIGHTNESS_UP || action === Action.BRIGHTNESS_DOWN;
}

function isContinuousSwipe(action) {
    return isVolumeSwipe(action) || isBrightnessSwipe(action);
}

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
        this._buttonEventId = 0;
        this._handledButtons = new Set();

        // Swipe tracking state
        this._cumDx = 0;
        this._cumDy = 0;
        this._dominantAxis = null;
        this._swipeFingers = 0;
        this._swipeAction = Action.NONE;
        this._swipeSensitivity = 1;
        this._continuousSpeed = 1;
        this._swipeDirection = 0;

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
            this._buttonEventId = global.stage.connect('captured-event::button', (_actor, event) => {
                return this._handleClickEvent(event);
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
        }

        return Clutter.EVENT_PROPAGATE;
    }

    // ==========================================
    // MULTI-FINGER CLICK / TAP
    // ==========================================
    _handleClickEvent(event) {
        if (Main.sessionMode?.isLocked ||
            event.get_source_device()?.get_device_type() !== Clutter.InputDeviceType.TOUCHPAD_DEVICE)
            return Clutter.EVENT_PROPAGATE;

        const button = event.get_button();
        if (event.type() === Clutter.EventType.BUTTON_RELEASE)
            return this._handledButtons.delete(button) ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;

        let action = Action.NONE;

        if (button === 3) {
            // 2-finger click / right-click
            action = this._settings.get_enum('click-2fg');
        } else if (button === 2) {
            // 3-finger click / middle-click
            action = this._settings.get_enum('click-3fg');
        }

        if (this._executeAction(action)) {
            this._handledButtons.add(button);
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

        const action = resolveAdjustmentAction(this._settings.get_enum(key), isVertical ? dy < 0 : dx > 0);

        if (fingers === 3 && !isVertical && this._nativeTracker.handlesWorkspaceSwipe()) {
            return Action.NONE;
        }

        // Let GNOME handle its own three-finger opening animation when its tracker is available.
        if (fingers === 3 && action === Action.OVERVIEW && isVertical && dy < 0 &&
            this._nativeTracker.handlesOverviewSwipe() &&
            !Main.overview?.visible && this._getDesktopMinimizedWindows().length === 0) {
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
            if (fingers === 3 || fingers === 4)
                this._swipeSensitivity = this._settings.get_double('swipe-sensitivity') || 1.0;

            return Clutter.EVENT_PROPAGATE;
        }

        if (phase === Clutter.TouchpadGesturePhase.UPDATE) {
            if (this._swipeFingers !== 3 && this._swipeFingers !== 4) {
                return Clutter.EVENT_PROPAGATE;
            }

            const [dx, dy] = event.get_gesture_motion_delta();
            const sensitivity = this._swipeSensitivity;

            this._cumDx += dx * sensitivity;
            this._cumDy += dy * sensitivity;

            if (!this._dominantAxis) {
                const totalDist = Math.hypot(this._cumDx, this._cumDy);
                if (totalDist >= CONTINUOUS_AXIS_LOCK_DISTANCE) {
                    const absX = Math.abs(this._cumDx);
                    const absY = Math.abs(this._cumDy);
                    const isVert = absY > absX;
                    const ratio = isVert ? absY / Math.max(1, absX) : absX / Math.max(1, absY);
                    const action = this._getSwipeAction(this._swipeFingers, isVert, this._cumDy, this._cumDx);
                    const continuous = isContinuousSwipe(action);
                    const lockDistance = continuous ? CONTINUOUS_AXIS_LOCK_DISTANCE : AXIS_LOCK_DISTANCE;
                    const forceLockDistance = continuous ? 12 : 28;

                    if (totalDist >= lockDistance && (ratio > 1.2 || totalDist >= forceLockDistance)) {
                        this._dominantAxis = isVert ? 'vertical' : 'horizontal';
                        this._swipeAction = action;
                        this._swipeDirection = Math.sign(isVert ? this._cumDy : this._cumDx);
                        if (continuous) {
                            const speedKey = isVolumeSwipe(action) ? 'volume-speed' : 'brightness-speed';
                            const speed = this._settings.get_double(speedKey) || 1.0;
                            const increases = action === Action.VOLUME_UP || action === Action.BRIGHTNESS_UP;
                            this._continuousSpeed = speed * this._swipeDirection * (increases ? 1 : -1);
                            return this._handleSwipeUpdate(this._cumDx / sensitivity, this._cumDy / sensitivity);
                        }

                        if (action === Action.SNAP_LEFT || action === Action.SNAP_RIGHT) {
                            this._windowTiling.showPreviewForAction(action === Action.SNAP_LEFT ? 'left' : 'right',
                                global.display.get_focus_window());
                        }
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
                if (!consumed)
                    this._windowTiling.hidePreview();
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

        if (isVolumeSwipe(this._swipeAction)) {
            const delta = isVertical ? dy : dx;
            this._volume.adjust(delta * 0.003 * this._continuousSpeed);
            return Clutter.EVENT_STOP;
        }

        if (isBrightnessSwipe(this._swipeAction)) {
            const delta = isVertical ? dy : dx;
            this._brightness.adjust(delta * 0.18 * this._continuousSpeed);
            return Clutter.EVENT_STOP;
        }

        if (this._swipeAction === Action.WINDOW_SWITCHING) {
            const distance = isVertical ? 300 : 400;

            if (!this._altTab.isGestureActive()) {
                const started = this._altTab.beginGesture();
                if (!started) return Clutter.EVENT_STOP;
                const initialDelta = isVertical ? this._cumDy : this._cumDx;
                this._altTab.updateGesture(initialDelta, distance);
                return Clutter.EVENT_STOP;
            }

            const delta = (isVertical ? dy : dx) * this._swipeSensitivity;
            this._altTab.updateGesture(delta, distance);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_STOP;
    }

    _handleSwipeEnd() {
        if (!this._dominantAxis || this._swipeAction === Action.NONE) return false;

        if (isContinuousSwipe(this._swipeAction))
            return true;

        const isVertical = this._dominantAxis === 'vertical';
        const isTiling = this._swipeAction === Action.SNAP_LEFT || this._swipeAction === Action.SNAP_RIGHT;
        const delta = isVertical ? this._cumDy : this._cumDx;
        const dist = this._swipeAction === Action.WINDOW_SWITCHING ? Math.abs(delta) : delta * this._swipeDirection;
        if (dist >= (isTiling ? AXIS_LOCK_DISTANCE : SWIPE_THRESHOLD)) {
            if (this._swipeAction === Action.WINDOW_SWITCHING && this._altTab.isGestureActive()) {
                this._altTab.endGesture();
                return true;
            }
            return this._executeAction(this._swipeAction);
        }

        return false;
    }

    _resetSwipeState() {
        if (isVolumeSwipe(this._swipeAction)) {
            this._volume?.finish();
        } else if (isBrightnessSwipe(this._swipeAction)) {
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

        switch (action) {
            case Action.OVERVIEW:
                Main.overview.toggle();
                return true;

            case Action.APP_GRID: {
                if (Main.overview.visible)
                    Main.overview?._overview?.controls?._shiftState?.(Meta.MotionDirection.UP);
                else
                    Main.overview.showApps();
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

            case Action.CLOSE_WINDOW: {
                const window = this._focusWindow ?? global.display.get_focus_window();
                if (window) {
                    window.delete(global.get_current_time());
                }
                return true;
            }

            case Action.MAXIMIZE_WINDOW:
                this._windowTiling.handleSwipeUp(this._settings.get_boolean('allow-fullscreen'));
                return true;

            case Action.MINIMIZE_WINDOW:
                this._windowTiling.handleSwipeDown(this._settings.get_boolean('allow-minimize'));
                return true;

            case Action.SNAP_LEFT:
                this._windowTiling.handleSwipeLeft();
                return true;

            case Action.SNAP_RIGHT:
                this._windowTiling.handleSwipeRight();
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
                this._volume.finish();
                return true;

            case Action.VOLUME_DOWN:
                this._volume.adjust(-0.05);
                this._volume.finish();
                return true;

            case Action.VOLUME_CONTROL:
                this._volume.adjust(0.02);
                this._volume.finish();
                return true;

            case Action.BRIGHTNESS_UP:
                this._brightness.adjust(8);
                this._brightness.finish();
                return true;

            case Action.BRIGHTNESS_DOWN:
                this._brightness.adjust(-8);
                this._brightness.finish();
                return true;

            case Action.BRIGHTNESS_CONTROL:
                this._brightness.adjust(5);
                this._brightness.finish();
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
                             GLib.find_program_in_path('x-terminal-emulator');
                try {
                    if (term) {
                        GLib.spawn_async(null, [term], null, GLib.SpawnFlags.DEFAULT, null);
                        this._showPinchOsd('utilities-terminal-symbolic', 'Terminal Launched');
                    } else {
                        this._showPinchOsd('utilities-terminal-symbolic', 'No Terminal Found');
                    }
                } catch (error) {
                    console.warn('[TouchpadGestures] Could not launch terminal:', error);
                    this._showPinchOsd('utilities-terminal-symbolic', 'Could Not Launch Terminal');
                }
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
                return captureScreenshot(content.get_texture(), null, 1, null);
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
    _getDesktopMinimizedWindows() {
        const windows = [];
        if (this._desktopMinimizedWindows.size === 0)
            return windows;

        const activeWs = global.workspace_manager.get_active_workspace();
        for (const win of this._desktopMinimizedWindows) {
            const ws = win.get_workspace();
            if (!ws || !win.minimized)
                this._desktopMinimizedWindows.delete(win);
            else if (ws === activeWs || win.is_on_all_workspaces())
                windows.push(win);
        }
        return windows;
    }

    _toggleShowDesktop() {
        const toRestore = this._getDesktopMinimizedWindows();
        if (toRestore.length > 0) {
            for (const win of toRestore) {
                this._desktopMinimizedWindows.delete(win);
                win.unminimize();
            }
            toRestore.at(-1).activate(global.get_current_time());
            this._showPinchOsd('preferences-desktop-display-symbolic', 'Windows Restored');
            return;
        }

        const activeWs = global.workspace_manager.get_active_workspace();
        const toMinimize = activeWs.list_windows().filter(win =>
            !win.skip_taskbar && !win.minimized &&
            win.get_window_type() === Meta.WindowType.NORMAL && win.can_minimize());
        if (toMinimize.length === 0)
            return;

        for (const win of toMinimize) {
            this._desktopMinimizedWindows.add(win);
            win.minimize();
        }
        if (Main.overview?.visible)
            Main.overview.hide();
        this._showPinchOsd('preferences-desktop-display-symbolic', 'Desktop Shown');
    }

    destroy() {
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }
        if (this._buttonEventId) {
            global.stage.disconnect(this._buttonEventId);
            this._buttonEventId = 0;
        }
        this._handledButtons.clear();

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
