import { AbstractSelectionAction } from './abstractSelectionAction';
import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { Diagram } from '@diagram-craft/model/diagram';
import { ElementDeleteUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { isNode } from '@diagram-craft/model/diagramElement';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';

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
    super(diagram, 'both');
    this.addCriterion(diagram, 'change', () => diagram.activeLayer.type === 'regular');
  }

  execute(): void {
    if (this.diagram.selectionState.isEmpty()) return;

    const deletableElements = this.diagram.selectionState.elements.filter(e => {
      return !(isNode(e) && e.renderProps.capabilities.deletable === false);
    });

    if (deletableElements.length === 0) return;

    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.undoManager.addAndExecute(
      new ElementDeleteUndoableAction(
        this.diagram,
        this.diagram.activeLayer,
        deletableElements,
        true
      )
    );

    this.emit('actiontriggered', { action: this });
  }
}
