import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { resolveAdjustmentAction } from './src/actions.js';

const _ = str => str;

export default class TouchpadGesturesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const actionLabels = [
            _('Disabled'),
            _('Overview'),
            _('App Grid'),
            _('Next Workspace'),
            _('Previous Workspace'),
            _('Switch Windows'),
            _('Close Window'),
            _('Maximize Window'),
            _('Minimize Window'),
            _('Tile Left'),
            _('Tile Right'),
            _('Show Desktop'),
            _('Notification Center'),
            _('Quick Settings'),
            _('Full Screenshot'),
            _('Screenshot Tool'),
            _('Volume Up'),
            _('Volume Down'),
            null, // Saved legacy action
            _('Brightness Up'),
            _('Brightness Down'),
            null, // Saved legacy action
            _('Next Tab'),
            _('Previous Tab'),
            _('New Tab'),
            _('Close Tab'),
            _('Open Terminal'),
        ];
        const actions = actionLabels.flatMap((label, action) => label === null ? [] : [action]);
        const actionModel = Gtk.StringList.new(actions.map(action => actionLabels[action]));

        // =============================================================
        // Page 1: 3-Finger Gestures
        // =============================================================
        const page3fg = new Adw.PreferencesPage({
            title: _('3 Fingers'),
            icon_name: 'input-touchpad-symbolic',
        });
        window.add(page3fg);

        const group3fgSwipes = new Adw.PreferencesGroup({
            title: _('Swipes'),
        });
        page3fg.add(group3fgSwipes);

        group3fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Up'),
            actionModel,
            settings,
            'swipe-3fg-up'
        ));

        group3fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Down'),
            actionModel,
            settings,
            'swipe-3fg-down'
        ));

        group3fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Left'),
            actionModel,
            settings,
            'swipe-3fg-left'
        ));

        group3fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Right'),
            actionModel,
            settings,
            'swipe-3fg-right'
        ));

        const group3fgPinch = new Adw.PreferencesGroup({
            title: _('Pinch'),
        });
        page3fg.add(group3fgPinch);

        group3fgPinch.add(this._createComboRow(
            actions,
            _('Pinch In'),
            actionModel,
            settings,
            'pinch-3fg-in'
        ));

        group3fgPinch.add(this._createComboRow(
            actions,
            _('Pinch Out'),
            actionModel,
            settings,
            'pinch-3fg-out'
        ));

        const group3fgTap = new Adw.PreferencesGroup({
            title: _('Tap'),
            description: _('Tap over the top bar or Overview.'),
        });
        page3fg.add(group3fgTap);

        group3fgTap.add(this._createComboRow(
            actions,
            _('Click / Tap'),
            actionModel,
            settings,
            'click-3fg'
        ));

        // =============================================================
        // Page 2: 4-Finger Gestures
        // =============================================================
        const page4fg = new Adw.PreferencesPage({
            title: _('4 Fingers'),
            icon_name: 'input-touchpad-symbolic',
        });
        window.add(page4fg);

        const group4fgSwipes = new Adw.PreferencesGroup({
            title: _('Swipes'),
        });
        page4fg.add(group4fgSwipes);

        group4fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Up'),
            actionModel,
            settings,
            'swipe-4fg-up'
        ));

        group4fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Down'),
            actionModel,
            settings,
            'swipe-4fg-down'
        ));

        group4fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Left'),
            actionModel,
            settings,
            'swipe-4fg-left'
        ));

        group4fgSwipes.add(this._createComboRow(
            actions,
            _('Swipe Right'),
            actionModel,
            settings,
            'swipe-4fg-right'
        ));

        const group4fgPinch = new Adw.PreferencesGroup({
            title: _('Pinch'),
        });
        page4fg.add(group4fgPinch);

        group4fgPinch.add(this._createComboRow(
            actions,
            _('Pinch In'),
            actionModel,
            settings,
            'pinch-4fg-in'
        ));

        group4fgPinch.add(this._createComboRow(
            actions,
            _('Pinch Out'),
            actionModel,
            settings,
            'pinch-4fg-out'
        ));

        // =============================================================
        // Page 3: 2-Finger Gestures
        // =============================================================
        const page2fg = new Adw.PreferencesPage({
            title: _('2 Fingers'),
            icon_name: 'view-fullscreen-symbolic',
        });
        window.add(page2fg);

        const group2fg = new Adw.PreferencesGroup({
            title: _('Pinch'),
            description: _('Leave both pinches disabled to keep browser zoom.'),
        });
        page2fg.add(group2fg);

        group2fg.add(this._createComboRow(
            actions,
            _('Pinch In'),
            actionModel,
            settings,
            'pinch-2fg-in'
        ));

        group2fg.add(this._createComboRow(
            actions,
            _('Pinch Out'),
            actionModel,
            settings,
            'pinch-2fg-out'
        ));

        const group2fgTap = new Adw.PreferencesGroup({
            title: _('Tap'),
            description: _('Reported as right-click.'),
        });
        page2fg.add(group2fgTap);

        group2fgTap.add(this._createComboRow(
            actions,
            _('Click / Tap'),
            actionModel,
            settings,
            'click-2fg'
        ));

        // =============================================================
        // Page 4: Behavior & Tuning
        // =============================================================
        const pageTuning = new Adw.PreferencesPage({
            title: _('Tuning'),
            icon_name: 'preferences-other-symbolic',
        });
        window.add(pageTuning);

        const groupSens = new Adw.PreferencesGroup({
            title: _('Sensitivity and Speed'),
        });
        pageTuning.add(groupSens);

        const swipeSensRow = new Adw.SpinRow({
            title: _('Swipe Sensitivity'),
            subtitle: _('Higher values trigger with a shorter swipe'),
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
            title: _('Pinch Sensitivity'),
            subtitle: _('Higher values trigger with a smaller pinch'),
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
            title: _('Volume Swipe Speed'),
            subtitle: _('Volume change per swipe distance'),
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
            title: _('Brightness Swipe Speed'),
            subtitle: _('Brightness change per swipe distance'),
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
            title: _('Behavior'),
        });
        pageTuning.add(groupBehavior);

        const cyclicWsRow = new Adw.SwitchRow({
            title: _('Wrap Workspaces'),
            subtitle: _('Cycle between the first and last workspaces'),
        });
        groupBehavior.add(cyclicWsRow);
        settings.bind('cyclic-workspaces', cyclicWsRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const minimizeRow = new Adw.SwitchRow({
            title: _('Swipe Down to Minimize'),
            subtitle: _('When the window is restored'),
        });
        groupBehavior.add(minimizeRow);
        settings.bind('allow-minimize', minimizeRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const fullscreenRow = new Adw.SwitchRow({
            title: _('Swipe Up for Fullscreen'),
            subtitle: _('When the window is maximized'),
        });
        groupBehavior.add(fullscreenRow);
        settings.bind('allow-fullscreen', fullscreenRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _createComboRow(actions, title, model, settings, key) {
        const increases = !key.startsWith('swipe-') || key.endsWith('-up') || key.endsWith('-right');
        const currentAction = resolveAdjustmentAction(settings.get_enum(key), increases);
        const row = new Adw.ComboRow({
            title,
            model,
            selected: actions.indexOf(currentAction),
        });

        row.connect('notify::selected', () => {
            const action = actions[row.selected];
            if (action !== undefined && action !== settings.get_enum(key))
                settings.set_enum(key, action);
        });

        return row;
    }
}
