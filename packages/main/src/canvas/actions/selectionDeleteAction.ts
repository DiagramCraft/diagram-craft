import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Diagram } from '@diagram-craft/model';
import { ActionMapFactory, State } from '../../canvas/keyMap.ts';
import { ElementDeleteUndoableAction } from '@diagram-craft/model';

declare global {
  interface ActionMap {
    SELECTION_DELETE: SelectionDeleteAction;
  }
}

export const selectionDeleteActions: ActionMapFactory = (state: State) => ({
  SELECTION_DELETE: new SelectionDeleteAction(state.diagram)
});

export class SelectionDeleteAction extends AbstractSelectionAction {
  constructor(protected readonly diagram: Diagram) {
    super(diagram);
  }

  execute(): void {
    if (this.diagram.selectionState.isEmpty()) return;

    this.diagram.undoManager.addAndExecute(
      new ElementDeleteUndoableAction(this.diagram, this.diagram.selectionState.elements)
    );

    this.emit('actiontriggered', { action: this });
  }
}
