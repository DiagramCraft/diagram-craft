import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof undoActions> {}
}

export const undoActions = (context: ActionContext) => ({
  UNDO: new UndoAction(context)
});

export class UndoAction extends AbstractAction {
  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.undoManager,
      'change',
      () => context.model.activeDiagram.undoManager.undoableActions.length > 0
    );
  }

  execute(): void {
    this.context.model.activeDiagram.undoManager.undo();
    this.emit('actionTriggered', {});
  }
}
