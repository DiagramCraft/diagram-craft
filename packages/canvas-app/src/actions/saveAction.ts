import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import {
  serializeDiagramDocument,
  serializeDiagramElement
} from '@diagram-craft/model/serialization/serialize';

declare global {
  interface ActionMap {
    FILE_SAVE: SaveAction;
    SELECTION_DUMP: DumpSelectionAction;
  }
}

export const saveActions: ActionMapFactory = (state: State) => ({
  FILE_SAVE: new SaveAction(state.diagram),
  SELECTION_DUMP: new DumpSelectionAction(state.diagram)
});

class SaveAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    serializeDiagramDocument(this.diagram.document!).then(e => {
      console.log(JSON.stringify(e, undefined, '  '));
    });
  }
}

class DumpSelectionAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    this.diagram.selectionState.elements.forEach(e => {
      const s = serializeDiagramElement(e);
      console.log(JSON.stringify(s, undefined, '  '));
    });
  }
}
