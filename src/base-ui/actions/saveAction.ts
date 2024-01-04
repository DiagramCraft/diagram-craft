import { EventEmitter } from '../../utils/event.ts';
import { ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { serializeDiagramDocument } from '../../model/serialization/serialize.ts';

declare global {
  interface ActionMap {
    FILE_SAVE: SaveAction;
  }
}

export const saveActions: ActionMapFactory = (state: State) => ({
  FILE_SAVE: new SaveAction(state.diagram)
});
export class SaveAction extends EventEmitter<ActionEvents> {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    console.log(JSON.stringify(serializeDiagramDocument(this.diagram.document!), undefined, '  '));
  }
}
