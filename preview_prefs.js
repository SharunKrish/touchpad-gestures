import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

Adw.init();
try {
    Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')._register();
} catch (_e) {}

const app = new Adw.Application({
    application_id: 'io.github.sharunkrish.TouchpadGesturesPrefsTest',
    flags: Gio.ApplicationFlags.FLAGS_NONE,
});

app.connect('activate', async () => {
    try {
        const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            GLib.build_filenamev([GLib.get_current_dir(), 'ubuntu', 'touchpad-gestures', 'schemas']),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        const schemaObj = schemaSource.lookup('org.gnome.shell.extensions.touchpad-gestures-pro', false);
        const settings = new Gio.Settings({ settings_schema: schemaObj });

        // Import prefs class
        const prefsModule = await import('./prefs.js');
        const PrefsClass = prefsModule.default;
        const extDir = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_current_dir(), 'ubuntu', 'touchpad-gestures']));
        const prefs = new PrefsClass({
            uuid: 'touchpad-gestures@sharunkrish.github.io',
            name: 'Touchpad Gestures Pro',
            'gettext-domain': 'touchpad-gestures-pro',
            dir: extDir,
            path: extDir.get_path(),
        });

        // Stub getSettings
        prefs.getSettings = () => settings;

        const win = new Adw.PreferencesWindow({
            application: app,
            title: 'Touchpad Gestures Pro — Preferences Preview',
            default_width: 820,
            default_height: 680,
        });

        prefs.fillPreferencesWindow(win);
        win.present();
        console.log('PREFS_WINDOW_SHOWN');
    } catch (err) {
        console.error('Failed to launch prefs preview:', err);
        app.quit();
    }
});

app.run([]);
