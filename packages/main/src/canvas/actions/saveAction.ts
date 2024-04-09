import { ActionMapFactory, State } from '../../canvas/keyMap.ts';
import { Diagram } from '@diagram-craft/model';
import { AbstractAction } from '../../canvas/action.ts';
import { serializeDiagramDocument } from '@diagram-craft/model';

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
    console.log(JSON.stringify(serializeDiagramDocument(this.diagram.document!), undefined, '  '));
  }
}
