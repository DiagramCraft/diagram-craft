import { Diagram } from '../../model/diagram.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

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

export class SelectionRestackAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly mode: RestackMode = 'up'
  ) {
    super(diagram);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);

    const elements = this.diagram.selectionState.elements;
    switch (this.mode) {
      case 'up':
        this.diagram.layers.active.stackModify(elements, 2, uow);
        break;
      case 'down':
        this.diagram.layers.active.stackModify(elements, -2, uow);
        break;
      case 'top':
        this.diagram.layers.active.stackModify(elements, Number.MAX_SAFE_INTEGER / 4, uow);
        break;
      case 'bottom':
        this.diagram.layers.active.stackModify(elements, -(Number.MAX_SAFE_INTEGER / 4), uow);
        break;
    }

    const snapshots = uow.commit();

    this.diagram.undoManager.add(
      new SnapshotUndoableAction(
        'Restack selection',
        snapshots,
        snapshots.retakeSnapshot(this.diagram),
        this.diagram
      )
    );

    this.emit('actiontriggered', { action: this });
  }
}
