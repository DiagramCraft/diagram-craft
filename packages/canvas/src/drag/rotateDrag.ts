import { AbstractDrag } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram, excludeLabelNodes, includeAll } from '@diagram-craft/model/diagram';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

export class RotateDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(private readonly diagram: Diagram) {
    super();
    this.uow = new UnitOfWork(this.diagram, true);
  }

  onDrag(coord: Point) {
    const selection = this.diagram.selectionState;
    selection.guides = [];

    const before = selection.bounds;

    const center = Box.center(selection.source.boundingBox);

    const newAngle = Vector.angle(Vector.from(center, coord)) + Math.PI / 2;
    this.diagram.transformElements(
      selection.elements,
      TransformFactory.fromTo(before, { ...selection.bounds, r: newAngle }),
      this.uow,
      selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
    );

    selection.forceRotation(newAngle);

    this.setState({
      label: `angle: ${(Vector.angle(Vector.from(center, coord)) * (180 / Math.PI)).toFixed(0)}°`
    });

    this.uow.notify();

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selectionState.recalculateBoundingBox();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;

    if (selection.isChanged()) {
      this.uow.stopTracking();
      commitWithUndo(this.uow, 'Rotate');
    }

    selection.forceRotation(undefined);
    selection.rebaseline();
  }
}
