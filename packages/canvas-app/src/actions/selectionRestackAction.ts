import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer, RegularLayer } from '@diagram-craft/model/diagramLayer';

declare global {
  interface ActionMap extends ReturnType<typeof selectionRestackActions> {}
}

export const selectionRestackActions = (state: ActionConstructionParameters) => ({
  SELECTION_RESTACK_BOTTOM: new SelectionRestackAction('bottom', state.diagram),
  SELECTION_RESTACK_DOWN: new SelectionRestackAction('down', state.diagram),
  SELECTION_RESTACK_TOP: new SelectionRestackAction('top', state.diagram),
  SELECTION_RESTACK_UP: new SelectionRestackAction('up', state.diagram)
});

type RestackMode = 'up' | 'down' | 'top' | 'bottom';

export class SelectionRestackAction extends AbstractSelectionAction {
  constructor(
    private readonly mode: RestackMode = 'up',
    diagram: Diagram
  ) {
    super(diagram, MultipleType.Both, ElementType.Both, ['regular']);
    this.addCriterion(diagram, 'change', () => diagram.activeLayer instanceof RegularLayer);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);
    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    /* Note: using Number.MAX_SAFE_INTEGER / 2 to ensure that the
       modification is larger than the biggest feasible stack - yet
       will not lead to overflow in the internal calculations */

    const elements = this.diagram.selectionState.elements;
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

    this.emit('actiontriggered', { action: this });
  }
}
