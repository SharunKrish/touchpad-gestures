import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { WindowSwitcherPopup } from 'resource:///org/gnome/shell/ui/altTab.js';

const MIN_WIN_COUNT = 8;
const DEFAULT_DUMMY_WIN_COUNT = 1;
const DELAY_DURATION = 100; // ms delay before showing popup (fast flick switches without HUD flicker)
const POPUP_SCROLL_TIME = 100; // ms scroll animation duration

const AltTabState = {
    IDLE: 0,
    DELAY: 1,
    ACTIVE: 2,
};

function getIndexForProgress(progress, nelement, dummyWinCount) {
    let index = Math.floor(progress * (nelement + 2 * dummyWinCount));
    index = index - dummyWinCount;
    return Math.clamp(index, 0, nelement - 1);
}

function getAvgProgressForIndex(index, nelement, dummyWinCount) {
    index = index + dummyWinCount;
    const progress = (index + 0.5) / (nelement + 2 * dummyWinCount);
    return progress;
}

export class AltTabManager {
    constructor() {
        this._state = AltTabState.IDLE;
        this._switcher = null;
        this._progress = 0;
        this._dummyWinCount = DEFAULT_DUMMY_WIN_COUNT;
        this._altTabTimeoutId = 0;
        this._unredirectInhibited = false;
    }

    isGestureActive() {
        return this._state > AltTabState.IDLE && this._switcher !== null;
    }

    _inhibitUnredirect() {
        if (this._unredirectInhibited)
            return;

        if (global.compositor?.disable_unredirect) {
            global.compositor.disable_unredirect();
        } else if (Meta.disable_unredirect_for_display) {
            Meta.disable_unredirect_for_display(global.display);
        }
        this._unredirectInhibited = true;
    }

    _uninhibitUnredirect() {
        if (!this._unredirectInhibited)
            return;

        if (global.compositor?.enable_unredirect) {
            global.compositor.enable_unredirect();
        } else if (Meta.enable_unredirect_for_display) {
            Meta.enable_unredirect_for_display(global.display);
        }
        this._unredirectInhibited = false;
    }

    beginGesture() {
        if (this.isGestureActive()) {
            return true;
        }

        try {
            this._switcher = new WindowSwitcherPopup();
        } catch (e) {
            console.warn('[TouchpadGestures] Failed to create WindowSwitcherPopup:', e);
            this._switcher = null;
            return false;
        }

        if (!this._switcher._items || this._switcher._items.length <= 1) {
            this._switcher.destroy();
            this._switcher = null;
            this._reset();
            return false;
        }

        this._switcher._switcherList?.add_style_class_name('gie-alttab-quick-transition');
        this._switcher.connect('destroy', () => {
            this._switcher = null;
            this._reset();
        });

        // Prevent GNOME's automatic 1500ms no-mods dismiss timeout while user is actively gesturing
        this._switcher._resetNoModsTimeout = function () {
            if (this._noModsTimeoutId) {
                GLib.source_remove(this._noModsTimeoutId);
                this._noModsTimeoutId = 0;
            }
        };

        const shown = this._switcher.show(false, 'switch-windows', 0);
        if (!shown) {
            this._switcher.destroy();
            this._switcher = null;
            this._reset();
            return false;
        }

        // Release modal keyboard grab immediately so stage capture receives touchpad events
        this._switcher._popModal();
        this._inhibitUnredirect();

        // Cancel GNOME's native delay timeout
        if (this._switcher._initialDelayTimeoutId) {
            GLib.source_remove(this._switcher._initialDelayTimeoutId);
            this._switcher._initialDelayTimeoutId = 0;
        }

        const nelement = this._switcher._items.length;
        const leftOver = MIN_WIN_COUNT - nelement;
        if (leftOver > 0) {
            this._dummyWinCount = Math.max(DEFAULT_DUMMY_WIN_COUNT, Math.ceil(leftOver / 2));
        } else {
            this._dummyWinCount = DEFAULT_DUMMY_WIN_COUNT;
        }

        // Initially select the second window (MRU target)
        this._progress = getAvgProgressForIndex(1, nelement, this._dummyWinCount);
        this._switcher._select(1);

        this._state = AltTabState.DELAY;
        if (this._altTabTimeoutId) {
            GLib.source_remove(this._altTabTimeoutId);
            this._altTabTimeoutId = 0;
        }

        this._altTabTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DELAY_DURATION, () => {
            Main.osdWindowManager.hideAll();
            if (this._switcher) {
                this._switcher.opacity = 255;
            }
            this._state = AltTabState.ACTIVE;
            this._updateSelection();
            this._altTabTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });

        return true;
    }

    updateGesture(delta, distance) {
        if (!this._switcher || this._state <= AltTabState.IDLE)
            return;

        this._progress = Math.clamp(this._progress + delta / distance, 0, 1);

        if (this._state === AltTabState.ACTIVE) {
            this._updateSelection();
        }
    }

    _updateSelection() {
        if (!this._switcher || this._state !== AltTabState.ACTIVE)
            return;

        const nelement = this._switcher._items.length;
        if (nelement > 1) {
            const n = getIndexForProgress(this._progress, nelement, this._dummyWinCount);
            if (n !== this._switcher._selectedIndex) {
                this._switcher._select(n);
                const scrollView = this._switcher._switcherList?._scrollView;
                const adjustment = scrollView?.hadjustment || scrollView?.hscroll?.adjustment;
                const transition = adjustment?.get_transition('value');
                if (transition) {
                    transition.advance(POPUP_SCROLL_TIME);
                }
            }
        }
    }

    endGesture() {
        if (this._altTabTimeoutId) {
            GLib.source_remove(this._altTabTimeoutId);
            this._altTabTimeoutId = 0;
        }

        if (this._switcher) {
            let selectedIndex = this._switcher._selectedIndex;
            if (this._state === AltTabState.DELAY) {
                const nelement = this._switcher._items.length;
                if (nelement > 1) {
                    selectedIndex = getIndexForProgress(this._progress, nelement, this._dummyWinCount);
                }
            }

            const win = this._switcher._items[selectedIndex]?.window;
            if (win) {
                if (typeof win.activate === 'function') {
                    win.activate(global.get_current_time());
                } else {
                    Main.activateWindow(win);
                }
            }

            this._switcher.destroy();
            this._switcher = null;
        }

        this._reset();
    }

    cancelGesture() {
        if (this._altTabTimeoutId) {
            GLib.source_remove(this._altTabTimeoutId);
            this._altTabTimeoutId = 0;
        }

        if (this._switcher) {
            this._switcher.destroy();
            this._switcher = null;
        }

        this._reset();
    }

    _reset() {
        this._uninhibitUnredirect();

        if (this._altTabTimeoutId) {
            GLib.source_remove(this._altTabTimeoutId);
            this._altTabTimeoutId = 0;
        }

        this._progress = 0;
        this._dummyWinCount = DEFAULT_DUMMY_WIN_COUNT;
        this._state = AltTabState.IDLE;
    }

    _getEligibleWindows() {
        const activeWs = global.workspace_manager.get_active_workspace();
        const tabList = global.display.get_tab_list(Meta.TabList.NORMAL, activeWs);
        return tabList
            .map(w => (w.is_attached_dialog() ? w.get_transient_for() : w))
            .filter((w, idx, arr) => w && !w.skip_taskbar && arr.indexOf(w) === idx);
    }

    switchNext() {
        const windows = this._getEligibleWindows();
        if (windows.length > 1) {
            Main.activateWindow(windows[1]);
        }
    }

    switchPrev() {
        const windows = this._getEligibleWindows();
        if (windows.length > 1) {
            Main.activateWindow(windows[windows.length - 1]);
        }
    }

    destroy() {
        this.cancelGesture();
    }
}
