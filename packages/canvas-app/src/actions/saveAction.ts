import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';

declare global {
  interface ActionMap {
    FILE_SAVE: SaveAction;
  }
}

export const saveActions: ActionMapFactory = (state: State) => ({
  FILE_SAVE: new SaveAction(state.diagram)
});
export class SaveAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    serializeDiagramDocument(this.diagram.document!).then(e => {
      console.log(JSON.stringify(e, undefined, '  '));
    });
  }
}
