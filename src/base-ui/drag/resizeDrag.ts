import { Drag, Modifiers } from '../drag.ts';
import { Point } from '../../geometry/point.ts';
import { assert, VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { LocalCoordinateSystem } from '../../geometry/lcs.ts';
import { Box } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { TransformFactory } from '../../geometry/transform.ts';
import { ResizeAction } from '../../model/diagramUndoActions.ts';
import { MutableSnapshot } from '../../utils/mutableSnapshot.ts';
import { Diagram } from '../../model/diagram.ts';

export class ResizeDrag implements Drag {
  constructor(
    private readonly diagram: Diagram,
    private readonly type:
      | 'resize-nw'
      | 'resize-ne'
      | 'resize-sw'
      | 'resize-se'
      | 'resize-n'
      | 'resize-s'
      | 'resize-w'
      | 'resize-e',
    private readonly offset: Point
  ) {}

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;
    assert.false(selection.isEmpty());

    const before = selection.bounds;
    const original = selection.source.boundingBox;

    const lcs = LocalCoordinateSystem.fromBox(selection.bounds);

    const localTarget = Box.asMutableSnapshot(lcs.toLocal(selection.bounds));
    const localOriginal = lcs.toLocal(original);

    const delta = Point.subtract(lcs.toLocal(coord), lcs.toLocal(this.offset));

    const constrainAspectRatio = modifiers.shiftKey;
    const aspectRatio = localOriginal.size.w / localOriginal.size.h;

    const targetSize = localTarget.get('size');
    const targetPos = localTarget.get('pos');

    const snapDirection: Direction[] = [];
    switch (this.type) {
      case 'resize-e':
        targetSize.w = localOriginal.size.w + delta.x;
        snapDirection.push('e');
        break;
      case 'resize-w':
        targetPos.x = localOriginal.pos.x + delta.x;
        targetSize.w = localOriginal.size.w - delta.x;
        snapDirection.push('w');
        break;
      case 'resize-n':
        targetPos.y = localOriginal.pos.y + delta.y;
        targetSize.h = localOriginal.size.h - delta.y;
        snapDirection.push('n');
        break;
      case 'resize-s':
        targetSize.h = localOriginal.size.h + delta.y;
        snapDirection.push('s');
        break;
      case 'resize-nw':
        targetPos.x = localOriginal.pos.x + delta.x;
        targetPos.y = localOriginal.pos.y + delta.y;
        targetSize.w = localOriginal.size.w - delta.x;
        targetSize.h = localOriginal.size.h - delta.y;
        snapDirection.push('n', 'w');
        break;
      case 'resize-ne':
        targetPos.y = localOriginal.pos.y + delta.y;
        targetSize.w = localOriginal.size.w + delta.x;
        targetSize.h = localOriginal.size.h - delta.y;
        snapDirection.push('n', 'e');
        break;
      case 'resize-se':
        targetSize.w = localOriginal.size.w + delta.x;
        targetSize.h = localOriginal.size.h + delta.y;
        snapDirection.push('s', 'e');
        break;
      case 'resize-sw':
        targetPos.x = localOriginal.pos.x + delta.x;
        targetSize.w = localOriginal.size.w - delta.x;
        targetSize.h = localOriginal.size.h + delta.y;
        snapDirection.push('s', 'w');
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    const newBounds = Box.asMutableSnapshot(lcs.toGlobal(localTarget.getSnapshot()));

    if (modifiers.altKey) {
      selection.guides = [];

      if (constrainAspectRatio) {
        this.applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs);
      }
    } else {
      const snapManager = this.diagram.createSnapManager();

      const result = snapManager.snapResize(newBounds.getSnapshot(), snapDirection);
      selection.guides = result.guides;

      newBounds.set('pos', result.adjusted.pos);
      newBounds.set('size', result.adjusted.size);

      if (constrainAspectRatio) {
        this.applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs);
        selection.guides = snapManager.reviseGuides(result.guides, newBounds.getSnapshot());
      }
    }

    this.diagram.transformElements(
      selection.nodes,
      TransformFactory.fromTo(before, newBounds.getSnapshot())
    );

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selectionState.recalculateBoundingBox();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;
    if (selection.isChanged()) {
      this.diagram.undoManager.add(
        new ResizeAction(
          selection.source.elementBoxes,
          selection.nodes.map(e => e.bounds),
          selection.nodes,
          this.diagram,
          'Resize'
        )
      );
      selection.rebaseline();
    }
  }

  private applyAspectRatioContraint(
    aspectRatio: number,
    newBounds: MutableSnapshot<Box>,
    localOriginal: Box,
    lcs: LocalCoordinateSystem
  ) {
    const localTarget = Box.asMutableSnapshot(lcs.toLocal(newBounds.getSnapshot()));

    const targetSize = localTarget.get('size');
    const targetPos = localTarget.get('pos');

    switch (this.type) {
      case 'resize-e':
      case 'resize-w':
        targetSize.h = targetSize.w / aspectRatio;
        break;
      case 'resize-n':
      case 'resize-s':
      case 'resize-ne':
      case 'resize-se':
        targetSize.w = targetSize.h * aspectRatio;
        break;
      case 'resize-nw':
      case 'resize-sw':
        targetSize.w = targetSize.h * aspectRatio;
        targetPos.x = localOriginal.pos.x + localOriginal.size.w - targetSize.w;
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    const globalTarget = lcs.toGlobal(localTarget.getSnapshot());
    newBounds.set('size', globalTarget.size);
    newBounds.set('pos', globalTarget.pos);
  }
}
