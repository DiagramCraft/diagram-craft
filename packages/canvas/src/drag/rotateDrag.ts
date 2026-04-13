import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { Angle } from '@diagram-craft/geometry/angle';
import { excludeLabelNodes, includeAll } from '@diagram-craft/model/selection';
import { transformElements } from '@diagram-craft/model/diagramElement';
import { SnapManager, SnapMarkers } from '../snap/snapManager';

const isFreeDrag = (m: Modifiers) => m.altKey;
const normalizeSignedAngle = (angle: number) => {
  const normalized = Angle.normalize(angle);
  return normalized > Math.PI ? normalized - Math.PI * 2 : normalized;
};

export const calculateTargetRotationAngle = (
  center: { x: number; y: number },
  initialOffset: { x: number; y: number },
  currentOffset: { x: number; y: number },
  initialRotation: number
) => {
  const startAngle = Vector.angle(Vector.from(center, initialOffset));
  const currentAngle = Vector.angle(Vector.from(center, currentOffset));
  return initialRotation + normalizeSignedAngle(currentAngle - startAngle);
};

export class RotateDrag extends Drag {
  private readonly capture: UndoCapture;

  constructor(
    private readonly diagram: Diagram,
    private readonly initialOffset: { x: number; y: number }
  ) {
    super();
    this.capture = this.diagram.undoManager.beginCapture('Rotate');
  }

  onDrag(event: DragEvents.DragStart) {
    const selection = this.diagram.selection;
    SnapMarkers.get(this.diagram).clear();

    const snapManager = SnapManager.create(this.diagram);

    const before = selection.bounds;
    const center = Box.center(selection.source.boundingBox);
    const targetAngle = calculateTargetRotationAngle(
      center,
      this.initialOffset,
      event.offset,
      selection.source.boundingBox.r
    );

    const result = snapManager.snapRotate({ ...before, r: targetAngle });
    const adjustedAngle = isFreeDrag(event.modifiers) ? targetAngle : result.adjusted.r;

    transformElements(
      selection.filter(
        'all',
        selection.type === 'single-label-node' ? includeAll : excludeLabelNodes
      ),
      TransformFactory.fromTo(before, { ...selection.bounds, r: adjustedAngle }),
      this.capture.uow
    );

    selection.forceRotation(adjustedAngle);

    this.setState({
      label: `angle: ${Angle.toDeg(adjustedAngle).toFixed(0)}°`
    });

    this.capture.uow.notify();

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selection.recalculateBoundingBox();

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    const selection = this.diagram.selection;

    this.capture.commit();

    selection.forceRotation(undefined);
    selection.rebaseline();
  }

  cancel() {
    this.capture.abort();
  }
}
