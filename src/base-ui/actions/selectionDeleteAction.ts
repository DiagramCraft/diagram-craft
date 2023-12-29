import { UndoableAction } from '../../model/undoManager.ts';
import { DiagramElement } from '../../model/diagramNode.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';

declare global {
  interface ActionMap {
    SELECTION_DELETE: SelectionDeleteAction;
  }
}

export const selectionDeleteActions: ActionMapFactory = (state: State) => ({
  SELECTION_DELETE: new SelectionDeleteAction(state.diagram)
});

class SelectionDeleteUndoableAction implements UndoableAction {
  description = 'Delete elements';
  private layer: Layer;
  private readonly elements: DiagramElement[];

  constructor(
    private readonly diagram: Diagram,
    elements: Readonly<DiagramElement[]>
  ) {
    this.layer = this.diagram.layers.active;
    this.elements = [...elements];
  }

  undo(): void {
    for (const element of this.elements) {
      this.layer.addElement(element);
    }
    this.diagram.selectionState.setElements(this.elements);
  }

  redo(): void {
    for (const element of this.elements) {
      if (element.type === 'edge' && element.labelNodes) {
        this.elements.push(...element.labelNodes.map(ln => ln.node));
      }
      element.layer!.removeElement(element);
    }
    this.diagram.selectionState.clear();

    // TODO: Maybe we need to have the diagram process all element links post delete uow
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
