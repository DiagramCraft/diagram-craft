import type { Application } from './application';
import { AbstractAction, AbstractToggleAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { assert } from '@diagram-craft/utils/assert';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { mainMenuStructure } from './react-app/mainMenuData';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';

const updateState = (e: MenuEntry, app: Application, recurse: boolean = false) => {
  const state = { enabled: true, checked: false };
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

export const ElectronIntegration = {
  bindActions: (app: Application) => {
    if (!window.electronAPI) return;

    app.actions.FILE_SAVE = new ElectronFileSaveAction(app);
    app.actions.FILE_SAVE_AS = new ElectronFileSaveAsAction(app);
    app.actions.FILE_OPEN = new ElectronFileOpenAction(app);

    window.electronAPI.onMenuAction(actionId => {
      const action = app.actions[actionId];
      if (!action) {
        console.warn(`Action ${actionId} not found`);
        return;
      }

      action.execute({});
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

    window.electronAPI?.setMenu(mainMenuStructure);

    setTimeout(() => {
      if (window.electronAPI?.platform === 'darwin') {
        // @ts-ignore
        document.getElementById('menu')!.style['app-region'] = 'drag';
        // @ts-ignore
        document.getElementsByClassName('_menu-button')[0]!.style.display = 'none';
      }
    }, 100);
  }
};

class ElectronFileSaveAction extends AbstractAction<undefined, Application> {
  constructor(application: Application) {
    super(application);
  }

  getCriteria(application: Application) {
    return [ActionCriteria.Simple(() => !!application.model.activeDocument.url)];
  }

  execute(): void {
    const url = this.context.model.activeDocument.url;
    assert.present(url);

    serializeDiagramDocument(this.context.model.activeDocument!).then(async e => {
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
  constructor(application: Application) {
    super(application);
  }

  getCriteria(application: Application) {
    return [ActionCriteria.Simple(() => !!application.model.activeDocument.url)];
  }

  execute(): void {
    const url = this.context.model.activeDocument.url;
    assert.present(url);

    serializeDiagramDocument(this.context.model.activeDocument!).then(async e => {
      const serialized = JSON.stringify(e);

      window.electronAPI?.fileSaveAs(url, serialized).then(async (result: string | undefined) => {
        if (!result) {
          console.log('Error');
        } else {
          this.context.file.clearDirty();
        }
      });
    });
  }
}

class ElectronFileOpenAction extends AbstractAction<unknown, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    window.electronAPI?.fileOpen()?.then(async (result: { url: string } | undefined) => {
      if (!result) throw new Error();

      const url = result.url;
      this.context.file.loadDocument(url);
    });
  }
}
