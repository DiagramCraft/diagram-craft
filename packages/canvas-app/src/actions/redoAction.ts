import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';

declare global {
  interface ActionMap extends ReturnType<typeof redoActions> {}
}

export const redoActions = (context: ActionContext) => ({
  REDO: new RedoAction(context)
});

export class RedoAction extends AbstractAction {
  constructor(context: ActionContext) {
    super(context);
    const cb = () => {
      this.enabled = this.context.model.activeDiagram.undoManager.redoableActions.length > 0;
      this.emit('actionChanged');
    };
    this.context.model.activeDiagram.undoManager.on('change', cb);
  }

  execute(): void {
    this.context.model.activeDiagram.undoManager.redo();
    this.emit('actionTriggered', {});
  }
}
