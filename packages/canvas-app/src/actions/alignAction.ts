import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';

declare global {
  interface ActionMap {
    ALIGN_TOP: AlignAction;
    ALIGN_BOTTOM: AlignAction;
    ALIGN_CENTER_HORIZONTAL: AlignAction;
    ALIGN_LEFT: AlignAction;
    ALIGN_RIGHT: AlignAction;
    ALIGN_CENTER_VERTICAL: AlignAction;
  }
}

export const alignActions: ActionMapFactory = (state: State) => ({
  ALIGN_TOP: new AlignAction(state.diagram, 'top'),
  ALIGN_BOTTOM: new AlignAction(state.diagram, 'bottom'),
  ALIGN_CENTER_HORIZONTAL: new AlignAction(state.diagram, 'center-horizontal'),
  ALIGN_LEFT: new AlignAction(state.diagram, 'left'),
  ALIGN_RIGHT: new AlignAction(state.diagram, 'right'),
  ALIGN_CENTER_VERTICAL: new AlignAction(state.diagram, 'center-vertical')
});

type Mode = 'top' | 'bottom' | 'right' | 'left' | 'center-vertical' | 'center-horizontal';

export class AlignAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly mode: Mode
  ) {
    super(diagram, MultipleType.MultipleOnly, ElementType.Node);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);

    const first = this.diagram.selectionState.elements[0];
    switch (this.mode) {
      case 'top':
        this.alignY(first.bounds.y, 0, uow);
        break;
      case 'bottom':
        this.alignY(first.bounds.y + first.bounds.h, 1, uow);
        break;
      case 'center-horizontal':
        this.alignY(first.bounds.y + first.bounds.h / 2, 0.5, uow);
        break;
      case 'left':
        this.alignX(first.bounds.x, 0, uow);
        break;
      case 'right':
        this.alignX(first.bounds.x + first.bounds.w, 1, uow);
        break;
      case 'center-vertical':
        this.alignX(first.bounds.x + first.bounds.w / 2, 0.5, uow);
        break;
    }

    commitWithUndo(uow, `Align ${this.mode}`);

    this.emit('actiontriggered', { action: this });
  }

  // y + h === Y       => y = Y - h       => y = Y - h * offset (offset = 1)
  // y + h / 2 === Y   => y = Y - h / 2   => y = Y - h * offset (offset = 0.5)
  // y === Y           => y = Y           => y = Y - h * offset (offset = 0)
  private alignY(y: number, offset: number, uow: UnitOfWork) {
    this.diagram.selectionState.elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.moveable === false) return;
      e.setBounds({ ...e.bounds, y: y - e.bounds.h * offset }, uow);
    });
  }

  // x + w === X       => x = X - w       => x = X - w * offset (offset = 1)
  // x + w / 2 === X   => x = X - w / 2   => x = X - w * offset (offset = 0.5)
  // x === X           => x = X           => x = X - w * offset (offset = 0)
  private alignX(x: number, offset: number, uow: UnitOfWork) {
    this.diagram.selectionState.elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.moveable === false) return;
      e.setBounds({ ...e.bounds, x: x - e.bounds.w * offset }, uow);
    });
  }
}
