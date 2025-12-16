import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { ActionContext } from '@diagram-craft/canvas/action';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof alignActions> {}
  }
}

export const alignActions = (context: ActionContext) => ({
  ALIGN_TOP: new AlignAction('top', context),
  ALIGN_BOTTOM: new AlignAction('bottom', context),
  ALIGN_CENTER_HORIZONTAL: new AlignAction('center-horizontal', context),
  ALIGN_LEFT: new AlignAction('left', context),
  ALIGN_RIGHT: new AlignAction('right', context),
  ALIGN_CENTER_VERTICAL: new AlignAction('center-vertical', context)
});

type Mode = 'top' | 'bottom' | 'right' | 'left' | 'center-vertical' | 'center-horizontal';

const ALIGN_NAMES: Record<Mode, string> = {
  'top': 'Align Top Edges',
  'bottom': 'Align Bottom Edges',
  'left': 'Align Left Edges',
  'right': 'Align Right Edges',
  'center-vertical': 'Align Centers Vertically',
  'center-horizontal': 'Align Centers Horizontally'
};

export class AlignAction extends AbstractSelectionAction {
  name: string;

  constructor(
    private readonly mode: Mode,
    context: ActionContext
  ) {
    super(context, MultipleType.MultipleOnly, ElementType.Node);
    this.name = ALIGN_NAMES[mode];
  }

  execute(): void {
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    const first = this.context.model.activeDiagram.selection.elements[0];
    assert.present(first); // Note: this is safe as this is a AbstractSelectionAction

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

    this.emit('actionTriggered', {});
  }

  // y + h === Y       => y = Y - h       => y = Y - h * offset (offset = 1)
  // y + h / 2 === Y   => y = Y - h / 2   => y = Y - h * offset (offset = 0.5)
  // y === Y           => y = Y           => y = Y - h * offset (offset = 0)
  private alignY(y: number, offset: number, uow: UnitOfWork) {
    this.context.model.activeDiagram.selection.elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.movable === false) return;
      e.setBounds({ ...e.bounds, y: y - e.bounds.h * offset }, uow);
    });
  }

  // x + w === X       => x = X - w       => x = X - w * offset (offset = 1)
  // x + w / 2 === X   => x = X - w / 2   => x = X - w * offset (offset = 0.5)
  // x === X           => x = X           => x = X - w * offset (offset = 0)
  private alignX(x: number, offset: number, uow: UnitOfWork) {
    this.context.model.activeDiagram.selection.elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.movable === false) return;
      e.setBounds({ ...e.bounds, x: x - e.bounds.w * offset }, uow);
    });
  }
}
