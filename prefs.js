import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
const _ = str => str;

export default class TouchpadGesturesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const actionLabels = [
            _('None (Disabled)'),
            _('Activities Overview'),
            _('Application Grid'),
            _('Switch to Next Workspace'),
            _('Switch to Previous Workspace'),
            _('Window Switching (Alt+Tab)'),
            _('Close Focused Window'),
            _('Maximize Focused Window'),
            _('Minimize Focused Window'),
            _('Tile Window Left'),
            _('Tile Window Right'),
            _('Show Desktop (Toggle Minimize)'),
            _('Open Notification Center'),
            _('Open Quick Settings Panel'),
            _('Capture Fullscreen Screenshot'),
            _('Open Interactive Screenshot UI (PrtScreen)'),
            _('Increase Volume (+5%)'),
            _('Decrease Volume (-5%)'),
            _('Smooth Volume Control (Continuous)'),
            _('Increase Brightness (+8%)'),
            _('Decrease Brightness (-8%)'),
            _('Smooth Brightness Control (Continuous)'),
            _('Next Browser Tab (Ctrl+Tab)'),
            _('Previous Browser Tab (Ctrl+Shift+Tab)'),
            _('New Browser Tab (Ctrl+T)'),
            _('Close Browser Tab (Ctrl+W)'),
            _('Launch Terminal'),
        ];

        // =============================================================
        // Page 1: 3-Finger Gestures
        // =============================================================
        const page3fg = new Adw.PreferencesPage({
            title: _('3-Finger Gestures'),
            icon_name: 'input-touchpad-symbolic',
        });
        window.add(page3fg);

        const group3fgSwipes = new Adw.PreferencesGroup({
            title: _('3-Finger Swipes'),
            description: _('Configure actions for directional 3-finger swipes.'),
        });
        page3fg.add(group3fgSwipes);

        group3fgSwipes.add(this._createComboRow(
            _('Swipe Up'),
            _('Action when swiping up with 3 fingers'),
            actionLabels,
            settings,
            'swipe-3fg-up'
        ));

        group3fgSwipes.add(this._createComboRow(
            _('Swipe Down'),
            _('Action when swiping down with 3 fingers'),
            actionLabels,
            settings,
            'swipe-3fg-down'
        ));

        group3fgSwipes.add(this._createComboRow(
            _('Swipe Left'),
            _('Action when swiping left with 3 fingers'),
            actionLabels,
            settings,
            'swipe-3fg-left'
        ));

        group3fgSwipes.add(this._createComboRow(
            _('Swipe Right'),
            _('Action when swiping right with 3 fingers'),
            actionLabels,
            settings,
            'swipe-3fg-right'
        ));

        const group3fgPinch = new Adw.PreferencesGroup({
            title: _('3-Finger Pinches and Clicks'),
            description: _('Squeeze, expand, or tap using 3 fingers.'),
        });
        page3fg.add(group3fgPinch);

        group3fgPinch.add(this._createComboRow(
            _('Pinch In'),
            _('Squeeze 3 fingers together'),
            actionLabels,
            settings,
            'pinch-3fg-in'
        ));

        group3fgPinch.add(this._createComboRow(
            _('Pinch Out'),
            _('Spread 3 fingers apart'),
            actionLabels,
            settings,
            'pinch-3fg-out'
        ));

        group3fgPinch.add(this._createComboRow(
            _('3-Finger Click / Tap'),
            _('Tap or physical click with 3 fingers (Middle Click)'),
            actionLabels,
            settings,
            'click-3fg'
        ));

        // =============================================================
        // Page 2: 4-Finger Gestures
        // =============================================================
        const page4fg = new Adw.PreferencesPage({
            title: _('4-Finger Gestures'),
            icon_name: 'input-touchpad-symbolic',
        });
        window.add(page4fg);

        const group4fgSwipes = new Adw.PreferencesGroup({
            title: _('4-Finger Swipes'),
            description: _('Configure actions for directional 4-finger swipes.'),
        });
        page4fg.add(group4fgSwipes);

        group4fgSwipes.add(this._createComboRow(
            _('Swipe Up'),
            _('Action when swiping up with 4 fingers'),
            actionLabels,
            settings,
            'swipe-4fg-up'
        ));

        group4fgSwipes.add(this._createComboRow(
            _('Swipe Down'),
            _('Action when swiping down with 4 fingers'),
            actionLabels,
            settings,
            'swipe-4fg-down'
        ));

        group4fgSwipes.add(this._createComboRow(
            _('Swipe Left'),
            _('Action when swiping left with 4 fingers'),
            actionLabels,
            settings,
            'swipe-4fg-left'
        ));

        group4fgSwipes.add(this._createComboRow(
            _('Swipe Right'),
            _('Action when swiping right with 4 fingers'),
            actionLabels,
            settings,
            'swipe-4fg-right'
        ));

        const group4fgPinch = new Adw.PreferencesGroup({
            title: _('4-Finger Pinches and Clicks'),
            description: _('Squeeze, expand, or tap using 4 fingers.'),
        });
        page4fg.add(group4fgPinch);

        group4fgPinch.add(this._createComboRow(
            _('Pinch In'),
            _('Squeeze 4 fingers together'),
            actionLabels,
            settings,
            'pinch-4fg-in'
        ));

        group4fgPinch.add(this._createComboRow(
            _('Pinch Out'),
            _('Spread 4 fingers apart'),
            actionLabels,
            settings,
            'pinch-4fg-out'
        ));

        group4fgPinch.add(this._createComboRow(
            _('4-Finger Click / Tap'),
            _('Tap or physical click with 4 fingers'),
            actionLabels,
            settings,
            'click-4fg'
        ));

        // =============================================================
        // Page 3: 2-Finger Gestures
        // =============================================================
        const page2fg = new Adw.PreferencesPage({
            title: _('2-Finger Gestures'),
            icon_name: 'view-fullscreen-symbolic',
        });
        window.add(page2fg);

        const group2fg = new Adw.PreferencesGroup({
            title: _('2-Finger Pinch and Click'),
            description: _('Note: Set to None (Disabled) to preserve native browser page zoom.'),
        });
        page2fg.add(group2fg);

        group2fg.add(this._createComboRow(
            _('Pinch In'),
            _('Squeeze 2 fingers together'),
            actionLabels,
            settings,
            'pinch-2fg-in'
        ));

        group2fg.add(this._createComboRow(
            _('Pinch Out'),
            _('Spread 2 fingers apart'),
            actionLabels,
            settings,
            'pinch-2fg-out'
        ));

        group2fg.add(this._createComboRow(
            _('2-Finger Click / Tap'),
            _('Tap or physical click with 2 fingers (Right Click)'),
            actionLabels,
            settings,
            'click-2fg'
        ));

        // =============================================================
        // Page 4: Behavior & Tuning
        // =============================================================
        const pageTuning = new Adw.PreferencesPage({
            title: _('Tuning & Options'),
            icon_name: 'preferences-other-symbolic',
        });
        window.add(pageTuning);

        const groupSens = new Adw.PreferencesGroup({
            title: _('Gesture Sensitivity Multipliers'),
            description: _('Calibrate responsiveness for touchpad dimensions and trackpad hardware.'),
        });
        pageTuning.add(groupSens);

        const swipeSensRow = new Adw.SpinRow({
            title: _('Swipe Sensitivity Multiplier'),
            subtitle: _('Lower values require longer swipes, higher values trigger faster'),
            adjustment: new Gtk.Adjustment({
                lower: 0.5,
                upper: 3.0,
                step_increment: 0.1,
                page_increment: 0.5,
                value: settings.get_double('swipe-sensitivity'),
            }),
            digits: 1,
        });
        groupSens.add(swipeSensRow);
        settings.bind('swipe-sensitivity', swipeSensRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const pinchSensRow = new Adw.SpinRow({
            title: _('Pinch Sensitivity Multiplier'),
            subtitle: _('Higher values require smaller squeeze/spread movement to trigger'),
            adjustment: new Gtk.Adjustment({
                lower: 0.5,
                upper: 3.0,
                step_increment: 0.1,
                page_increment: 0.5,
                value: settings.get_double('pinch-sensitivity'),
            }),
            digits: 1,
        });
        groupSens.add(pinchSensRow);
        settings.bind('pinch-sensitivity', pinchSensRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const volSpeedRow = new Adw.SpinRow({
            title: _('Volume Speed Multiplier'),
            subtitle: _('Rate of volume step changes relative to swipe distance'),
            adjustment: new Gtk.Adjustment({
                lower: 0.2,
                upper: 4.0,
                step_increment: 0.1,
                page_increment: 0.5,
                value: settings.get_double('volume-speed'),
            }),
            digits: 1,
        });
        groupSens.add(volSpeedRow);
        settings.bind('volume-speed', volSpeedRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const brightSpeedRow = new Adw.SpinRow({
            title: _('Brightness Speed Multiplier'),
            subtitle: _('Rate of screen backlight change relative to swipe distance'),
            adjustment: new Gtk.Adjustment({
                lower: 0.2,
                upper: 4.0,
                step_increment: 0.1,
                page_increment: 0.5,
                value: settings.get_double('brightness-speed'),
            }),
            digits: 1,
        });
        groupSens.add(brightSpeedRow);
        settings.bind('brightness-speed', brightSpeedRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const groupBehavior = new Adw.PreferencesGroup({
            title: _('Behavior Options'),
        });
        pageTuning.add(groupBehavior);

        const cyclicWsRow = new Adw.SwitchRow({
            title: _('Cyclic Workspace Switching'),
            subtitle: _('Wrap from the last workspace back to the first workspace and vice-versa'),
        });
        groupBehavior.add(cyclicWsRow);
        settings.bind('cyclic-workspaces', cyclicWsRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const minimizeRow = new Adw.SwitchRow({
            title: _('Allow Swiping Down to Minimize'),
            subtitle: _('When swiping down on an unmaximized window, minimize it'),
        });
        groupBehavior.add(minimizeRow);
        settings.bind('allow-minimize', minimizeRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const fullscreenRow = new Adw.SwitchRow({
            title: _('Allow Swiping Up for Fullscreen'),
            subtitle: _('When swiping up on an already-maximized window, make it fullscreen'),
        });
        groupBehavior.add(fullscreenRow);
        settings.bind('allow-fullscreen', fullscreenRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _createComboRow(title, subtitle, labels, settings, key) {
        const model = new Gtk.StringList();
        for (const label of labels) {
            model.append(label);
        }

        const row = new Adw.ComboRow({
            title,
            subtitle,
            model,
            selected: settings.get_enum(key),
        });

        row.connect('notify::selected', () => {
            if (settings.get_enum(key) !== row.selected) {
                settings.set_enum(key, row.selected);
            }
        });

        return row;
    }
}
