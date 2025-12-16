import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof undoActions> {}
  }
}

export const undoActions = (context: ActionContext) => ({
  UNDO: new UndoAction(context)
});

export class UndoAction extends AbstractAction {
  name = $tStr('action.UNDO.name', 'Undo');

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
