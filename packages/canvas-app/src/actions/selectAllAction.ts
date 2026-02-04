import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectAllActions> {}
  }
}

export const selectAllActions = (context: ActionContext) => ({
  SELECT_ALL: new SelectAllAction('all', $tStr('action.SELECT_ALL.name', 'Select All'), context),
  SELECT_ALL_NODES: new SelectAllAction(
    'nodes',
    $tStr('action.SELECT_ALL_NODES.name', 'Select All Nodes'),
    context
  ),
  SELECT_ALL_EDGES: new SelectAllAction(
    'edges',
    $tStr('action.SELECT_ALL_EDGES.name', 'Select All Edges'),
    context
  )
});

export class SelectAllAction extends AbstractAction {
  constructor(
    private readonly mode: 'all' | 'nodes' | 'edges' = 'all',
    public readonly name: TranslatedString,
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
