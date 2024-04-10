import { AbstractSelectionAction } from './abstractSelectionAction';
import { Diagram } from '@diagram-craft/model/index';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { ElementDeleteUndoableAction } from '@diagram-craft/model/index';

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
