import { AbstractSelectionAction } from './abstractSelectionAction';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Point } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof selectionMoveActions> {}
}

export const selectionMoveActions = (context: ActionContext) => {
  const $d = context.model.activeDiagram;
  const grid = () => $d.props.grid?.size ?? 10;
  return {
    SELECTION_MOVE_UP: new SelectionMoveAction(context, () => ({ x: 0, y: -1 })),
    SELECTION_MOVE_DOWN: new SelectionMoveAction(context, () => ({ x: 0, y: 1 })),
    SELECTION_MOVE_LEFT: new SelectionMoveAction(context, () => ({ x: -1, y: 0 })),
    SELECTION_MOVE_RIGHT: new SelectionMoveAction(context, () => ({ x: 1, y: 0 })),
    SELECTION_MOVE_GRID_UP: new SelectionMoveAction(context, () => ({ x: 0, y: -grid() })),
    SELECTION_MOVE_GRID_DOWN: new SelectionMoveAction(context, () => ({ x: 0, y: grid() })),
    SELECTION_MOVE_GRID_LEFT: new SelectionMoveAction(context, () => ({ x: -grid(), y: 0 })),
    SELECTION_MOVE_GRID_RIGHT: new SelectionMoveAction(context, () => ({ x: grid(), y: 0 }))
  };
};

export class SelectionMoveAction extends AbstractSelectionAction {
  constructor(
    context: ActionContext,
    protected readonly offset: () => Point
  ) {
    super(context, 'both');
  }

  execute(): void {
    if (this.context.model.activeDiagram.selectionState.isEmpty()) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    this.context.model.activeDiagram.transformElements(
      this.context.model.activeDiagram.selectionState.elements,
      [new Translation(this.offset())],
      uow
    );
    commitWithUndo(uow, 'Move');

    this.emit('actionTriggered', {});
  }
}
