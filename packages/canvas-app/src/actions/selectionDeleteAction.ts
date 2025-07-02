import { AbstractSelectionAction } from './abstractSelectionAction';
import { ElementDeleteUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof selectionDeleteActions> {}
}

export const selectionDeleteActions = (context: ActionContext) => ({
  SELECTION_DELETE: new SelectionDeleteAction(context)
});

export class SelectionDeleteAction extends AbstractSelectionAction {
  constructor(context: ActionContext) {
    super(context, 'both');
  }

  getCriteria(context: ActionContext): ActionCriteria[] {
    return [
      ...super.getCriteria(context),
      ActionCriteria.EventTriggered(
        context.model.activeDiagram,
        'change',
        () => context.model.activeDiagram.activeLayer.type === 'regular'
      )
    ];
  }

  execute(): void {
    if (this.context.model.activeDiagram.selectionState.isEmpty()) return;

    const deletableElements = this.context.model.activeDiagram.selectionState.elements.filter(e => {
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
