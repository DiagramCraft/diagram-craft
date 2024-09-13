import { AbstractSelectionAction } from './abstractSelectionAction';
import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { Translation } from '@diagram-craft/geometry/transform';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';

declare global {
  interface ActionMap extends ReturnType<typeof duplicateActions> {}
}

export const duplicateActions = (state: ActionConstructionParameters) => ({
  DUPLICATE: new DuplicateAction(state.diagram)
});

const OFFSET = 10;

export class DuplicateAction extends AbstractSelectionAction {
  constructor(protected readonly diagram: Diagram) {
    super(diagram, 'both');
    this.addCriterion(diagram, 'change', () => diagram.activeLayer.type === 'regular');
  }

  execute() {
    // TODO: Support cloning of edges
    const uow = new UnitOfWork(this.diagram);

    const newElements: DiagramNode[] = [];
    for (const el of this.diagram.selectionState.nodes) {
      const newEl = el.duplicate();
      newEl.transform([new Translation({ x: OFFSET, y: OFFSET })], uow);
      newElements.push(newEl);
    }

    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.undoManager.addAndExecute(
      new ElementAddUndoableAction(
        newElements,
        this.diagram,
        this.diagram.activeLayer,
        'Duplicate nodes'
      )
    );

    // We commit after adding to the layer so that any change events
    // are fired after
    uow.commit();

    this.diagram.selectionState.clear();
    this.diagram.selectionState.setElements(newElements);

    this.emit('actiontriggered', {});
  }
}
