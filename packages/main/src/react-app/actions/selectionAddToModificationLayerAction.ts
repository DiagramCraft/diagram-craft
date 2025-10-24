import { Application } from '../../application';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { type DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { DelegatingDiagramNode } from '@diagram-craft/model/delegatingDiagramNode';
import { DelegatingDiagramEdge } from '@diagram-craft/model/delegatingDiagramEdge';
import { ModificationLayer } from '@diagram-craft/model/diagramLayerModification';
import { newid } from '@diagram-craft/utils/id';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

declare global {
  interface ActionMap extends ReturnType<typeof selectionAddToModificationLayerActions> {}
}

export const selectionAddToModificationLayerActions = (context: Application) => ({
  SELECTION_ADD_TO_MODIFICATION_LAYER: new SelectionAddToModificationLayerAction(context)
});

export class SelectionAddToModificationLayerAction extends AbstractSelectionAction<Application> {
  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Both);
  }

  getCriteria(context: Application): Array<ActionCriteria> {
    const baseCriteria = super.getCriteria(context);

    return [
      ...baseCriteria,
      ActionCriteria.EventTriggered(
        context.model.activeDiagram.layers,
        'layerStructureChange',
        () => context.model.activeDiagram.activeLayer.type === 'modification'
      )
    ];
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const layer = diagram.activeLayer;

    if (!(layer instanceof ModificationLayer)) {
      return;
    }

    const uow = new UnitOfWork(diagram, true);
    const newDelegatingElements = [];

    for (const element of diagram.selection.elements) {
      let delegatingElement: DiagramElement;

      if (isNode(element)) {
        delegatingElement = new DelegatingDiagramNode(newid(), element, layer);
      } else if (isEdge(element)) {
        delegatingElement = new DelegatingDiagramEdge(newid(), element, layer);
      } else {
        VERIFY_NOT_REACHED();
      }

      layer.modifyChange(element.id, delegatingElement, uow);
      newDelegatingElements.push(delegatingElement);
    }

    commitWithUndo(uow, 'Add to modification layer');

    // Update selection to the new delegating elements
    diagram.selection.setElements(newDelegatingElements);
  }
}
