import { AbstractSelectionAction } from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { isNode } from '@diagram-craft/model/diagramElement';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr } from '@diagram-craft/utils/localize';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deleteElements } from '@diagram-craft/model/diagramElementUtils';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionDeleteActions> {}
  }
}

export const selectionDeleteActions = (context: ActionContext) => ({
  SELECTION_DELETE: new SelectionDeleteAction(context)
});

export class SelectionDeleteAction extends AbstractSelectionAction {
  name = $tStr('action.SELECTION_DELETE.name', 'Delete');

  constructor(context: ActionContext) {
    super(context, 'both');
  }

  getCriteria(context: ActionContext): ActionCriteria[] {
    return [
      ...super.getCriteria(context),
      ActionCriteria.EventTriggered(
        context.model.activeDiagram,
        'diagramChange',
        () => context.model.activeDiagram.activeLayer.type === 'regular'
      )
    ];
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    if (diagram.selection.isEmpty()) return;

    const deletableElements = diagram.selection.elements.filter(e => {
      const parent = e.parent;
      if (parent && isNode(parent)) {
        const parentDef = parent.getDefinition();
        if (parentDef.hasFlag(NodeFlags.ChildrenManagedByParent)) return false;
      }

      return !(isNode(e) && e.renderProps.capabilities.deletable === false);
    });

    if (deletableElements.length === 0) return;

    assertRegularLayer(diagram.activeLayer);

    UnitOfWork.executeWithUndo(diagram, 'Delete selection', uow => {
      deleteElements(deletableElements, uow);
      uow.select(diagram, []);
    });

    this.emit('actionTriggered', {});
  }
}
