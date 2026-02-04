import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { Angle } from '@diagram-craft/geometry/angle';
import { excludeLabelNodes, includeAll } from '@diagram-craft/model/selection';
import { transformElements } from '@diagram-craft/model/diagramElement';
import { SnapManager, SnapMarkers } from '../snap/snapManager';

const isFreeDrag = (m: Modifiers) => m.altKey;

export class RotateDrag extends Drag {
  private readonly uow: UnitOfWork;

  constructor(private readonly diagram: Diagram) {
    super();
    this.uow = UnitOfWork.begin(this.diagram);
  }

  onDrag(event: DragEvents.DragStart) {
    const selection = this.diagram.selection;
    SnapMarkers.get(this.diagram).clear();

    const snapManager = SnapManager.create(this.diagram);

    const before = selection.bounds;

    const center = Box.center(selection.source.boundingBox);

    const handlePosition = { x: before.x + before.w, y: before.y };

    // Calculate the initial angle from center to the handle position
    const initialAngle = Vector.angle(Vector.from(center, handlePosition));

    // Calculate the current angle from center to the mouse position
    const currentAngle = Vector.angle(Vector.from(center, event.offset));

    const targetAngle = currentAngle - initialAngle;

    const result = snapManager.snapRotate({ ...before, r: targetAngle });
    const adjustedAngle = isFreeDrag(event.modifiers) ? targetAngle : result.adjusted.r;

    transformElements(
      selection.filter(
        'all',
        selection.type === 'single-label-node' ? includeAll : excludeLabelNodes
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
    this.diagram.selection.recalculateBoundingBox();

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    const selection = this.diagram.selection;

    if (selection.isChanged()) {
      this.uow.commitWithUndo('Rotate');
    } else {
      this.uow.abort();
    }

    selection.forceRotation(undefined);
    selection.rebaseline();
  }

  cancel() {
    this.uow.abort();
  }
}
