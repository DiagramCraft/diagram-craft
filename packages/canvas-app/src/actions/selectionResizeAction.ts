import { AbstractSelectionAction } from './abstractSelectionAction';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Point } from '@diagram-craft/geometry/point';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ActionContext } from '@diagram-craft/canvas/action';
import { transformElements } from '@diagram-craft/model/diagramElement';

declare global {
  interface ActionMap extends ReturnType<typeof selectionResizeActions> {}
}

export const selectionResizeActions = (context: ActionContext) => {
  const $d = context.model.activeDiagram;
  const grid = () => $d.props.grid?.size ?? 10;
  return {
    SELECTION_RESIZE_UP: new SelectionResizeAction(() => ({ x: 0, y: -1 }), context),
    SELECTION_RESIZE_DOWN: new SelectionResizeAction(() => ({ x: 0, y: 1 }), context),
    SELECTION_RESIZE_LEFT: new SelectionResizeAction(() => ({ x: -1, y: 0 }), context),
    SELECTION_RESIZE_RIGHT: new SelectionResizeAction(() => ({ x: 1, y: 0 }), context),
    SELECTION_RESIZE_GRID_UP: new SelectionResizeAction(() => ({ x: 0, y: -grid() }), context),
    SELECTION_RESIZE_GRID_DOWN: new SelectionResizeAction(() => ({ x: 0, y: grid() }), context),
    SELECTION_RESIZE_GRID_LEFT: new SelectionResizeAction(
      () => ({
        x: -grid(),
        y: 0
      }),
      context
    ),
    SELECTION_RESIZE_GRID_RIGHT: new SelectionResizeAction(() => ({ x: grid(), y: 0 }), context)
  };
};

export class SelectionResizeAction extends AbstractSelectionAction {
  constructor(
    protected readonly offset: () => Point,
    context: ActionContext
  ) {
    super(context, 'both');
  }

  execute(): void {
    const $sel = this.context.model.activeDiagram.selectionState;
    if ($sel.isEmpty()) return;

    const newBox = {
      x: $sel.bounds.x,
      y: $sel.bounds.y,
      w: $sel.bounds.w + this.offset().x,
      h: $sel.bounds.h + this.offset().y,
      r: 0
    };

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    transformElements(
      this.context.model.activeDiagram.selectionState.elements,
      TransformFactory.fromTo($sel.bounds, newBox),
      uow
    );
    commitWithUndo(uow, 'Resized');

    this.emit('actionTriggered', {});
  }
}
