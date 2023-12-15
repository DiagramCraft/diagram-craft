import { Action, ActionEvents } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    SELECT_ALL: SelectAllAction;
    SELECT_ALL_NODES: SelectAllAction;
    SELECT_ALL_EDGES: SelectAllAction;
  }
}

export class SelectAllAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

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
    this.emit('actiontriggered', { action: this });
  }
}
