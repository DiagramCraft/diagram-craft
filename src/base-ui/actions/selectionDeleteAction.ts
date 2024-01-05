import { UndoableAction } from '../../model/undoManager.ts';
import { DiagramElement } from '../../model/diagramElement.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

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
    elements: ReadonlyArray<DiagramElement>
  ) {
    this.layer = this.diagram.layers.active;
    this.elements = [...elements];
  }

  undo(): void {
    UnitOfWork.execute(this.diagram, uow => {
      for (const element of this.elements) {
        this.layer.addElement(element, uow);
      }
    });
    this.diagram.selectionState.setElements(this.elements);
  }

  redo(): void {
    UnitOfWork.execute(this.diagram, uow => {
      for (const element of this.elements) {
        element.layer!.removeElement(element, uow);
      }
    });
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
