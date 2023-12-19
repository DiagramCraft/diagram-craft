import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Box } from '../../geometry/box.ts';
import { newid } from '../../utils/id.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { NodeAddAction } from '../../model/diagramUndoActions.ts';
import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';

declare global {
  interface ActionMap {
    DUPLICATE: DuplicateAction;
  }
}

export const duplicateActions: ActionMapFactory = (state: State) => ({
  DUPLICATE: new DuplicateAction(state.diagram)
});

const OFFSET = 10;

export class DuplicateAction extends AbstractSelectionAction {
  constructor(protected readonly diagram: Diagram) {
    super(diagram);
  }

  execute() {
    // TODO: Support cloning of edges
    const newElements: DiagramNode[] = [];
    for (const el of this.diagram.selectionState.nodes) {
      const newEl = el.clone();
      newEl.id = newid();

      const newBounds = Box.asMutableSnapshot(newEl.bounds);
      newBounds.get('pos').x += OFFSET;
      newBounds.get('pos').y += OFFSET;
      newEl.bounds = newBounds.getSnapshot();

      newElements.push(newEl);
    }

    this.diagram.undoManager.addAndExecute(
      new NodeAddAction(newElements, this.diagram, 'Clone nodes')
    );

    this.diagram.selectionState.clear();
    this.diagram.selectionState.setElements(newElements, true);

    this.emit('actiontriggered', { action: this });
  }
}
