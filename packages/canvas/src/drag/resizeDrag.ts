import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Direction } from '@diagram-craft/geometry/direction';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { excludeLabelNodes, includeAll } from '@diagram-craft/model/selectionState';

export type ResizeType = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const isConstraintDrag = (m: Modifiers) => m.shiftKey;
const isFreeDrag = (m: Modifiers) => m.altKey;

export class ResizeDrag extends Drag {
  private readonly uow: UnitOfWork;
  private readonly originalBounds: Box;

  constructor(
    private readonly diagram: Diagram,
    private type: ResizeType,
    private offset: Point
  ) {
    super();
    this.uow = new UnitOfWork(this.diagram, true);
    this.originalBounds = this.diagram.selectionState.bounds;
  }

  onDrag(event: DragEvents.DragStart): void {
    const selection = this.diagram.selectionState;

    const before = this.originalBounds;
    const original = selection.source.boundingBox;

    const lcs = LocalCoordinateSystem.fromBox(before);

    // TODO: Need some sort of utility for this piece
    const localTarget = Box.asReadWrite(lcs.toLocal(before));
    const localOriginal = lcs.toLocal(original);

    const delta = Point.subtract(lcs.toLocal(event.offset), lcs.toLocal(this.offset));

    const aspectRatio = localOriginal.w / localOriginal.h;

    this.setState({
      label: `w: ${localTarget.w.toFixed(0)}, h: ${localTarget.h.toFixed(0)}`
    });

    const snapDirection: Direction[] = [];
    switch (this.type) {
      case 'e':
        localTarget.w = localOriginal.w + delta.x;
        snapDirection.push('e');
        break;
      case 'w':
        localTarget.x = localOriginal.x + delta.x;
        localTarget.w = localOriginal.w - delta.x;
        snapDirection.push('w');
        break;
      case 'n':
        localTarget.y = localOriginal.y + delta.y;
        localTarget.h = localOriginal.h - delta.y;
        snapDirection.push('n');
        break;
      case 's':
        localTarget.h = localOriginal.h + delta.y;
        snapDirection.push('s');
        break;
      case 'nw':
        localTarget.x = localOriginal.x + delta.x;
        localTarget.y = localOriginal.y + delta.y;
        localTarget.w = localOriginal.w - delta.x;
        localTarget.h = localOriginal.h - delta.y;
        snapDirection.push('n', 'w');
        break;
      case 'ne':
        localTarget.y = localOriginal.y + delta.y;
        localTarget.w = localOriginal.w + delta.x;
        localTarget.h = localOriginal.h - delta.y;
        snapDirection.push('n', 'e');
        break;
      case 'se':
        localTarget.w = localOriginal.w + delta.x;
        localTarget.h = localOriginal.h + delta.y;
        snapDirection.push('s', 'e');
        break;
      case 'sw':
        localTarget.x = localOriginal.x + delta.x;
        localTarget.w = localOriginal.w - delta.x;
        localTarget.h = localOriginal.h + delta.y;
        snapDirection.push('s', 'w');
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    const newBounds = Box.asReadWrite(lcs.toGlobal(WritableBox.asBox(localTarget)));

    if (isFreeDrag(event.modifiers)) {
      selection.guides = [];

      if (isConstraintDrag(event.modifiers)) {
        this.applyAspectRatioConstraint(aspectRatio, newBounds, localOriginal, lcs);
      }
    } else {
      const snapManager = this.diagram.createSnapManager();

      const result = snapManager.snapResize(WritableBox.asBox(newBounds), snapDirection);
      selection.guides = result.guides;

      newBounds.x = result.adjusted.x;
      newBounds.y = result.adjusted.y;
      newBounds.w = result.adjusted.w;
      newBounds.h = result.adjusted.h;

      if (isConstraintDrag(event.modifiers)) {
        this.applyAspectRatioConstraint(aspectRatio, newBounds, localOriginal, lcs);
        selection.guides = snapManager.reviseGuides(result.guides, WritableBox.asBox(newBounds));
      }
    }

    selection.forceRotation(undefined);

    if (newBounds.w < 0) {
      newBounds.x += newBounds.w;
      newBounds.w = -newBounds.w;
    }

    if (newBounds.h < 0) {
      newBounds.y += newBounds.h;
      newBounds.h = -newBounds.h;
    }

    newBounds.w = Math.max(0.1, newBounds.w);
    newBounds.h = Math.max(0.1, newBounds.h);

    this.diagram.transformElements(
      selection.filter(
        'all',
        selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
      ),
      TransformFactory.fromTo(selection.bounds, WritableBox.asBox(newBounds)),
      this.uow
    );
    this.uow.notify();

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selectionState.recalculateBoundingBox();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;

    if (selection.isChanged()) {
      this.uow.stopTracking();
      commitWithUndo(this.uow, 'Resize');
    } else {
      this.uow.abort();
    }

    selection.rebaseline();
    this.emit('dragEnd');
  }

  private applyAspectRatioConstraint(
    aspectRatio: number,
    newBounds: WritableBox,
    localOriginal: Box,
    lcs: LocalCoordinateSystem
  ) {
    const localTarget = Box.asReadWrite(lcs.toLocal(WritableBox.asBox(newBounds)));

    switch (this.type) {
      case 'e':
      case 'w':
        localTarget.h = localTarget.w / aspectRatio;
        break;
      case 'n':
      case 's':
      case 'ne':
      case 'se':
        localTarget.w = localTarget.h * aspectRatio;
        break;
      case 'nw':
      case 'sw':
        localTarget.w = localTarget.h * aspectRatio;
        localTarget.x = localOriginal.x + localOriginal.w - localTarget.w;
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    const globalTarget = lcs.toGlobal(WritableBox.asBox(localTarget));
    newBounds.w = globalTarget.w;
    newBounds.h = globalTarget.h;
    newBounds.x = globalTarget.x;
    newBounds.y = globalTarget.y;
  }
}
