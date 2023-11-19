import { Action, ActionEvents } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramNode } from '../../model-viewer/diagram.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { NodeChangeAction } from '../../model-viewer/actions.ts';

declare global {
  interface ActionMap {
    ALIGN_TOP: AlignAction;
    ALIGN_BOTTOM: AlignAction;
    ALIGN_CENTER_HORIZONTAL: AlignAction;
    ALIGN_LEFT: AlignAction;
    ALIGN_RIGHT: AlignAction;
    ALIGN_CENTER_VERTICAL: AlignAction;
  }
}

export class AlignAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly mode:
      | 'top'
      | 'bottom'
      | 'right'
      | 'left'
      | 'center-vertical'
      | 'center-horizontal'
  ) {
    super();
    this.diagram.selectionState.on('*', () => {
      this.enabled = this.diagram.selectionState.elements.length > 1;
    });
  }

  execute(): void {
    const action = new NodeChangeAction(this.diagram.selectionState.nodes, this.diagram);

    const first = this.diagram.selectionState.elements[0];
    if (this.mode === 'top') {
      this.alignY(first.bounds.pos.y, 0);
    } else if (this.mode === 'bottom') {
      this.alignY(first.bounds.pos.y + first.bounds.size.h, 1);
    } else if (this.mode === 'center-horizontal') {
      this.alignY(first.bounds.pos.y + first.bounds.size.h / 2, 0.5);
    } else if (this.mode === 'left') {
      this.alignX(first.bounds.pos.x, 0);
    } else if (this.mode === 'right') {
      this.alignX(first.bounds.pos.x + first.bounds.size.w, 1);
    } else if (this.mode === 'center-vertical') {
      this.alignX(first.bounds.pos.x + first.bounds.size.w / 2, 0.5);
    } else {
      VERIFY_NOT_REACHED();
    }

    action.commit();
    this.diagram.undoManager.add(action);
  }

  // y + h === Y       => y = Y - h       => y = Y - h * offset (offset = 1)
  // y + h / 2 === Y   => y = Y - h / 2   => y = Y - h * offset (offset = 0.5)
  // y === Y           => y = Y           => y = Y - h * offset (offset = 0)
  private alignY(y: number, offset: number) {
    // TODO: Need to implement undo/redo
    this.diagram.selectionState.elements.forEach(e => {
      e.bounds = Box.withY(e.bounds, y - e.bounds.size.h * offset);
      this.diagram.updateElement(e as DiagramNode);

      // TODO: Can we change so that selectionState uses a listener on diagram instead
      this.diagram.selectionState.recalculateBoundingBox();
    });
  }

  // x + w === X       => x = X - w       => x = X - w * offset (offset = 1)
  // x + w / 2 === X   => x = X - w / 2   => x = X - w * offset (offset = 0.5)
  // x === X           => x = X           => x = X - w * offset (offset = 0)
  private alignX(x: number, offset: number) {
    // TODO: Need to implement undo/redo
    this.diagram.selectionState.elements.forEach(e => {
      e.bounds = Box.withX(e.bounds, x - e.bounds.size.w * offset);
      this.diagram.updateElement(e as DiagramNode);

      // TODO: Can we change so that selectionState uses a listener on diagram instead
      this.diagram.selectionState.recalculateBoundingBox();
    });
  }
}
