import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Adw.init();
const resourceName = 'gnome-shell/org.gnome.Shell.Extensions.src.gresource';
const resourcePath = GLib.get_system_data_dirs()
    .map(dir => GLib.build_filenamev([dir, resourceName]))
    .find(path => GLib.file_test(path, GLib.FileTest.IS_REGULAR));
if (!resourcePath)
    throw new Error('GNOME Shell’s preferences resources are required to run this preview.');

Gio.resources_register(Gio.Resource.load(resourcePath));
const {default: PrefsClass} = await import('./prefs.js');
const extDir = Gio.File.new_for_uri(import.meta.url).get_parent();

const app = new Adw.Application({
    application_id: 'io.github.sharunkrish.TouchpadGesturesPrefsTest',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});

let failed = false;
app.connect('activate', () => {
    try {
        const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.touchpad-gestures-pro'});
        const prefs = new PrefsClass({
            uuid: 'touchpad-gestures@sharunkrish.github.io',
            name: 'Touchpad Gestures Pro',
            'gettext-domain': 'touchpad-gestures-pro',
            dir: extDir,
            path: extDir.get_path(),
        });

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
        failed = true;
        console.error('Failed to launch prefs preview:', err);
        app.quit();
    }
});

const status = app.run([]);
if (failed || status)
    throw new Error('Preferences preview did not complete successfully.');
