import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class WorkspaceManager {
    constructor(settings) {
        this._settings = settings;
    }

    _isCyclic() {
        return this._settings.get_boolean('cyclic-workspaces');
    }

    _isInverted() {
        if (this._settings.settings_schema.has_key('invert-workspace-swipe')) {
            return this._settings.get_boolean('invert-workspace-swipe');
        }
        return false;
    }

    /**
     * Moves one workspace in the direction selected by the action.
     * @param {1|-1} step - Next or previous workspace
     */
    switchWorkspace(step) {
        const wsManager = global.workspace_manager;
        const activeWs = wsManager.get_active_workspace();
        const activeIdx = activeWs.index();
        const total = wsManager.n_workspaces;
        if (total <= 1) return;

        const isForward = this._isInverted() ? step < 0 : step > 0;

        let targetIdx = activeIdx;
        if (isForward) {
            if (activeIdx < total - 1) {
                targetIdx = activeIdx + 1;
            } else if (this._isCyclic()) {
                targetIdx = 0;
            }
        } else {
            if (activeIdx > 0) {
                targetIdx = activeIdx - 1;
            } else if (this._isCyclic()) {
                targetIdx = total - 1;
            }
        }

        if (targetIdx !== activeIdx) {
            const targetWs = wsManager.get_workspace_by_index(targetIdx);
            if (targetWs) {
                Main.wm.actionMoveWorkspace(targetWs);
            }
        }
    }

    destroy() {
        this._settings = null;
    }
}
