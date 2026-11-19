import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import { showOsd, resetOsdLevelTransitions } from './osd.js';

const VolumeIcons = [
    'audio-volume-muted-symbolic',
    'audio-volume-low-symbolic',
    'audio-volume-medium-symbolic',
    'audio-volume-high-symbolic',
    'audio-volume-overamplified-symbolic',
];

export class VolumeManager {
    constructor() {
        this._controller = Volume.getMixerControl();
        this._sink = this._controller.get_default_sink();
        this._sinkBinding = 0;
        this._inGesture = false;
        this._targetVolume = null;
        this._pushTimeoutId = 0;
        this._settleTimeoutId = 0;

        this._sinkBinding = this._controller.connect('default-sink-changed', (_c, id) => {
            this._sink = this._controller.lookup_stream_id(id);
            if (!this._inGesture && this._sink) {
                this._targetVolume = this._sink.volume;
            }
        });

        this._soundSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.sound',
        });
    }

    _getMaxNorm() {
        const norm = this._controller?.get_vol_max_norm();
        return (norm && norm > 0) ? norm : 65536;
    }

    _showOsd(volume) {
        const maxNorm = this._getMaxNorm();
        const level = volume / maxNorm;
        let iconIdx;

        if (volume === 0 || this._sink?.is_muted) {
            iconIdx = 0;
        } else if (level > 1.0) {
            iconIdx = 4;
        } else {
            iconIdx = Math.max(1, Math.min(3, Math.floor(3 * level + 1)));
        }

        const icon = Gio.Icon.new_for_string(VolumeIcons[iconIdx]);
        const isOveramp = this._soundSettings.get_boolean('allow-volume-above-100-percent');
        const maxRatio = (isOveramp && this._controller)
            ? (this._controller.get_vol_max_amplified() / maxNorm)
            : 1.0;

        showOsd(icon, null, level, maxRatio);
        resetOsdLevelTransitions(level);
    }

    adjust(deltaFraction) {
        if (!this._sink) {
            this._sink = this._controller?.get_default_sink();
            if (!this._sink) return;
        }

        const maxNorm = this._getMaxNorm();
        const isOveramp = this._soundSettings.get_boolean('allow-volume-above-100-percent');
        const maxAllowed = (isOveramp && this._controller)
            ? this._controller.get_vol_max_amplified()
            : maxNorm;

        if (this._settleTimeoutId) {
            GLib.source_remove(this._settleTimeoutId);
            this._settleTimeoutId = 0;
        }

        if (!this._inGesture || this._targetVolume === null) {
            this._inGesture = true;
            this._targetVolume = this._sink.volume;
        }

        this._targetVolume = Math.max(0, Math.min(maxAllowed, this._targetVolume + (deltaFraction * maxNorm)));
        const newVol = Math.round(this._targetVolume);

        if (newVol > 0 && this._sink.is_muted) {
            this._sink.change_is_muted(false);
        }

        // Instant visual feedback at full display refresh rate
        this._showOsd(this._targetVolume);

        // Throttle pushing volume to audio daemon (PulseAudio/PipeWire) to avoid event queue contention
        this._sink.volume = newVol;
        if (!this._pushTimeoutId) {
            this._pushTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 25, () => {
                if (this._sink) {
                    this._sink.push_volume();
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

        if (this._sink && this._targetVolume !== null) {
            this._sink.volume = Math.round(this._targetVolume);
            this._sink.push_volume();
        }

        // Settle before accepting asynchronous volume echoes from audio server
        if (this._settleTimeoutId) {
            GLib.source_remove(this._settleTimeoutId);
        }
        this._settleTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
            this._inGesture = false;
            if (this._sink) {
                this._targetVolume = this._sink.volume;
            }
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
        if (this._sinkBinding && this._controller) {
            this._controller.disconnect(this._sinkBinding);
            this._sinkBinding = 0;
        }
        this._controller = null;
        this._sink = null;
        this._soundSettings = null;
    }
}
