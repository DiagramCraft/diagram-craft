import {
  Angle,
  Box,
  Direction,
  LocalCoordinateSystem,
  Point,
  TransformFactory,
  Translation,
  Vector
} from '../geometry/geometry.ts';
import { SelectionState } from '../model/selectionState.ts';
import { LoadedDiagram, MoveAction, ResizeAction, RotateAction } from '../model/diagram.ts';
import { assert, VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { Drag, DragActions, Modifiers } from './drag.ts';
import { SnapManager } from '../model/snap/snapManager.ts';

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
          selection.source.elements,
          selection.elements.map(e => e.bounds),
          selection.elements,
          diagram
        )
      );
      selection.rebaseline();
    }
  }
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

    const snapDirection: Direction[] = [];
    switch (drag.type) {
      case 'resize-e':
        localTarget.get('size').w = localOriginal.size.w + delta.x;
        snapDirection.push('e');
        break;
      case 'resize-w':
        localTarget.get('size').w = localOriginal.size.w - delta.x;
        localTarget.get('pos').x = localOriginal.pos.x + delta.x;
        snapDirection.push('w');
        break;
      case 'resize-n':
        localTarget.get('size').h = localOriginal.size.h - delta.y;
        localTarget.get('pos').y = localOriginal.pos.y + delta.y;
        snapDirection.push('n');
        break;
      case 'resize-s':
        localTarget.get('size').h = localOriginal.size.h + delta.y;
        snapDirection.push('s');
        break;
      case 'resize-nw':
        localTarget.get('size').h = localOriginal.size.h - delta.y;
        localTarget.get('pos').y = localOriginal.pos.y + delta.y;
        localTarget.get('size').w = localOriginal.size.w - delta.x;
        localTarget.get('pos').x = localOriginal.pos.x + delta.x;
        snapDirection.push('n');
        snapDirection.push('w');
        break;
      case 'resize-ne':
        localTarget.get('size').h = localOriginal.size.h - delta.y;
        localTarget.get('pos').y = localOriginal.pos.y + delta.y;
        localTarget.get('size').w = localOriginal.size.w + delta.x;
        snapDirection.push('n');
        snapDirection.push('e');
        break;
      case 'resize-se':
        localTarget.get('size').h = localOriginal.size.h + delta.y;
        localTarget.get('size').w = localOriginal.size.w + delta.x;
        snapDirection.push('s');
        snapDirection.push('e');
        break;
      case 'resize-sw':
        localTarget.get('size').h = localOriginal.size.h + delta.y;
        localTarget.get('size').w = localOriginal.size.w - delta.x;
        localTarget.get('pos').x = localOriginal.pos.x + delta.x;
        snapDirection.push('s');
        snapDirection.push('w');
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    const newBounds = Box.asMutableSnapshot(lcs.toGlobal(localTarget.getSnapshot()));

    if (modifiers.altKey) {
      selection.guides = [];
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
    }

    selection.bounds = newBounds.getSnapshot();
    diagram.transformNodes(selection.elements, TransformFactory.fromTo(before, selection.bounds));
  },
  onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    if (selection.isChanged()) {
      diagram.undoManager.add(
        new ResizeAction(
          selection.source.elements,
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
        selection.elements.map(e => e.id),
        snapDirections
      );

      const result = snapManager.snapMove(newBounds.getSnapshot());
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
    if (selection.isChanged()) {
      diagram.undoManager.add(
        new MoveAction(
          selection.source.elements,
          selection.elements.map(e => e.bounds),
          selection.elements,
          diagram
        )
      );
      selection.rebaseline();
    }
  }
};
