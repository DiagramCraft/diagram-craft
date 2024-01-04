import { UndoableAction } from '../../model/undoManager.ts';
import { precondition } from '../../utils/assert.ts';
import { Diagram, StackPosition } from '../../model/diagram.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

declare global {
  interface ActionMap {
    SELECTION_RESTACK_UP: SelectionRestackAction;
    SELECTION_RESTACK_DOWN: SelectionRestackAction;
    SELECTION_RESTACK_BOTTOM: SelectionRestackAction;
    SELECTION_RESTACK_TOP: SelectionRestackAction;
  }
}

export const selectionRestackActions: ActionMapFactory = (state: State) => ({
  SELECTION_RESTACK_BOTTOM: new SelectionRestackAction(state.diagram, 'bottom'),
  SELECTION_RESTACK_DOWN: new SelectionRestackAction(state.diagram, 'down'),
  SELECTION_RESTACK_TOP: new SelectionRestackAction(state.diagram, 'top'),
  SELECTION_RESTACK_UP: new SelectionRestackAction(state.diagram, 'up')
});

type RestackMode = 'up' | 'down' | 'top' | 'bottom';

class SelectionRestackUndoableAction implements UndoableAction {
  description = 'Restack selection';

  private oldPositions: Map<DiagramNode | undefined, StackPosition[]> | undefined;

  constructor(
    private readonly diagram: Diagram,
    private readonly mode: RestackMode
  ) {}

  undo(): void {
    UnitOfWork.execute(this.diagram, uow => {
      precondition.is.present(this.oldPositions);
      this.diagram.layers.active.stackSet(this.oldPositions, uow);
    });
  }

  redo(): void {
    const uow = new UnitOfWork(this.diagram);
    const elements = this.diagram.selectionState.elements;
    switch (this.mode) {
      case 'up':
        this.oldPositions = this.diagram.layers.active.stackModify(elements, 2, uow);
        break;
      case 'down':
        this.oldPositions = this.diagram.layers.active.stackModify(elements, -2, uow);
        break;
      case 'top':
        this.oldPositions = this.diagram.layers.active.stackModify(
          elements,
          Number.MAX_SAFE_INTEGER / 4,
          uow
        );
        break;
      case 'bottom':
        this.oldPositions = this.diagram.layers.active.stackModify(
          elements,
          -(Number.MAX_SAFE_INTEGER / 4),
          uow
        );
        break;
    }
    uow.commit();
  }
}

export class SelectionRestackAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly mode: RestackMode = 'up'
  ) {
    super(diagram);
  }

  execute(): void {
    this.diagram.undoManager.addAndExecute(
      new SelectionRestackUndoableAction(this.diagram, this.mode)
    );
    this.emit('actiontriggered', { action: this });
  }
}
