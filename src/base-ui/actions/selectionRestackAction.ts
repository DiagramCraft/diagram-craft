import { UndoableAction } from '../../model/undoManager.ts';
import { precondition } from '../../utils/assert.ts';
import { Diagram, StackPosition } from '../../model/diagram.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { ActionMapFactory, State } from '../keyMap.ts';

declare global {
  interface ActionMap {
    SELECTION_RESTACK_UP: SelectionRestackAction;
    SELECTION_RESTACK_DOWN: SelectionRestackAction;
    SELECTION_RESTACK_BOTTOM: SelectionRestackAction;
    SELECTION_RESTACK_TOP: SelectionRestackAction;
  }
}

export const selectionRestackActions: ActionMapFactory = (state: State) => ({
  SELECTION_RESTACK_BOTTOM: new SelectionRestackAction(state.diagram, 'bottom'),
  SELECTION_RESTACK_DOWN: new SelectionRestackAction(state.diagram, 'down'),
  SELECTION_RESTACK_TOP: new SelectionRestackAction(state.diagram, 'top'),
  SELECTION_RESTACK_UP: new SelectionRestackAction(state.diagram, 'up')
});

type RestackMode = 'up' | 'down' | 'top' | 'bottom';

class SelectionRestackUndoableAction implements UndoableAction {
  description = 'Restack selection';

  private oldPositions: StackPosition[] | undefined;

  constructor(
    private readonly diagram: Diagram,
    private readonly mode: RestackMode
  ) {}

  undo(): void {
    precondition.is.present(this.oldPositions);
    this.diagram.layers.active.stackSet(this.oldPositions);
  }

  execute(): void {
    const elements = this.diagram.selectionState.elements;
    switch (this.mode) {
      case 'up':
        this.oldPositions = this.diagram.layers.active.stackModify(elements, 2);
        break;
      case 'down':
        this.oldPositions = this.diagram.layers.active.stackModify(elements, -2);
        break;
      case 'top':
        this.oldPositions = this.diagram.layers.active.stackModify(
          elements,
          this.diagram.layers.active.elements.length
        );
        break;
      case 'bottom':
        this.oldPositions = this.diagram.layers.active.stackModify(
          elements,
          this.diagram.layers.active.elements.length
        );
        break;
    }
  }
}

export class SelectionRestackAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly mode: RestackMode = 'up'
  ) {
    super(diagram);
  }

  execute(): void {
    this.diagram.undoManager.addAndExecute(
      new SelectionRestackUndoableAction(this.diagram, this.mode)
    );
    this.emit('actiontriggered', { action: this });
  }
}
