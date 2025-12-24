import { AbstractSelectionAction } from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { ElementDeleteUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr } from '@diagram-craft/utils/localize';

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
    if (this.context.model.activeDiagram.selection.isEmpty()) return;

    const deletableElements = this.context.model.activeDiagram.selection.elements.filter(e => {
      return !(isNode(e) && e.renderProps.capabilities.deletable === false);
    });

    if (deletableElements.length === 0) return;

    assertRegularLayer(this.context.model.activeDiagram.activeLayer);
    this.context.model.activeDiagram.undoManager.addAndExecute(
      new ElementDeleteUndoableAction(
        this.context.model.activeDiagram,
        this.context.model.activeDiagram.activeLayer,
        deletableElements,
        true
      )
    );

    this.emit('actionTriggered', {});
  }
}
