import { AbstractSelectionAction } from './abstractSelectionAction';
import { DiagramNode } from '@diagram-craft/model/index';
import { ElementAddUndoableAction } from '@diagram-craft/model/index';
import { Diagram } from '@diagram-craft/model/index';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { UnitOfWork } from '@diagram-craft/model/index';
import { Translation } from '@diagram-craft/geometry/transform';

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
    const uow = new UnitOfWork(this.diagram);

    const newElements: DiagramNode[] = [];
    for (const el of this.diagram.selectionState.nodes) {
      const newEl = el.duplicate();
      newEl.transform([new Translation({ x: OFFSET, y: OFFSET })], uow);
      newElements.push(newEl);
    }

    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction(newElements, this.diagram, 'Duplicate nodes')
    );

    // We commit after adding to the layer so that any change events
    // are fired after
    uow.commit();

    this.diagram.selectionState.clear();
    this.diagram.selectionState.setElements(newElements);

    this.emit('actiontriggered', { action: this });
  }
}
