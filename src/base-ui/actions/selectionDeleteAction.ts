import { Action, ActionEvents } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { UndoableAction } from '../../model-editor/undoManager.ts';
import { DiagramElement } from '../../model-viewer/diagramNode.ts';

declare global {
  interface ActionMap {
    SELECTION_DELETE: SelectionDeleteAction;
  }
}

class SelectionDeleteUndoableAction implements UndoableAction {
  description = 'Delete elements';

  canUndo = true;
  canRedo = true;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly elements: DiagramElement[]
  ) {}

  undo(): void {
    for (const element of this.elements) {
      if (element.type === 'node') {
        this.diagram.addNode(element);
      } else if (element.type === 'edge') {
        this.diagram.addEdge(element);
      }
    }
    this.diagram.selectionState.setElements(this.elements);
  }

  redo(): void {
    for (const element of this.elements) {
      if (element.type === 'node') {
        this.diagram.removeNode(element);
      } else if (element.type === 'edge') {
        this.diagram.removeEdge(element);
      }
    }
    this.diagram.selectionState.clear();
  }
}

export class SelectionDeleteAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: EditableDiagram) {
    super();
  }

  execute(): void {
    if (this.diagram.selectionState.isEmpty()) return;

    this.diagram.undoManager.execute(
      new SelectionDeleteUndoableAction(this.diagram, this.diagram.selectionState.elements)
    );

    this.emit('actiontriggered', { action: this });
  }
}
