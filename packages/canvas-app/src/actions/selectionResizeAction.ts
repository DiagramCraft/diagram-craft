import { AbstractSelectionAction } from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Point } from '@diagram-craft/geometry/point';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ActionContext } from '@diagram-craft/canvas/action';
import { transformElements } from '@diagram-craft/model/diagramElement';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionResizeActions> {}
  }
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
  name = $tStr('action.SELECTION_RESIZE.name', 'Resize Selection');

  constructor(
    protected readonly offset: () => Point,
    context: ActionContext
  ) {
    super(context, 'both');
  }

  execute(): void {
    const $sel = this.context.model.activeDiagram.selection;
    if ($sel.isEmpty()) return;

    const newBox = {
      x: $sel.bounds.x,
      y: $sel.bounds.y,
      w: $sel.bounds.w + this.offset().x,
      h: $sel.bounds.h + this.offset().y,
      r: 0
    };

    UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Resize', uow => {
      transformElements(
        this.context.model.activeDiagram.selection.elements,
        TransformFactory.fromTo($sel.bounds, newBox),
        uow
      );
    });

    this.emit('actionTriggered', {});
  }
}
