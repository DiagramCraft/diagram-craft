import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { assert, VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { LocalCoordinateSystem } from '../../geometry/lcs.ts';
import { Box, WritableBox } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { TransformFactory } from '../../geometry/transform.ts';
import { ResizeAction } from '../../model/diagramUndoActions.ts';
import { Diagram, excludeLabelNodes, includeAll } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

export type ResizeType =
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  | 'resize-n'
  | 'resize-s'
  | 'resize-w'
  | 'resize-e';

export class ResizeDrag extends AbstractDrag {
  constructor(
    private readonly diagram: Diagram,
    private readonly type: ResizeType,
    private readonly offset: Point
  ) {
    super();
  }

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;
    assert.false(selection.isEmpty());

    const before = selection.bounds;
    const original = selection.source.boundingBox;

    const lcs = LocalCoordinateSystem.fromBox(selection.bounds);

    // TODO: Need some sort of utility for this piece
    const localTarget = Box.asReadWrite(lcs.toLocal(selection.bounds));
    const localOriginal = lcs.toLocal(original);

    const delta = Point.subtract(lcs.toLocal(coord), lcs.toLocal(this.offset));

    const constrainAspectRatio = modifiers.shiftKey;
    const aspectRatio = localOriginal.w / localOriginal.h;

    this.setState({
      label: `w: ${localTarget.w.toFixed(0)}, h: ${localTarget.h.toFixed(0)}`
    });

    const snapDirection: Direction[] = [];
    switch (this.type) {
      case 'resize-e':
        localTarget.w = localOriginal.w + delta.x;
        snapDirection.push('e');
        break;
      case 'resize-w':
        localTarget.x = localOriginal.x + delta.x;
        localTarget.w = localOriginal.w - delta.x;
        snapDirection.push('w');
        break;
      case 'resize-n':
        localTarget.y = localOriginal.y + delta.y;
        localTarget.h = localOriginal.h - delta.y;
        snapDirection.push('n');
        break;
      case 'resize-s':
        localTarget.h = localOriginal.h + delta.y;
        snapDirection.push('s');
        break;
      case 'resize-nw':
        localTarget.x = localOriginal.x + delta.x;
        localTarget.y = localOriginal.y + delta.y;
        localTarget.w = localOriginal.w - delta.x;
        localTarget.h = localOriginal.h - delta.y;
        snapDirection.push('n', 'w');
        break;
      case 'resize-ne':
        localTarget.y = localOriginal.y + delta.y;
        localTarget.w = localOriginal.w + delta.x;
        localTarget.h = localOriginal.h - delta.y;
        snapDirection.push('n', 'e');
        break;
      case 'resize-se':
        localTarget.w = localOriginal.w + delta.x;
        localTarget.h = localOriginal.h + delta.y;
        snapDirection.push('s', 'e');
        break;
      case 'resize-sw':
        localTarget.x = localOriginal.x + delta.x;
        localTarget.w = localOriginal.w - delta.x;
        localTarget.h = localOriginal.h + delta.y;
        snapDirection.push('s', 'w');
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    const newBounds = Box.asReadWrite(lcs.toGlobal(WritableBox.asBox(localTarget)));

    if (modifiers.altKey) {
      selection.guides = [];

      if (constrainAspectRatio) {
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

      if (constrainAspectRatio) {
        this.applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs);
        selection.guides = snapManager.reviseGuides(result.guides, WritableBox.asBox(newBounds));
      }
    }

    selection.forceRotation(undefined);

    const uow = new UnitOfWork(this.diagram, 'interactive');
    this.diagram.transformElements(
      selection.elements,
      TransformFactory.fromTo(before, WritableBox.asBox(newBounds)),
      uow,
      selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
    );
    uow.commit();

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selectionState.recalculateBoundingBox();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;
    if (selection.isChanged()) {
      this.diagram.undoManager.add(
        new ResizeAction(
          selection.source.elementBoxes,
          selection.elements.map(e => e.bounds),
          selection.elements,
          this.diagram,
          'Resize'
        )
      );

      // This is needed to force a final transformation to be applied
      const uow = new UnitOfWork(this.diagram);
      this.diagram.transformElements(selection.elements, [], uow);
      uow.commit();

      selection.rebaseline();
    }
  }

  private applyAspectRatioContraint(
    aspectRatio: number,
    newBounds: WritableBox,
    localOriginal: Box,
    lcs: LocalCoordinateSystem
  ) {
    const localTarget = Box.asReadWrite(lcs.toLocal(WritableBox.asBox(newBounds)));

    switch (this.type) {
      case 'resize-e':
      case 'resize-w':
        localTarget.h = localTarget.w / aspectRatio;
        break;
      case 'resize-n':
      case 'resize-s':
      case 'resize-ne':
      case 'resize-se':
        localTarget.w = localTarget.h * aspectRatio;
        break;
      case 'resize-nw':
      case 'resize-sw':
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
