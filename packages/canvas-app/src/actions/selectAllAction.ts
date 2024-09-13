import { ActionMapFactory, ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';

declare global {
  interface ActionMap {
    SELECT_ALL: SelectAllAction;
    SELECT_ALL_NODES: SelectAllAction;
    SELECT_ALL_EDGES: SelectAllAction;
  }
}

export const selectAllActions: ActionMapFactory = (state: ActionConstructionParameters) => ({
  SELECT_ALL: new SelectAllAction(state.diagram, 'all'),
  SELECT_ALL_NODES: new SelectAllAction(state.diagram, 'nodes'),
  SELECT_ALL_EDGES: new SelectAllAction(state.diagram, 'edges')
});

export class SelectAllAction extends AbstractAction {
  constructor(
    private readonly diagram: Diagram,
    private readonly mode: 'all' | 'nodes' | 'edges' = 'all'
  ) {
    super();
  }

  execute(): void {
    if (this.mode === 'all') {
      this.diagram.selectionState.setElements(this.diagram.visibleElements());
    } else if (this.mode === 'nodes') {
      this.diagram.selectionState.setElements(Object.values(this.diagram.nodeLookup));
    } else if (this.mode === 'edges') {
      this.diagram.selectionState.setElements(Object.values(this.diagram.edgeLookup));
    }
    this.emit('actionTriggered', {});
  }
}
