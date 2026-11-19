import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { GestureEngine } from './src/gestureEngine.js';
import { cleanupKeyboard } from './src/keyboard.js';

export default class TouchpadGesturesExtension extends Extension {
    enable() {
        console.log(`[TouchpadGestures] Enabling ${this.metadata.name}...`);
        this._settings = this.getSettings();
        this._reloadTimeoutId = 0;
        this._engine = new GestureEngine(this._settings);

        this._settingsChangedId = this._settings.connect('changed', () => {
            if (this._reloadTimeoutId) {
                GLib.source_remove(this._reloadTimeoutId);
            }
            // Debounce re-initialization so rapid slider tweaks in prefs don't thrash the stage listener
            this._reloadTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                console.log('[TouchpadGestures] Settings changed, applying new configuration...');
                this._engine?.destroy();
                if (this._settings) {
                    this._engine = new GestureEngine(this._settings);
                }
                this._reloadTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    disable() {
        console.log(`[TouchpadGestures] Disabling ${this.metadata.name}...`);

        if (this._reloadTimeoutId) {
            GLib.source_remove(this._reloadTimeoutId);
            this._reloadTimeoutId = 0;
        }

        if (this._settingsChangedId && this._settings) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        if (this._engine) {
            this._engine.destroy();
            this._engine = null;
        }

        cleanupKeyboard();
        this._settings = null;
    }
}
