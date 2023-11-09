import { Box, Line, Point } from '../geometry/geometry.ts';
import { Anchor, Axis, LoadedDiagram, NodeHelper } from './diagram.ts';
import { Guide } from './selectionState.ts';

type SnapResult = {
  guides: Guide[];
  adjusted: Box;
};

export class SnapManager {
  private threshold = 10;

  constructor(private readonly diagram: LoadedDiagram) {}

  // TODO: This can probably be optimized to first check the bounds of the node
  //       before add all the anchors of that node
  private getNodeAnchors(b: Box): Anchor[] {
    const dest: Anchor[] = [];
    for (const node of this.diagram.queryNodes()) {
      if (Box.equals(node.bounds, b)) continue;
      for (const other of NodeHelper.anchors(node.bounds)) {
        dest.push(other);
      }
    }
    return dest;
  }

  // TODO: Need a way to get the canvas bounds
  private getCanvasAnchors(): Anchor[] {
    return [
      {
        offset: { x: 0, y: 0 },
        pos: { x: 320, y: 0 },
        axis: 'y',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 320, y: 480 },
        axis: 'y',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 0, y: 240 },
        axis: 'x',
        type: 'canvas'
      },
      {
        offset: { x: 0, y: 0 },
        pos: { x: 640, y: 240 },
        axis: 'x',
        type: 'canvas'
      }
    ];
  }

  private matchAnchors(selfAnchors: Anchor[], otherAnchors: Anchor[]) {
    const dest = selfAnchors.map(a => ({
      anchor: a,
      matches: [] as Anchor[]
    }));

    for (const other of otherAnchors) {
      for (const self of dest) {
        if (other.axis !== self.anchor.axis) continue;

        const oAxis = Axis.orthogonal(other.axis);
        if (Math.abs(other.pos[oAxis] - self.anchor.pos[oAxis]) < this.threshold) {
          self.matches.push(other);
        }
      }
    }

    return dest.filter(a => a.matches.length > 0);
  }

  snap(b: Box): SnapResult {
    // TODO: Maybe we should also snap to the "old" location
    const matchingAnchors = this.matchAnchors(NodeHelper.anchors(b), [
      ...this.getNodeAnchors(b),
      ...this.getCanvasAnchors()
    ]);

    const newBounds = Box.asMutableSnapshot(b);

    // Snap to the closest matching anchor in each direction
    for (const axis of Axis.axises()) {
      const oAxis = Axis.orthogonal(axis);

      // Find anchor with the closest orthogonal distance to the matching anchor
      let currentDistance = Number.MAX_SAFE_INTEGER;
      let closestAnchor: Anchor | undefined = undefined;
      let sourceAnchor: Anchor | undefined = undefined;
      for (const a of matchingAnchors) {
        if (a.anchor.axis !== axis) continue;

        for (const m of a.matches) {
          const d = Math.abs(m.pos[oAxis] - a.anchor.pos[oAxis]);
          if (d < currentDistance) {
            currentDistance = d;
            closestAnchor = m;
            sourceAnchor = a.anchor;
          }
        }
      }

      if (closestAnchor === undefined || sourceAnchor === undefined) continue;

      // TODO: We should be able to express this in a better way
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

    // TODO: Maybe we should adjust the position of the self anchors as well
    //       ... to reduce complexity later on

    // Check for guides in all four directions for each matching anchor
    // ... also draw the guide to the matching anchor that is furthest away
    const guides: Guide[] = [];
    for (const axis of Axis.axises()) {
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

            const oAxis = Axis.orthogonal(axis);

            // Check if the anchor is on the other side of the matching anchor
            if (distance[axis] * dir < 0) continue;

            // Check if the resulting guide is not orto-linear
            if (Math.abs(distance[oAxis]) > 1) continue;

            if (Math.abs(distance[axis]) > matchDistance) {
              match = a;
              matchDistance = Math.abs(distance[axis]);
            }
          }

          if (!match) continue;

          if (match.axis === 'x') {
            // TODO: I wonder if we should modify the selfAnchors instead of
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

    return {
      guides,
      adjusted: newBounds.getSnapshot()
    };
  }
}
