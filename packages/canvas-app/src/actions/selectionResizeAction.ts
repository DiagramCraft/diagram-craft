import { AbstractSelectionAction } from './abstractSelectionAction';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Point } from '@diagram-craft/geometry/point';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  interface ActionMap {
    SELECTION_RESIZE_UP: SelectionResizeAction;
    SELECTION_RESIZE_DOWN: SelectionResizeAction;
    SELECTION_RESIZE_LEFT: SelectionResizeAction;
    SELECTION_RESIZE_RIGHT: SelectionResizeAction;
    SELECTION_RESIZE_GRID_UP: SelectionResizeAction;
    SELECTION_RESIZE_GRID_DOWN: SelectionResizeAction;
    SELECTION_RESIZE_GRID_LEFT: SelectionResizeAction;
    SELECTION_RESIZE_GRID_RIGHT: SelectionResizeAction;
  }
}

export const selectionResizeActions: ActionMapFactory = (state: State) => {
  const $d = state.diagram;
  const grid = () => $d.props.grid?.size ?? 10;
  return {
    SELECTION_RESIZE_UP: new SelectionResizeAction($d, () => ({ x: 0, y: -1 })),
    SELECTION_RESIZE_DOWN: new SelectionResizeAction($d, () => ({ x: 0, y: 1 })),
    SELECTION_RESIZE_LEFT: new SelectionResizeAction($d, () => ({ x: -1, y: 0 })),
    SELECTION_RESIZE_RIGHT: new SelectionResizeAction($d, () => ({ x: 1, y: 0 })),
    SELECTION_RESIZE_GRID_UP: new SelectionResizeAction($d, () => ({ x: 0, y: -grid() })),
    SELECTION_RESIZE_GRID_DOWN: new SelectionResizeAction($d, () => ({ x: 0, y: grid() })),
    SELECTION_RESIZE_GRID_LEFT: new SelectionResizeAction($d, () => ({ x: -grid(), y: 0 })),
    SELECTION_RESIZE_GRID_RIGHT: new SelectionResizeAction($d, () => ({ x: grid(), y: 0 }))
  };
};

export class SelectionResizeAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    protected readonly offset: () => Point
  ) {
    super(diagram);
  }

  execute(): void {
    const $sel = this.diagram.selectionState;
    if ($sel.isEmpty()) return;

    const newBox = {
      x: $sel.bounds.x,
      y: $sel.bounds.y,
      w: $sel.bounds.w + this.offset().x,
      h: $sel.bounds.h + this.offset().y,
      r: 0
    };

    const uow = new UnitOfWork(this.diagram, true);
    this.diagram.transformElements(
      this.diagram.selectionState.elements,
      TransformFactory.fromTo($sel.bounds, newBox),
      uow
    );
    commitWithUndo(uow, 'Resized');

    this.emit('actiontriggered', { action: this });
  }
}
