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
     * Switches workspace based on gesture motion direction.
     * In standard natural physics (GNOME/macOS):
     * - Swiping fingers LEFT drags the viewport left, revealing the workspace to the RIGHT (+1).
     * - Swiping fingers RIGHT reveals the workspace to the LEFT (-1).
     * - Swiping fingers UP reveals the next workspace down (+1).
     * - Swiping fingers DOWN reveals the previous workspace up (-1).
     * @param {'left'|'right'|'up'|'down'} direction - Direction fingers moved
     */
    switchWorkspace(direction) {
        const wsManager = global.workspace_manager;
        const activeWs = wsManager.get_active_workspace();
        const activeIdx = activeWs.index;
        const total = wsManager.n_workspaces;
        if (total <= 1) return;

        let isForward = (direction === 'left' || direction === 'up');
        if (this._isInverted()) {
            isForward = !isForward;
        }

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
