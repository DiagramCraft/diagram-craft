import { AbstractSelectionAction } from './abstractSelectionAction';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';
import { ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof duplicateActions> {}
}

export const duplicateActions = (application: ActionContext) => ({
  DUPLICATE: new DuplicateAction(application)
});

const OFFSET = 10;

export class DuplicateAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, 'both');
    this.addCriterion(
      context.model.activeDiagram,
      'change',
      () => context.model.activeDiagram.activeLayer.type === 'regular'
    );
  }

  execute() {
    // TODO: Support cloning of edges
    const uow = new UnitOfWork(this.context.model.activeDiagram);

    const newElements: DiagramNode[] = [];
    for (const el of this.context.model.activeDiagram.selectionState.nodes) {
      const newEl = el.duplicate();
      newEl.transform([new Translation({ x: OFFSET, y: OFFSET })], uow);
      newElements.push(newEl);
    }

    assertRegularLayer(this.context.model.activeDiagram.activeLayer);
    this.context.model.activeDiagram.undoManager.addAndExecute(
      new ElementAddUndoableAction(
        newElements,
        this.context.model.activeDiagram,
        this.context.model.activeDiagram.activeLayer,
        'Duplicate nodes'
      )
    );

    // We commit after adding to the layer so that any change events
    // are fired after
    uow.commit();

    this.context.model.activeDiagram.selectionState.clear();
    this.context.model.activeDiagram.selectionState.setElements(newElements);

    this.emit('actionTriggered', {});
  }
}
