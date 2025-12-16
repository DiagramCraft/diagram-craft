import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionRestackActions> {}
  }
}

export const selectionRestackActions = (context: ActionContext) => ({
  SELECTION_RESTACK_BOTTOM: new SelectionRestackAction(
    'bottom',
    $tStr('action.SELECTION_RESTACK_BOTTOM.name', 'Move to back'),
    context
  ),
  SELECTION_RESTACK_DOWN: new SelectionRestackAction(
    'down',
    $tStr('action.SELECTION_RESTACK_DOWN.name', 'Move backward'),
    context
  ),
  SELECTION_RESTACK_TOP: new SelectionRestackAction(
    'top',
    $tStr('action.SELECTION_RESTACK_TOP.name', 'Move to front'),
    context
  ),
  SELECTION_RESTACK_UP: new SelectionRestackAction(
    'up',
    $tStr('action.SELECTION_RESTACK_UP.name', 'Move forward'),
    context
  )
});

type RestackMode = 'up' | 'down' | 'top' | 'bottom';

export class SelectionRestackAction extends AbstractSelectionAction {
  constructor(
    private readonly mode: RestackMode = 'up',
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context, MultipleType.Both, ElementType.Both, ['regular']);
  }

  getCriteria(context: ActionContext): ActionCriteria[] {
    return [
      ...super.getCriteria(context),
      ActionCriteria.EventTriggered(
        context.model.activeDiagram,
        'diagramChange',
        () => context.model.activeDiagram.activeLayer instanceof RegularLayer
      )
    ];
  }

  execute(): void {
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    const activeLayer = this.context.model.activeDiagram.activeLayer;
    assertRegularLayer(activeLayer);

    /* Note: using Number.MAX_SAFE_INTEGER / 2 to ensure that the
       modification is larger than the biggest feasible stack - yet
       will not lead to overflow in the internal calculations */

    const elements = this.context.model.activeDiagram.selection.elements;
    switch (this.mode) {
      case 'up':
        activeLayer.stackModify(elements, 2, uow);
        break;
      case 'down':
        activeLayer.stackModify(elements, -2, uow);
        break;
      case 'top':
        activeLayer.stackModify(elements, Number.MAX_SAFE_INTEGER / 2, uow);
        break;
      case 'bottom':
        activeLayer.stackModify(elements, -(Number.MAX_SAFE_INTEGER / 2), uow);
        break;
    }

    commitWithUndo(uow, 'Restack selection');

    this.emit('actionTriggered', {});
  }
}
