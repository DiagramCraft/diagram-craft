import { Action, ActionEvents } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { Box } from '../../geometry/box.ts';
import { NodeChangeAction } from '../../model-viewer/actions.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';

declare global {
  interface ActionMap {
    DISTRIBUTE_VERTICAL: DistributeAction;
    DISTRIBUTE_HORIZONTAL: DistributeAction;
  }
}

export class DistributeAction extends EventEmitter<ActionEvents> implements Action {
  enabled = false;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly mode: 'vertical' | 'horizontal'
  ) {
    super();
    const cb = () => {
      this.enabled = this.diagram.selectionState.elements.length > 1;
      this.emit('actionchanged', { action: this });
    };
    this.diagram.selectionState.on('add', cb);
    this.diagram.selectionState.on('remove', cb);
    this.diagram.selectionState.on('change', cb);
  }

  execute(): void {
    const action = new NodeChangeAction(
      this.diagram.selectionState.nodes,
      this.diagram,
      `Distribute ${this.mode}`
    );
    const boundsOrientation = this.mode === 'vertical' ? 'y' : 'x';
    const boundsSize = this.mode === 'vertical' ? 'h' : 'w';

    this.calculateAndUpdateBounds(boundsOrientation, boundsSize);

    this.diagram.selectionState.recalculateBoundingBox();
    this.diagram.undoManager.add(action);
    this.emit('actiontriggered', { action: this });
  }

  private calculateAndUpdateBounds(orientation: 'x' | 'y', size: 'w' | 'h'): void {
    const elementsInOrder = this.diagram.selectionState.elements.sort(
      (a, b) => Box.minBounds(a.bounds)[orientation] - Box.minBounds(b.bounds)[orientation]
    );

    const minimal = elementsInOrder[0];
    const min = Box.minBounds(minimal.bounds)[orientation];
    const max = Box.maxBounds(elementsInOrder.at(-1)!.bounds)[orientation];

    const totalSpace =
      max - min - this.diagram.selectionState.elements.reduce((p, c) => p + c.bounds.size[size], 0);

    const difference = totalSpace / (this.diagram.selectionState.elements.length - 1);

    let currentPosition = min + Math.abs(minimal.bounds.size[size] + difference);
    for (const e of this.diagram.selectionState.elements.slice(1)) {
      if (e.bounds.size[size] >= 0) {
        e.bounds =
          orientation === 'y'
            ? Box.withY(e.bounds, currentPosition)
            : Box.withX(e.bounds, currentPosition);
      } else {
        e.bounds =
          orientation === 'y'
            ? Box.withY(e.bounds, currentPosition - e.bounds.size[size])
            : Box.withX(e.bounds, currentPosition - e.bounds.size[size]);
      }

      this.diagram.updateElement(e as DiagramNode);
      currentPosition += Math.abs(e.bounds.size[size] + difference);
    }
  }
}
