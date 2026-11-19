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

// Preserve the direction of saved assignments that predate the four directional actions.
export function resolveAdjustmentAction(action, increases) {
    if (action === Action.VOLUME_CONTROL)
        return increases ? Action.VOLUME_UP : Action.VOLUME_DOWN;
    if (action === Action.BRIGHTNESS_CONTROL)
        return increases ? Action.BRIGHTNESS_UP : Action.BRIGHTNESS_DOWN;
    return action;
}
