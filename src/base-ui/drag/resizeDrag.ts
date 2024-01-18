import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { LocalCoordinateSystem } from '../../geometry/lcs.ts';
import { Box, WritableBox } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { TransformFactory } from '../../geometry/transform.ts';
import { Diagram, excludeLabelNodes, includeAll } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

export type ResizeType = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const isConstraintDrag = (m: Modifiers) => m.shiftKey;
const isFreeDrag = (m: Modifiers) => m.altKey;

export class ResizeDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;

  constructor(
    private readonly diagram: Diagram,
    private readonly type: ResizeType,
    private readonly offset: Point
  ) {
    super();
    this.uow = new UnitOfWork(this.diagram, true);
  }

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;

    const before = selection.bounds;
    const original = selection.source.boundingBox;

    const lcs = LocalCoordinateSystem.fromBox(selection.bounds);

    // TODO: Need some sort of utility for this piece
    const localTarget = Box.asReadWrite(lcs.toLocal(selection.bounds));
    const localOriginal = lcs.toLocal(original);

    const delta = Point.subtract(lcs.toLocal(coord), lcs.toLocal(this.offset));

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

    if (isFreeDrag(modifiers)) {
      selection.guides = [];

      if (isConstraintDrag(modifiers)) {
        this.applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs);
      }
    } else {
      const snapManager = this.diagram.createSnapManager();

      const result = snapManager.snapResize(WritableBox.asBox(newBounds), snapDirection);
      selection.guides = result.guides;

      newBounds.x = result.adjusted.x;
      newBounds.y = result.adjusted.y;
      newBounds.w = result.adjusted.w;
      newBounds.h = result.adjusted.h;

      if (isConstraintDrag(modifiers)) {
        this.applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs);
        selection.guides = snapManager.reviseGuides(result.guides, WritableBox.asBox(newBounds));
      }
    }

    selection.forceRotation(undefined);

    this.diagram.transformElements(
      selection.elements,
      TransformFactory.fromTo(before, WritableBox.asBox(newBounds)),
      this.uow,
      selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
    );
    this.uow.notify();

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selectionState.recalculateBoundingBox();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;

    this.uow.stopTracking();
    const snapshots = this.uow.commit();

    if (selection.isChanged()) {
      this.diagram.undoManager.add(new SnapshotUndoableAction('Resize', this.diagram, snapshots));
    }

    selection.rebaseline();
  }

  private applyAspectRatioContraint(
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
