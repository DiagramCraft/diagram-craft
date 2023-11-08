import {
  Box,
  Line,
  LocalCoordinateSystem,
  Point,
  TransformFactory,
  Translation,
  Vector
} from '../geometry/geometry.ts';
import { Guide, SelectionState } from '../model/selectionState.ts';
import {
  Anchor,
  LoadedDiagram,
  MoveAction,
  NodeHelper,
  ResizeAction,
  RotateAction
} from '../model/diagram.ts';
import { assert, VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { Drag, DragActions } from './drag.ts';

export const rotateDragActions: DragActions = {
  onDrag: (coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    assert.false(selection.isEmpty());

    const before = selection.bounds;

    const center = Box.center(selection.source.boundingBox);
    selection.bounds = {
      ...selection.bounds,
      rotation: Vector.angle(Vector.from(center, coord))
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
  onDrag: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    assert.false(selection.isEmpty());

    const before = selection.bounds;
    const original = selection.source.boundingBox;

    const lcs = LocalCoordinateSystem.fromBox(selection.bounds);

    const localTarget = Box.asMutableSnapshot(lcs.toLocal(selection.bounds));
    const localOriginal = lcs.toLocal(original);

    const delta = Point.subtract(lcs.toLocal(coord), lcs.toLocal(drag.offset));

    switch (drag.type) {
      case 'resize-e':
        localTarget.get('size').w = localOriginal.size.w + delta.x;
        break;
      case 'resize-w':
        localTarget.get('size').w = localOriginal.size.w - delta.x;
        localTarget.get('pos').x = localOriginal.pos.x + delta.x;
        break;
      case 'resize-n':
        localTarget.get('size').h = localOriginal.size.h - delta.y;
        localTarget.get('pos').y = localOriginal.pos.y + delta.y;
        break;
      case 'resize-s':
        localTarget.get('size').h = localOriginal.size.h + delta.y;
        break;
      case 'resize-nw':
        localTarget.get('size').h = localOriginal.size.h - delta.y;
        localTarget.get('pos').y = localOriginal.pos.y + delta.y;
        localTarget.get('size').w = localOriginal.size.w - delta.x;
        localTarget.get('pos').x = localOriginal.pos.x + delta.x;
        break;
      case 'resize-ne':
        localTarget.get('size').h = localOriginal.size.h - delta.y;
        localTarget.get('pos').y = localOriginal.pos.y + delta.y;
        localTarget.get('size').w = localOriginal.size.w + delta.x;
        break;
      case 'resize-se':
        localTarget.get('size').h = localOriginal.size.h + delta.y;
        localTarget.get('size').w = localOriginal.size.w + delta.x;
        break;
      case 'resize-sw':
        localTarget.get('size').h = localOriginal.size.h + delta.y;
        localTarget.get('size').w = localOriginal.size.w - delta.x;
        localTarget.get('pos').x = localOriginal.pos.x + delta.x;
        break;
      default:
        VERIFY_NOT_REACHED();
    }

    selection.bounds = lcs.toGlobal(localTarget.getSnapshot());

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
  onDrag: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    assert.false(selection.isEmpty());

    const anchors = NodeHelper.anchors(selection.bounds).map(a => ({
      anchor: a,
      matches: [] as Anchor[]
    }));

    const d = Point.subtract(coord, Point.add(selection.bounds.pos, drag.offset));

    const otherAnchors: Anchor[] = [];
    for (const node of diagram.queryNodes()) {
      if (Box.equals(node.bounds, selection.bounds)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        otherAnchors.push(other);
      }
    }
    otherAnchors.push({
      offset: { x: 0, y: 0 },
      pos: { x: 320, y: 0 },
      axis: 'y',
      type: 'canvas'
    });
    otherAnchors.push({
      offset: { x: 0, y: 0 },
      pos: { x: 320, y: 480 },
      axis: 'y',
      type: 'canvas'
    });
    otherAnchors.push({
      offset: { x: 0, y: 0 },
      pos: { x: 0, y: 240 },
      axis: 'x',
      type: 'canvas'
    });
    otherAnchors.push({
      offset: { x: 0, y: 0 },
      pos: { x: 640, y: 240 },
      axis: 'x',
      type: 'canvas'
    });

    // Find potential guides for new position
    const threshold = 10;
    for (const other of otherAnchors) {
      for (const self of anchors) {
        if (
          other.axis === 'x' &&
          self.anchor.axis === 'x' &&
          Math.abs(Math.round(other.pos.y) - Math.round(Point.add(d, self.anchor.pos).y)) <
            threshold
        ) {
          self.matches.push(other);
        } else if (
          other.axis === 'y' &&
          self.anchor.axis === 'y' &&
          Math.abs(Math.round(other.pos.x) - Math.round(Point.add(d, self.anchor.pos).x)) <
            threshold
        ) {
          self.matches.push(other);
        }
      }
    }

    const matchingAnchors = anchors.filter(a => a.matches.length > 0);

    const newBounds = Box.asMutableSnapshot(selection.bounds);
    newBounds.set('pos', {
      x: selection.bounds.pos.x + d.x,
      y: selection.bounds.pos.y + d.y
    });

    if (matchingAnchors.length === 0) {
      selection.guides = [];
    } else {
      for (const direction of ['x', 'y'] as const) {
        // Find closest anchor
        let currentDistance = Number.MAX_VALUE;
        let closestAnchor: Anchor | undefined = undefined;
        let sourceAnchor: Anchor | undefined = undefined;
        for (const a of matchingAnchors.filter(a => a.anchor.axis === direction)) {
          for (const m of a.matches) {
            const d = Math.abs(
              direction === 'x'
                ? Math.abs(m.pos.y - a.anchor.pos.y)
                : Math.abs(m.pos.x - a.anchor.pos.x)
            );
            if (d < currentDistance) {
              currentDistance = d;
              closestAnchor = m;
              sourceAnchor = a.anchor;
            }
          }
        }

        if (closestAnchor === undefined || sourceAnchor === undefined) continue;

        if (closestAnchor.axis === 'x') {
          newBounds.set('pos', {
            x: newBounds.get('pos').x,
            y: closestAnchor.pos.y - sourceAnchor.offset.y
          });
        } else {
          newBounds.set('pos', {
            x: closestAnchor.pos.x - sourceAnchor.offset.x,
            y: newBounds.get('pos').y
          });
        }
      }

      const guides: Guide[] = [];
      for (const axis of ['x', 'y'] as const) {
        for (const dir of [-1, 1]) {
          for (const m of matchingAnchors) {
            if (m.anchor.axis !== axis) continue;

            let match: Anchor | undefined = undefined;
            let matchDistance = 0;

            for (const a of m.matches) {
              const distance = Point.subtract(
                Point.add(newBounds.get('pos'), m.anchor.offset),
                a.pos
              );

              const otherAxis = axis === 'x' ? 'y' : 'x';

              if (distance[axis] * dir < 0) continue;
              if (Math.abs(distance[otherAxis]) > 1) continue;

              if (Math.abs(distance[axis]) > matchDistance) {
                match = a;
                matchDistance = Math.abs(distance[axis]);
              }
            }

            if (!match) continue;

            if (match.axis === 'x') {
              // TODO: I wonder if we should modify the anchors instead of
              //       just modifying the line
              guides.push({
                line: Line.extend(
                  {
                    from: match.pos,
                    to: Point.add(newBounds.get('pos'), m.anchor.offset)
                  },
                  match.offset.x,
                  m.anchor.offset.x
                ),
                type: match.type
              });
            } else {
              guides.push({
                line: Line.extend(
                  {
                    from: match.pos,
                    to: Point.add(newBounds.get('pos'), m.anchor.offset)
                  },
                  match.offset.y,
                  m.anchor.offset.y
                ),
                type: match.type
              });
            }
          }
        }
      }

      selection.guides = guides;
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
