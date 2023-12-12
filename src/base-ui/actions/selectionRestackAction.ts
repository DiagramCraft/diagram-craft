import { SelectionAction } from '../keyMap.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { UndoableAction } from '../../model-editor/undoManager.ts';
import { precondition } from '../../utils/assert.ts';
import { StackElement } from '../../model-viewer/diagram.ts';

declare global {
  interface ActionMap {
    SELECTION_RESTACK_UP: SelectionRestackAction;
    SELECTION_RESTACK_DOWN: SelectionRestackAction;
    SELECTION_RESTACK_BOTTOM: SelectionRestackAction;
    SELECTION_RESTACK_TOP: SelectionRestackAction;
  }
}

type RestackMode = 'up' | 'down' | 'top' | 'bottom';

class SelectionRestackUndoableAction implements UndoableAction {
  description = 'Restack selection';
  canUndo = true;
  canRedo = true;

  private oldPositions: StackElement[] | undefined;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly mode: RestackMode
  ) {}

  undo(): void {
    precondition.is.present(this.oldPositions);
    this.diagram.stackSet(this.oldPositions);

    this.canUndo = false;
    this.canRedo = true;
  }

  redo(): void {
    const elements = this.diagram.selectionState.elements;
    switch (this.mode) {
      case 'up':
        this.oldPositions = this.diagram.stackModify(elements, 2);
        break;
      case 'down':
        this.oldPositions = this.diagram.stackModify(elements, -2);
        break;
      case 'top':
        this.oldPositions = this.diagram.stackModify(elements, this.diagram.elements.length);
        break;
      case 'bottom':
        this.oldPositions = this.diagram.stackModify(elements, -this.diagram.elements.length);
        break;
    }

    this.canUndo = true;
    this.canRedo = false;
  }
}

export class SelectionRestackAction extends SelectionAction {
  constructor(
    protected readonly diagram: EditableDiagram,
    private readonly mode: RestackMode = 'up'
  ) {
    super(diagram);
  }

  execute(): void {
    this.diagram.undoManager.execute(new SelectionRestackUndoableAction(this.diagram, this.mode));
    this.emit('actiontriggered', { action: this });
  }
}
