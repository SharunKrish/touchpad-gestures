import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { showOsd, resetOsdLevelTransitions } from './osd.js';

const SCREEN_INTERFACE = `
<node>
  <interface name="org.gnome.SettingsDaemon.Power.Screen">
    <property name="Brightness" type="i" access="readwrite"/>
    <method name="StepUp">
      <arg type="i" name="new_percentage" direction="out"/>
      <arg type="s" name="connector" direction="out"/>
    </method>
    <method name="StepDown">
      <arg type="i" name="new_percentage" direction="out"/>
      <arg type="s" name="connector" direction="out"/>
    </method>
  </interface>
</node>`;

const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(SCREEN_INTERFACE);

export class BrightnessManager {
    constructor() {
        this._nativeScale = Main.brightnessManager?.globalScale ?? null;
        this._proxy = null;
        this._currentBrightness = 50;
        this._inGesture = false;
        this._pendingTarget = null;
        this._pushTimeoutId = 0;
        this._settleTimeoutId = 0;
        this._nativeScaleChangedId = 0;
        this._propChangedId = 0;

        if (this._nativeScale) {
            // GNOME 50+ native in-process brightness manager (zero latency, direct backlight sync)
            this._currentBrightness = Math.round(this._nativeScale.value * 100);
            this._nativeScaleChangedId = this._nativeScale.connect('notify::value', () => {
                if (!this._inGesture && this._nativeScale) {
                    this._currentBrightness = Math.round(this._nativeScale.value * 100);
                }
            });
        } else {
            // GNOME 45-47 fallback via SettingsDaemon Power Screen proxy
            try {
                this._proxy = new BrightnessProxy(
                    Gio.DBus.session,
                    'org.gnome.SettingsDaemon.Power',
                    '/org/gnome/SettingsDaemon/Power',
                    (proxy, error) => {
                        if (error) {
                            console.error('[TouchpadGestures] Brightness proxy init error:', error);
                        } else if (this._proxy) {
                            this._syncBrightness();
                            this._propChangedId = this._proxy.connect('g-properties-changed', () => {
                                if (!this._inGesture) {
                                    this._syncBrightness();
                                }
                            });
                        }
                    }
                );
            } catch (e) {
                console.error('[TouchpadGestures] Failed to initialize BrightnessProxy:', e);
            }
        }
    }

    _syncBrightness() {
        if (this._nativeScale) {
            this._currentBrightness = Math.round(this._nativeScale.value * 100);
        } else if (this._proxy && Number.isInteger(this._proxy.Brightness)) {
            this._currentBrightness = this._proxy.Brightness;
        }
    }

    _showOsd(brightness) {
        const icon = Gio.Icon.new_for_string('display-brightness-symbolic');
        const level = Math.max(0, Math.min(1.0, brightness / 100));

        showOsd(icon, null, level, 1.0);
        resetOsdLevelTransitions(level);
    }

    adjust(deltaPercent) {
        if (!this._nativeScale && !this._proxy) return;

        if (this._settleTimeoutId) {
            GLib.source_remove(this._settleTimeoutId);
            this._settleTimeoutId = 0;
        }

        this._inGesture = true;
        this._currentBrightness = Math.max(0, Math.min(100, this._currentBrightness + deltaPercent));
        const targetInt = Math.round(this._currentBrightness);

        if (this._nativeScale) {
            this._nativeScale.value = targetInt / 100;
            this._showOsd(targetInt);
            return;
        }

        // D-Bus fallback throttling for GNOME 45-47
        this._showOsd(targetInt);
        this._pendingTarget = targetInt;
        if (!this._pushTimeoutId) {
            this._pushTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
                if (this._proxy && this._pendingTarget !== null) {
                    this._proxy.Brightness = this._pendingTarget;
                }
                this._pushTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    finish() {
        if (this._pushTimeoutId) {
            GLib.source_remove(this._pushTimeoutId);
            this._pushTimeoutId = 0;
        }

        if (this._nativeScale) {
            this._nativeScale.value = Math.round(this._currentBrightness) / 100;
        } else if (this._proxy && this._pendingTarget !== null) {
            this._proxy.Brightness = this._pendingTarget;
            this._pendingTarget = null;
        }

        if (this._settleTimeoutId) {
            GLib.source_remove(this._settleTimeoutId);
        }
        this._settleTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
            this._inGesture = false;
            this._syncBrightness();
            this._settleTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {
        if (this._pushTimeoutId) {
            GLib.source_remove(this._pushTimeoutId);
            this._pushTimeoutId = 0;
        }
        if (this._settleTimeoutId) {
            GLib.source_remove(this._settleTimeoutId);
            this._settleTimeoutId = 0;
        }
        if (this._nativeScaleChangedId && this._nativeScale) {
            this._nativeScale.disconnect(this._nativeScaleChangedId);
            this._nativeScaleChangedId = 0;
        }
        if (this._propChangedId && this._proxy) {
            this._proxy.disconnect(this._propChangedId);
            this._propChangedId = 0;
        }
        this._nativeScale = null;
        this._proxy = null;
    }
}
