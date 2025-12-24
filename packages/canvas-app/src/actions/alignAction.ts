import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { ActionContext } from '@diagram-craft/canvas/action';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof alignActions> {}
  }
}

export const alignActions = (context: ActionContext) => ({
  ALIGN_TOP: new AlignAction('top', $tStr('action.ALIGN_TOP.name', 'Align Top Edges'), context),
  ALIGN_BOTTOM: new AlignAction(
    'bottom',
    $tStr('action.ALIGN_BOTTOM.name', 'Align Bottom Edges'),
    context
  ),
  ALIGN_CENTER_HORIZONTAL: new AlignAction(
    'center-horizontal',
    $tStr('action.ALIGN_CENTER_HORIZONTAL.name', 'Align Centers Horizontally'),
    context
  ),
  ALIGN_LEFT: new AlignAction('left', $tStr('action.ALIGN_LEFT.name', 'Align Left Edges'), context),
  ALIGN_RIGHT: new AlignAction(
    'right',
    $tStr('action.ALIGN_RIGHT.name', 'Align Right Edges'),
    context
  ),
  ALIGN_CENTER_VERTICAL: new AlignAction(
    'center-vertical',
    $tStr('action.ALIGN_CENTER_VERTICAL.name', 'Align Centers Vertically'),
    context
  )
});

type Mode = 'top' | 'bottom' | 'right' | 'left' | 'center-vertical' | 'center-horizontal';

export class AlignAction extends AbstractSelectionAction {
  constructor(
    private readonly mode: Mode,
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context, MultipleType.MultipleOnly, ElementType.Node);
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
