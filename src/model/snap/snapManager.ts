import { Box, Direction, Line, Point } from '../../geometry/geometry.ts';
import { Anchor, AnchorOfType, AnchorType, Axis, LoadedDiagram, NodeHelper } from '../diagram.ts';
import { Guide } from '../selectionState.ts';
import { largest, smallest } from '../../utils/array.ts';
import { CanvasSnapProvider } from './canvasSnapProvider.ts';
import { NodeSnapProvider } from './nodeSnapProvider.ts';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider.ts';
import { VerifyNotReached } from '../../utils/assert.ts';
import { Range } from '../../geometry/range.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

type SnapResult = {
  guides: Guide[];
  adjusted: Box;
  anchors: Anchor[];
};

export type MatchingAnchorPair<T extends AnchorType> = {
  self: Anchor;
  matching: AnchorOfType<T>;
  distance: number;
};

export interface SnapProvider<T extends AnchorType> {
  getAnchors(box: Box): Anchor[];
  makeGuide(box: Box, match: MatchingAnchorPair<T>, axis: Axis): Guide | undefined;
  moveAnchor(anchor: AnchorOfType<T>, delta: Point): void;
}

class SourceSnapProvider implements SnapProvider<'source'> {
  getAnchors(_box: Box): Anchor[] {
    throw new VerifyNotReached();
  }

  makeGuide(_box: Box, _match: MatchingAnchorPair<'source'>, _axis: Axis): Guide {
    throw new VerifyNotReached();
  }

  moveAnchor(anchor: AnchorOfType<'source'>, delta: Point): void {
    anchor.line = Line.move(anchor.line, delta);
  }
}

class SnapProviders {
  private readonly providers: {
    [T in AnchorType]: SnapProvider<T>;
  };

  constructor(diagram: LoadedDiagram, excludeNodeIds: string[]) {
    this.providers = {
      source: new SourceSnapProvider(),
      node: new NodeSnapProvider(diagram, excludeNodeIds),
      distance: new NodeDistanceSnapProvider(diagram, excludeNodeIds),
      canvas: new CanvasSnapProvider(diagram)
    };
  }

  get<T extends AnchorType>(type: T): SnapProvider<T> {
    return this.providers[type];
  }

  getAnchors(types: AnchorType[], b: Box) {
    return types.flatMap(t => this.get(t).getAnchors(b));
  }
}

const orhogonalLineDistance = (line1: Line, line2: Line, oAxis: 'h' | 'v') =>
  line1.from[Axis.toXY(oAxis)] - line2.from[Axis.toXY(oAxis)];

export class SnapManager {
  private threshold = 10;

  // TODO: Ideally we should find a better way to exclude the currently selected node
  //       maybe we can pass in the current selection instead of just the box (bounds)
  constructor(
    private readonly diagram: LoadedDiagram,
    private readonly excludeNodeIds: string[] = []
  ) {}

  private rangeOverlap(a1: Anchor, a2: Anchor) {
    const axis = Axis.toXY(a1.axis);
    return Range.intersection(
      [a1.line.from[axis], a1.line.to[axis]],
      [a2.line.from[axis], a2.line.to[axis]]
    );
  }

  private orhogonalDistance(a1: Anchor, a2: Anchor) {
    const axis = Axis.toXY(Axis.orthogonal(a1.axis));
    return a1.line.from[axis] - a2.line.from[axis];
  }

  private matchAnchors(selfAnchors: Anchor[], otherAnchors: Anchor[]): MatchingAnchorPair<any>[] {
    const dest: MatchingAnchorPair<any>[] = [];

    for (const other of otherAnchors) {
      for (const self of selfAnchors) {
        if (other.axis !== self.axis) continue;
        if (other.respectDirection && other.matchDirection !== self.matchDirection) continue;
        if (!this.rangeOverlap(self, other)) continue;

        const distance = this.orhogonalDistance(self, other);
        if (Math.abs(distance) > this.threshold) continue;

        dest.push({ self, matching: other, distance });
      }
    }

    return dest;
  }

  // TODO: We should be able to merge snapResize and snapMove
  snapResize(b: Box, directions: Direction[]): SnapResult {
    const enabledSnapProviders: AnchorType[] = ['node', 'canvas', 'distance'];
    const snapProviders = new SnapProviders(this.diagram, this.excludeNodeIds);

    const selfAnchors = NodeHelper.anchors(b, 'source').filter(s =>
      directions.includes(s.matchDirection!)
    );

    const anchorsToMatchAgainst = snapProviders.getAnchors(enabledSnapProviders, b);

    const matchingAnchors = this.matchAnchors(selfAnchors, anchorsToMatchAgainst);

    const newBounds = Box.asMutableSnapshot(b);

    for (const axis of Axis.axises()) {
      // Find anchor with the closest orthogonal distance to the matching anchor line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingAnchors.filter(a => a.self.axis === axis),
        (a, b) => Math.abs(a.distance) - Math.abs(b.distance)
      );

      if (closest === undefined) continue;

      const distance = this.orhogonalDistance(closest.self, closest.matching);

      if (closest.self.matchDirection === 'n' || closest.self.matchDirection === 'w') {
        newBounds.get('pos')[Axis.toXY(Axis.orthogonal(axis))] -= distance;
        newBounds.get('size')[axis === 'h' ? 'h' : 'w'] += distance;
      } else {
        newBounds.get('size')[axis === 'h' ? 'h' : 'w'] -= distance;
      }
    }

    // Readjust self anchors to the new position - post snapping
    const newAnchors = NodeHelper.anchors(newBounds.getSnapshot(), 'source');
    selfAnchors.forEach(a => {
      a.line = newAnchors.find(b => b.matchDirection === a.matchDirection)!.line;
    });

    const newB = newBounds.getSnapshot();

    return {
      guides: this.generateGuides(
        newB,
        selfAnchors,
        matchingAnchors,
        snapProviders,
        enabledSnapProviders
      ),
      anchors: [...anchorsToMatchAgainst, ...selfAnchors],
      adjusted: newB
    };
  }

  snapMove(b: Box): SnapResult {
    const enabledSnapProviders: AnchorType[] = ['node', 'canvas', 'distance'];
    const snapProviders = new SnapProviders(this.diagram, this.excludeNodeIds);

    const selfAnchors = NodeHelper.anchors(b, 'source');

    const anchorsToMatchAgainst = snapProviders.getAnchors(enabledSnapProviders, b);

    const matchingAnchors = this.matchAnchors(selfAnchors, anchorsToMatchAgainst);

    const newBounds = Box.asMutableSnapshot(b);

    // Snap to the closest matching anchor in each direction
    for (const axis of Axis.axises()) {
      // Find anchor with the closest orthogonal distance to the matching anchor line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingAnchors.filter(a => a.self.axis === axis),
        (a, b) => Math.abs(a.distance) - Math.abs(b.distance)
      );

      if (closest === undefined) continue;

      newBounds.get('pos')[Axis.toXY(Axis.orthogonal(axis))] -= this.orhogonalDistance(
        closest.self,
        closest.matching
      );
    }

    // Readjust self anchors to the new position - post snapping
    for (const a of selfAnchors) {
      snapProviders.get(a.type).moveAnchor(a, Point.subtract(newBounds.get('pos'), b.pos));
    }

    const newB = newBounds.getSnapshot();

    return {
      guides: this.generateGuides(
        newB,
        selfAnchors,
        matchingAnchors,
        snapProviders,
        enabledSnapProviders
      ),
      anchors: [...anchorsToMatchAgainst, ...selfAnchors],
      adjusted: newB
    };
  }

  private generateGuides(
    b: Box,
    selfAnchors: Anchor[],
    matchingAnchors: MatchingAnchorPair<any>[],
    snapProviders: SnapProviders,
    enabledSnapProviders: AnchorType[]
  ) {
    // Check for guides in all four directions for each matching anchor
    // ... also draw the guide to the matching anchor that is furthest away
    const guides: Guide[] = [];
    for (const self of selfAnchors) {
      const axis = self.axis;
      const oAxis = Axis.orthogonal(axis);

      const otherAnchorsForAnchor = matchingAnchors.filter(a => a.self === self);
      if (otherAnchorsForAnchor.length === 0) continue;

      // Recalculate distance after snapping
      otherAnchorsForAnchor.forEach(e => {
        e.distance = this.orhogonalDistance(self, e.matching);
      });

      const match = largest(
        otherAnchorsForAnchor
          // only keep items on the right side of the self anchor
          .filter(e => e.distance >= 0)

          // and remove anything that is close post anspping
          .filter(e => Math.abs(orhogonalLineDistance(e.matching.line, e.self.line, oAxis)) < 1),
        (a, b) =>
          enabledSnapProviders.indexOf(a.matching.type) -
          enabledSnapProviders.indexOf(b.matching.type)
      );

      if (!match) continue;

      const guide = snapProviders.get(match.matching.type).makeGuide(b, match, axis);
      if (guide) guides.push(guide);
    }

    // TODO: Remove guides that are too close to each other or redundant (e.g. center if both left and right)

    return guides;
  }
}
