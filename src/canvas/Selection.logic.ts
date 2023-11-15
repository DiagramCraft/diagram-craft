import { Direction } from '../geometry/direction.ts';
import { SelectionState } from '../model/selectionState.ts';
import { LoadedDiagram, MoveAction, ResizeAction, RotateAction } from '../model/diagram.ts';
import { assert, VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { Drag, DragActions, Modifiers } from './drag.ts';
import { SnapManager } from '../model/snap/snapManager.ts';
import { deepClone } from '../utils/clone.ts';
import { LocalCoordinateSystem } from '../geometry/lcs.ts';
import { TransformFactory, Translation } from '../geometry/transform.ts';
import { Vector } from '../geometry/vector.ts';
import { Point } from '../geometry/point.ts';
import { Box } from '../geometry/box.ts';
import { Angle } from '../geometry/angle.ts';
import { MutableSnapshot } from '../utils/mutableSnapshot.ts';

export const rotateDragActions: DragActions = {
  onDrag: (coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    assert.false(selection.isEmpty());

    const before = selection.bounds;

    const center = Box.center(selection.source.boundingBox);
    selection.bounds = {
      ...selection.bounds,
      rotation: Vector.angle(Vector.from(center, coord)) + Math.PI / 2
    };

    diagram.transformNodes(selection.elements, TransformFactory.fromTo(before, selection.bounds));
  },
  onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    if (selection.isChanged()) {
      diagram.undoManager.add(
        new RotateAction(
          selection.source.elementBoxes,
          selection.elements.map(e => e.bounds),
          selection.elements,
          diagram
        )
      );
      selection.rebaseline();
    }
  }
};

const applyAspectRatioContraint = (
  aspectRatio: number,
  newBounds: MutableSnapshot<Box>,
  localOriginal: Box,
  lcs: LocalCoordinateSystem,
  direction: Drag['type']
) => {
  const localTarget = Box.asMutableSnapshot(lcs.toLocal(newBounds.getSnapshot()));

  const targetSize = localTarget.get('size');
  const targetPos = localTarget.get('pos');

  switch (direction) {
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
};

export const resizeDragActions: DragActions = {
  onDrag: (
    coord: Point,
    drag: Drag,
    diagram: LoadedDiagram,
    selection: SelectionState,
    modifiers: Modifiers
  ) => {
    assert.false(selection.isEmpty());

    const before = selection.bounds;
    const original = selection.source.boundingBox;

    const lcs = LocalCoordinateSystem.fromBox(selection.bounds);

    const localTarget = Box.asMutableSnapshot(lcs.toLocal(selection.bounds));
    const localOriginal = lcs.toLocal(original);

    const delta = Point.subtract(lcs.toLocal(coord), lcs.toLocal(drag.offset));

    const constrainAspectRatio = modifiers.shiftKey;
    const aspectRatio = localOriginal.size.w / localOriginal.size.h;

    const targetSize = localTarget.get('size');
    const targetPos = localTarget.get('pos');

    const snapDirection: Direction[] = [];
    switch (drag.type) {
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
        applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs, drag.type);
      }
    } else {
      const snapManager = new SnapManager(
        diagram,
        selection.elements.map(e => e.id)
      );

      const result = snapManager.snapResize(newBounds.getSnapshot(), snapDirection);
      selection.guides = result.guides;
      selection.anchors = result.anchors;

      newBounds.set('pos', result.adjusted.pos);
      newBounds.set('size', result.adjusted.size);

      if (constrainAspectRatio) {
        applyAspectRatioContraint(aspectRatio, newBounds, localOriginal, lcs, drag.type);
        selection.guides = snapManager.reviseGuides(result.guides, newBounds.getSnapshot());
      }
    }

    selection.bounds = newBounds.getSnapshot();
    diagram.transformNodes(selection.elements, TransformFactory.fromTo(before, selection.bounds));
  },
  onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    if (selection.isChanged()) {
      diagram.undoManager.add(
        new ResizeAction(
          selection.source.elementBoxes,
          selection.elements.map(e => e.bounds),
          selection.elements,
          diagram
        )
      );
      selection.rebaseline();
    }
  }
};

export const moveDragActions: DragActions = {
  onDrag: (
    coord: Point,
    drag: Drag,
    diagram: LoadedDiagram,
    selection: SelectionState,
    modifiers: Modifiers
  ) => {
    assert.false(selection.isEmpty());

    const d = Point.subtract(coord, Point.add(selection.bounds.pos, drag.offset));

    const newBounds = Box.asMutableSnapshot(selection.bounds);

    newBounds.set('pos', Point.add(selection.bounds.pos, d));

    let snapDirections: Direction[] = ['n', 'w', 'e', 's'];

    // TODO: Ideally we would want to trigger some of this based on button press instead of mouse move
    if (modifiers.metaKey && !selection.state['metaKey']) {
      // Reset current selection back to original
      diagram.transformNodes(selection.elements, [
        new Translation(Point.subtract(selection.source.boundingBox.pos, selection.bounds.pos))
      ]);

      newBounds.set('pos', selection.source.boundingBox.pos);
      selection.bounds = newBounds.getSnapshot();
      selection.guides = [];

      const newElements = selection.source.elementIds.map(e => deepClone(diagram.nodeLookup[e]));
      newElements.forEach(e => {
        e.id = diagram.newid();
        diagram.addNode(e);
      });
      selection.elements = newElements;

      selection.state['metaKey'] = true;
    } else if (!modifiers.metaKey && selection.state['metaKey']) {
      selection.state['metaKey'] = false;

      const elementsToRemove = selection.elements;

      selection.elements = selection.source.elementIds.map(e => diagram.nodeLookup[e]);
      selection.recalculateBoundingBox();
      selection.guides = [];

      elementsToRemove.forEach(e => {
        diagram.removeNode(e);
      });
    }

    // TODO: Perhaps support 45 degree angles
    if (modifiers.shiftKey) {
      const source = Point.add(selection.source.boundingBox.pos, drag.offset);

      const v = Vector.from(source, coord);
      const length = Vector.length(v);
      const angle = Vector.angle(v);

      let snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);

      drag.state ??= {};
      if (drag.state.snapAngle === 'h') {
        snapAngle = Math.round(angle / Math.PI) * Math.PI;
      } else if (drag.state.snapAngle === 'v') {
        snapAngle = Math.round((angle + Math.PI / 2) / Math.PI) * Math.PI - Math.PI / 2;
        snapDirections = ['n', 's'];
      } else if (length > 20) {
        drag.state.snapAngle = Angle.isHorizontal(snapAngle) ? 'h' : 'v';
        snapDirections = ['e', 'w'];
      }

      newBounds.set(
        'pos',
        Point.add(selection.source.boundingBox.pos, Vector.fromPolar(snapAngle, length))
      );
    }

    if (modifiers.altKey) {
      selection.guides = [];
    } else {
      const snapManager = new SnapManager(
        diagram,
        selection.elements.map(e => e.id)
      );

      const result = snapManager.snapMove(newBounds.getSnapshot(), snapDirections);
      selection.guides = result.guides;
      selection.anchors = result.anchors;

      newBounds.set('pos', result.adjusted.pos);
    }

    diagram.transformNodes(selection.elements, [
      new Translation(Point.subtract(newBounds.get('pos'), selection.bounds.pos))
    ]);
    selection.bounds = newBounds.getSnapshot();
  },
  onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    selection.state['metaKey'] = false;

    if (selection.isChanged()) {
      diagram.undoManager.add(
        new MoveAction(
          selection.source.elementBoxes,
          selection.elements.map(e => e.bounds),
          selection.elements,
          diagram
        )
      );
      selection.rebaseline();
    }
  }
};
