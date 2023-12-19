import { UndoableAction } from '../../model/undoManager.ts';
import { DiagramElement } from '../../model/diagramNode.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    SELECTION_DELETE: SelectionDeleteAction;
  }
}

class SelectionDeleteUndoableAction implements UndoableAction {
  description = 'Delete elements';
  private layer: Layer;

  constructor(
    private readonly diagram: Diagram,
    private readonly elements: DiagramElement[]
  ) {
    this.layer = this.diagram.layers.active;
  }

  undo(): void {
    for (const element of this.elements) {
      this.layer.addElement(element);
    }
    this.diagram.selectionState.setElements(this.elements);
  }

  execute(): void {
    for (const element of this.elements) {
      element.layer!.removeElement(element);
    }
    this.diagram.selectionState.clear();
  }
}

export class SelectionDeleteAction extends AbstractSelectionAction {
  constructor(protected readonly diagram: Diagram) {
    super(diagram);
  }

  execute(): void {
    if (this.diagram.selectionState.isEmpty()) return;

    this.diagram.undoManager.addAndExecute(
      new SelectionDeleteUndoableAction(this.diagram, this.diagram.selectionState.elements)
    );

    this.emit('actiontriggered', { action: this });
  }
}
