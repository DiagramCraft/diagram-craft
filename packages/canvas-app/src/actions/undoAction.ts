import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';
import { withDebug } from '@diagram-craft/utils/debug';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof undoActions> {}
  }
}

export const undoActions = (context: ActionContext) => ({
  UNDO: new UndoAction(context),
  REDO: new RedoAction(context)
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
    withDebug(() => this.context.model.activeDiagram.undoManager.undo());
    this.emit('actionTriggered', {});
  }
}

export class RedoAction extends AbstractAction {
  name = $tStr('action.REDO.name', 'Redo');

  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.undoManager,
      'change',
      () => context.model.activeDiagram.undoManager.redoableActions.length > 0
    );
  }

  execute(): void {
    withDebug(() => this.context.model.activeDiagram.undoManager.redo());
    this.emit('actionTriggered', {});
  }
}
