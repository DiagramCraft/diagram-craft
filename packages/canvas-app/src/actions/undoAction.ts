import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof undoActions> {}
}

export const undoActions = (context: ActionContext) => ({
  UNDO: new UndoAction(context)
});

export class UndoAction extends AbstractAction {
  constructor(context: ActionContext) {
    super(context);
    const cb = () => {
      this.enabled = this.context.model.activeDiagram.undoManager.undoableActions.length > 0;
      this.emit('actionChanged');
    };
    this.context.model.activeDiagram.undoManager.on('change', cb);
  }

  execute(): void {
    this.context.model.activeDiagram.undoManager.undo();
    this.emit('actionTriggered', {});
  }
}
