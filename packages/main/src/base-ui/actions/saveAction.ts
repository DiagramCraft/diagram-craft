import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { serializeDiagramDocument } from '../../model/serialization/serialize.ts';
import { AbstractAction } from '../action.ts';

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
