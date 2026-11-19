import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

class VirtualKeyboard {
    constructor() {
        this._virtualDevice = null;
        this._timeoutIds = new Set();
        this._initDevice();
    }

    _initDevice() {
        try {
            const seat = Clutter.get_default_backend().get_default_seat();
            this._virtualDevice = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        } catch (e) {
            console.error('[TouchpadGestures] Failed to initialize virtual keyboard device:', e);
        }
    }

    _getDevice() {
        if (!this._virtualDevice) {
            this._initDevice();
        }
        return this._virtualDevice;
    }

    /**
     * Sends a sequence of keys with proper modifier sequencing and duration.
     * @param {number[]} keys - Array of Clutter keysyms (modifiers first, trigger key last)
     */
    sendKeyCombination(keys) {
        const device = this._getDevice();
        if (!device || !keys || keys.length === 0) return;

        const baseTimeUs = GLib.get_monotonic_time();

        // 1. Press modifiers and trigger keys with a slight microsecond stagger
        for (let i = 0; i < keys.length; i++) {
            const pressTime = baseTimeUs + (i * 2000); // 2ms stagger
            device.notify_keyval(pressTime, keys[i], Clutter.KeyState.PRESSED);
        }

        // 2. Hold keys for 35ms (ensures GTK, Wayland compositor, Chrome, and Firefox register the combo)
        const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 35, () => {
            const releaseBaseTime = GLib.get_monotonic_time();
            // Release in reverse order with stagger
            for (let i = keys.length - 1; i >= 0; i--) {
                const releaseTime = releaseBaseTime + ((keys.length - 1 - i) * 2000);
                device.notify_keyval(releaseTime, keys[i], Clutter.KeyState.RELEASED);
            }
            this._timeoutIds.delete(timeoutId);
            return GLib.SOURCE_REMOVE;
        });

        this._timeoutIds.add(timeoutId);
    }

    closeTab() {
        this.sendKeyCombination([Clutter.KEY_Control_L, Clutter.KEY_w]);
    }

    newTab() {
        this.sendKeyCombination([Clutter.KEY_Control_L, Clutter.KEY_t]);
    }

    nextTab() {
        this.sendKeyCombination([Clutter.KEY_Control_L, Clutter.KEY_Page_Down]);
    }

    prevTab() {
        this.sendKeyCombination([Clutter.KEY_Control_L, Clutter.KEY_Page_Up]);
    }

    historyBack() {
        this.sendKeyCombination([Clutter.KEY_Alt_L, Clutter.KEY_Left]);
    }

    historyForward() {
        this.sendKeyCombination([Clutter.KEY_Alt_L, Clutter.KEY_Right]);
    }

    destroy() {
        for (const id of this._timeoutIds) {
            GLib.source_remove(id);
        }
        this._timeoutIds.clear();
        this._virtualDevice = null;
    }
}

let _instance = null;

export function getKeyboard() {
    if (!_instance) {
        _instance = new VirtualKeyboard();
    }
    return _instance;
}

export function cleanupKeyboard() {
    if (_instance) {
        _instance.destroy();
        _instance = null;
    }
}
