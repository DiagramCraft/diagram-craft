import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';

declare global {
  namespace DiagramCraft {
    interface ActionMap extends ReturnType<typeof redoActions> {}
  }
}

export const redoActions = (context: ActionContext) => ({
  REDO: new RedoAction(context)
});

export class RedoAction extends AbstractAction {
  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.undoManager,
      'change',
      () => context.model.activeDiagram.undoManager.redoableActions.length > 0
    );
  }

  execute(): void {
    this.context.model.activeDiagram.undoManager.redo();
    this.emit('actionTriggered', {});
  }
}
