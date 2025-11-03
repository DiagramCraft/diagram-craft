import type { Application } from './application';
import { AbstractAction, AbstractToggleAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { assert } from '@diagram-craft/utils/assert';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { mainMenuStructure } from './react-app/mainMenuData';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import { UserState } from './UserState';

const updateState = (e: MenuEntry, app: Application, recurse: boolean = false) => {
  const state = { enabled: true, checked: false, keybinding: '' };
  const action = app.actions[e.action ?? ''];
  if (action) {
    state.enabled = action.isEnabled(app);

    action.on('actionChanged', () => {
      state.enabled = action.isEnabled(app);
    });

    if (action instanceof AbstractToggleAction) {
      state.checked = action.getState({});
      action.on('actionChanged', () => {
        state.checked = action.getState({});
      });
    }
    window.electronAPI!.setMenuEntryState(e.id, state);
  }

  if (recurse) {
    for (const sub of e.submenu ?? []) {
      updateState(sub, app, true);
    }
  }
};

const getKeyBindings = (
  app: Application,
  mainMenuStructure: MenuEntry[],
  dest: Record<string, string>
) => {
  for (const e of mainMenuStructure) {
    const keybinding = Object.entries(app.keyMap).find(([_, v]) => v === e.action)?.[0] ?? '';
    if (keybinding !== '') {
      dest[e.id] = keybinding;
    }
    getKeyBindings(app, e.submenu ?? [], dest);
  }
};
export const ElectronIntegration = {
  bindActions: (app: Application) => {
    if (!window.electronAPI) return;

    const keybindings: Record<string, string> = {};
    getKeyBindings(app, mainMenuStructure, keybindings);

    window.electronAPI?.setMenu(mainMenuStructure, keybindings);

    app.actions.FILE_SAVE = new ElectronFileSaveAction(app);
    app.actions.FILE_SAVE_AS = new ElectronFileSaveAsAction(app);
    app.actions.FILE_OPEN = new ElectronFileOpenAction(app);

    window.electronAPI.removeAllListeners('menu:action');
    window.electronAPI.on('menu:action', actionId => {
      const action = app.actions[actionId];
      if (!action) {
        console.warn(`Action ${actionId} not found`);
        return;
      }

      action.execute({});
    });

    // Handle recent file opens
    window.electronAPI.removeAllListeners('file:recentFileOpen');
    window.electronAPI.on('file:recentFileOpen', (filePath: string) => {
      if (filePath) {
        app.file.loadDocument(filePath);
      }
    });

    for (const e of mainMenuStructure) {
      updateState(e, app, true);
    }
  },
  init: () => {
    if (!window.electronAPI) return;

    FileSystem.loadFromUrl = async (url: string) => {
      const res = await window.electronAPI?.fileLoad(url);
      if (!res) throw new Error();
      return res.content;
    };

    window.electronAPI.getUsername().then(r => {
      if (!r) return;
      UserState.get().awarenessState = { name: r, color: '#000000' };
    });
  }
};

class ElectronFileSaveAction extends AbstractAction<undefined, Application> {

  getCriteria(application: Application) {
    return [ActionCriteria.Simple(() => !!application.model.activeDocument.url)];
  }

  execute(): void {
    const url = this.context.model.activeDocument.url;
    assert.present(url);

    serializeDiagramDocument(this.context.model.activeDocument).then(async e => {
      const serialized = JSON.stringify(e);

      window.electronAPI?.fileSave(url, serialized).then(async (result: string | undefined) => {
        if (!result) {
          console.log('Error');
        } else {
          this.context.file.clearDirty();
        }
      });
    });
  }
}

class ElectronFileSaveAsAction extends AbstractAction<undefined, Application> {

  getCriteria(application: Application) {
    return [ActionCriteria.Simple(() => !!application.model.activeDocument.url)];
  }

  async execute(): Promise<void> {
    const url = this.context.model.activeDocument.url;
    assert.present(url);

    serializeDiagramDocument(this.context.model.activeDocument).then(async e => {
      const serialized = JSON.stringify(e);

      window.electronAPI?.fileSaveAs(url, serialized).then(async (result: string | undefined) => {
        if (!result) {
          console.log('Error');
        } else {
          this.context.model.activeDocument.url = result;
          this.context.file.clearDirty();
        }
      });
    });
  }
}

class ElectronFileOpenAction extends AbstractAction<unknown, Application> {

  execute(): void {
    window.electronAPI?.fileOpen()?.then(async (result: { url: string } | undefined) => {
      if (!result) throw new Error();

      const url = result.url;
      this.context.file.loadDocument(url);
    });
  }
}
