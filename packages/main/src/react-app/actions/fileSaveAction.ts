import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { assert } from '@diagram-craft/utils/assert';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { application } from '../../application';

export const fileSaveActions = (state: ActionConstructionParameters) => ({
  FILE_SAVE: new FileSaveAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileSaveActions> {}
}

class FileSaveAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();

    if (diagram.document.url) {
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  execute(): void {
    const url = this.diagram.document.url;
    assert.present(url);

    serializeDiagramDocument(this.diagram.document!).then(async e => {
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
        application.ui.clearDirty?.();
      }
    });
  }
}
