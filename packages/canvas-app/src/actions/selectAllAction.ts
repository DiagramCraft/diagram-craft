import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectAllActions> {}
  }
}

export const selectAllActions = (context: ActionContext) => ({
  SELECT_ALL: new SelectAllAction('all', context),
  SELECT_ALL_NODES: new SelectAllAction('nodes', context),
  SELECT_ALL_EDGES: new SelectAllAction('edges', context)
});

export class SelectAllAction extends AbstractAction {
  constructor(
    private readonly mode: 'all' | 'nodes' | 'edges' = 'all',
    context: ActionContext
  ) {
    super(context);
  }

  execute(): void {
    if (this.mode === 'all') {
      this.context.model.activeDiagram.selection.setElements(
        this.context.model.activeDiagram.visibleElements()
      );
    } else if (this.mode === 'nodes') {
      this.context.model.activeDiagram.selection.setElements(
        Object.values(this.context.model.activeDiagram.nodeLookup)
      );
    } else if (this.mode === 'edges') {
      this.context.model.activeDiagram.selection.setElements(
        Object.values(this.context.model.activeDiagram.edgeLookup)
      );
    }
    this.emit('actionTriggered', {});
  }
}
