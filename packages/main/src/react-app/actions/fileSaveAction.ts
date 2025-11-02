import { AbstractAction, ActionCriteria } from '@diagram-craft/canvas/action';
import { assert } from '@diagram-craft/utils/assert';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { Application } from '../../application';
import { AppConfig } from '../../appConfig';

export const fileSaveActions = (application: Application) => ({
  FILE_SAVE: new FileSaveAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileSaveActions> {}
}

class FileSaveAction extends AbstractAction<undefined, Application> {
  getCriteria(application: Application) {
    return [ActionCriteria.Simple(() => !!application.model.activeDocument.url)];
  }

  execute(): void {
    const url = this.context.model.activeDocument.url;
    assert.present(url);

    serializeDiagramDocument(this.context.model.activeDocument).then(async e => {
      const serialized = JSON.stringify(e);
      const response = await fetch(`${AppConfig.get().filesystem.endpoint}/api/fs/${url}`, {
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
