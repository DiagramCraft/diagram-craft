import type { Application } from './application';
import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { assert } from '@diagram-craft/utils/assert';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';

export const ElectronIntegration = {
  bindActions: (app: Application) => {
    if (!window.electronAPI) return;

    app.actions.FILE_SAVE = new ElectronFileSaveAction(app);
    app.actions.FILE_OPEN = new ElectronFileOpenAction(app);

    window.electronAPI.onMenuAction(actionId => {
      const action = app.actions[actionId];
      if (!action) {
        console.warn(`Action ${actionId} not found`);
        return;
      }

      action.execute({});
    });
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
      const response = await fetch(`http://localhost:3000/api/fs/${url}`, {
        method: 'PUT',
        body: serialized,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      // TODO: Show error dialog
      if (data.status !== 'ok') {
        console.error('Failed to save document');
      } else {
        this.context.file.clearDirty();
      }
    });
  }
}

class ElectronFileOpenAction extends AbstractAction<unknown, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    window.electronAPI
      ?.fileOpen()
      ?.then(async (result: { url: string; content: string } | undefined) => {
        if (result) {
          await this.context.file.loadDocument(result.url, result.content);
        }
      });
  }
}
