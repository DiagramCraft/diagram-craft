import { AbstractDrag } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Vector } from '../../geometry/vector.ts';
import { TransformFactory } from '../../geometry/transform.ts';
import { Diagram, excludeLabelNodes, includeAll } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

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

    this.uow.stopTracking();
    const snapshots = this.uow.commit();

    if (selection.isChanged()) {
      this.diagram.undoManager.add(new SnapshotUndoableAction('Rotate', this.diagram, snapshots));
    }

    selection.forceRotation(undefined);
    selection.rebaseline();
  }
}
