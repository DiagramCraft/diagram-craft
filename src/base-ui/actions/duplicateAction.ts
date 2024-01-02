import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { NodeAddUndoableAction } from '../../model/diagramUndoActions.ts';
import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { Translation } from '../../geometry/transform.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

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
    const uow = new UnitOfWork(this.diagram);
    for (const el of this.diagram.selectionState.nodes) {
      const newEl = el.duplicate();
      newEl.transform([new Translation({ x: OFFSET, y: OFFSET })], uow, 'non-interactive');
      newElements.push(newEl);
    }

    this.diagram.undoManager.addAndExecute(
      new NodeAddUndoableAction(newElements, this.diagram, 'Duplicate nodes')
    );

    // We commit after adding to the layer so that any change events
    // are fired after
    uow.commit();

    this.diagram.selectionState.clear();
    this.diagram.selectionState.setElements(newElements);

    this.emit('actiontriggered', { action: this });
  }
}
