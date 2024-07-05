import { AbstractSelectionAction } from './abstractSelectionAction';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Point } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  interface ActionMap {
    SELECTION_MOVE_UP: SelectionMoveAction;
    SELECTION_MOVE_DOWN: SelectionMoveAction;
    SELECTION_MOVE_LEFT: SelectionMoveAction;
    SELECTION_MOVE_RIGHT: SelectionMoveAction;
    SELECTION_MOVE_GRID_UP: SelectionMoveAction;
    SELECTION_MOVE_GRID_DOWN: SelectionMoveAction;
    SELECTION_MOVE_GRID_LEFT: SelectionMoveAction;
    SELECTION_MOVE_GRID_RIGHT: SelectionMoveAction;
  }
}

export const selectionMoveActions: ActionMapFactory = (state: State) => {
  const $d = state.diagram;
  const grid = () => $d.props.grid?.size ?? 10;
  return {
    SELECTION_MOVE_UP: new SelectionMoveAction($d, () => ({ x: 0, y: -1 })),
    SELECTION_MOVE_DOWN: new SelectionMoveAction($d, () => ({ x: 0, y: 1 })),
    SELECTION_MOVE_LEFT: new SelectionMoveAction($d, () => ({ x: -1, y: 0 })),
    SELECTION_MOVE_RIGHT: new SelectionMoveAction($d, () => ({ x: 1, y: 0 })),
    SELECTION_MOVE_GRID_UP: new SelectionMoveAction($d, () => ({ x: 0, y: -grid() })),
    SELECTION_MOVE_GRID_DOWN: new SelectionMoveAction($d, () => ({ x: 0, y: grid() })),
    SELECTION_MOVE_GRID_LEFT: new SelectionMoveAction($d, () => ({ x: -grid(), y: 0 })),
    SELECTION_MOVE_GRID_RIGHT: new SelectionMoveAction($d, () => ({ x: grid(), y: 0 }))
  };
};

export class SelectionMoveAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly offset: () => Point
  ) {
    super(diagram);
  }

  execute(): void {
    if (this.diagram.selectionState.isEmpty()) return;

    const uow = new UnitOfWork(this.diagram, true);
    this.diagram.transformElements(
      this.diagram.selectionState.elements,
      [new Translation(this.offset())],
      uow
    );
    commitWithUndo(uow, 'Move');

    this.emit('actiontriggered', { action: this });
  }
}
