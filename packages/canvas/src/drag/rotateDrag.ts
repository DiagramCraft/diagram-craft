import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Angle } from '@diagram-craft/geometry/angle';
import { excludeLabelNodes, includeAll } from '@diagram-craft/model/selectionState';

const isFreeDrag = (m: Modifiers) => m.altKey;

export class RotateDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(private readonly diagram: Diagram) {
    super();
    this.uow = new UnitOfWork(this.diagram, true);
  }

  onDrag(coord: Point, modifiers: Modifiers) {
    const selection = this.diagram.selectionState;
    selection.guides = [];

    const snapManager = this.diagram.createSnapManager();

    const before = selection.bounds;

    const center = Box.center(selection.source.boundingBox);

    const targetAngle = Vector.angle(Vector.from(center, coord)) + Math.PI / 2 - Math.PI / 4;

    const result = snapManager.snapRotate({ ...before, r: targetAngle });
    const adjustedAngle = isFreeDrag(modifiers) ? targetAngle : result.adjusted.r;

    this.diagram.transformElements(
      selection.filter(
        'all',
        selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
      ),
      TransformFactory.fromTo(before, { ...selection.bounds, r: adjustedAngle }),
      this.uow
    );

    selection.forceRotation(adjustedAngle);

    this.setState({
      label: `angle: ${Angle.toDeg(adjustedAngle).toFixed(0)}°`
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
