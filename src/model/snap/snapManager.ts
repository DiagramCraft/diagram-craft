import { Box, Point } from '../../geometry/geometry.ts';
import { Anchor, AnchorOfType, AnchorType, Axis, LoadedDiagram, NodeHelper } from '../diagram.ts';
import { Guide } from '../selectionState.ts';
import { largest, smallest } from '../../utils/array.ts';
import { CanvasSnapProvider } from './canvasSnapProvider.ts';
import { NodeSnapProvider } from './nodeSnapProvider.ts';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider.ts';
import { VerifyNotReached } from '../../utils/assert.ts';

type SnapResult = {
  guides: Guide[];
  adjusted: Box;
  anchors: Anchor[];
};

export type MatchingAnchorPair<T extends AnchorType> = {
  self: Anchor;
  matching: AnchorOfType<T>;
};

export interface SnapProvider<T extends AnchorType> {
  getAnchors(box: Box): Anchor[];
  makeGuide(box: Box, match: MatchingAnchorPair<T>, axis: Axis): Guide;
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
    anchor.pos = Point.add(anchor.pos, delta);
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
      canvas: new CanvasSnapProvider()
    };
  }

  get<T extends AnchorType>(type: T): SnapProvider<T> {
    return this.providers[type];
  }
}

export class SnapManager {
  private threshold = 10;

  constructor(private readonly diagram: LoadedDiagram) {}

  private matchAnchors(selfAnchors: Anchor[], otherAnchors: Anchor[]): MatchingAnchorPair<any>[] {
    const dest: MatchingAnchorPair<any>[] = [];

    for (const other of otherAnchors) {
      for (const self of selfAnchors) {
        if (other.axis !== self.axis) continue;

        if (
          other.matchDirection &&
          other.respectDirection &&
          other.matchDirection !== self.matchDirection
        )
          continue;

        const oAxis = Axis.orthogonal(other.axis);
        if (Math.abs(other.pos[oAxis] - self.pos[oAxis]) < this.threshold) {
          dest.push({ self, matching: other });
        }
      }
    }

    return dest;
  }

  // TODO: Ideally we should find a better way to exclude the currently selected node
  //       maybe we can pass in the current selection instead of just the box (bounds)
  snap(b: Box, excludeNodeIds: string[] = []): SnapResult {
    const selfAnchors = NodeHelper.anchors(b, 'node');

    const snapProviders = new SnapProviders(this.diagram, excludeNodeIds);
    const enabledSnapProviders: AnchorType[] = ['node', 'distance', 'canvas'];

    const anchorsToMatchAgainst = enabledSnapProviders
      .map(e => snapProviders.get(e))
      .flatMap(e => e.getAnchors(b));

    const matchingAnchors = this.matchAnchors(selfAnchors, anchorsToMatchAgainst);

    const newBounds = Box.asMutableSnapshot(b);

    // Snap to the closest matching anchor in each direction
    for (const axis of Axis.axises()) {
      const oAxis = Axis.orthogonal(axis);

      // Find anchor with the closest orthogonal distance to the matching anchor line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingAnchors.filter(a => a.self.axis === axis),
        (a, b) =>
          Math.abs(a.matching.pos[oAxis] - a.self.pos[oAxis]) -
          Math.abs(b.matching.pos[oAxis] - b.self.pos[oAxis])
      );

      if (closest === undefined) continue;

      // TODO: This calculation can be simplified
      newBounds.get('pos')[oAxis] = Point.add(
        newBounds.get('pos'),
        Point.subtract(closest.matching.pos, closest.self.pos)
      )[oAxis];
    }

    // Readjust self anchors to the new position - post snapping
    for (const a of selfAnchors) {
      snapProviders.get(a.type).moveAnchor(a, Point.subtract(newBounds.get('pos'), b.pos));
    }

    const newB = newBounds.getSnapshot();

    // Check for guides in all four directions for each matching anchor
    // ... also draw the guide to the matching anchor that is furthest away
    const guides: Guide[] = [];
    for (const self of selfAnchors) {
      const axis = self.axis;
      const oAxis = Axis.orthogonal(axis);

      const otherAnchorsForAnchor = matchingAnchors.filter(a => a.self === self);
      if (otherAnchorsForAnchor.length === 0) continue;

      for (const dir of [-1, 1]) {
        const match = largest(
          otherAnchorsForAnchor
            .map(anchor => ({
              anchor,
              distance: Point.subtract(self.pos, anchor.matching.pos)
            }))

            // only keep items on the right side of the self anchor
            .filter(e => e.distance[axis] * dir >= 0)

            // and remove anything that is not ortho-linear
            .filter(e => Math.abs(e.distance[oAxis]) < 1),
          (a, b) => {
            const d = Math.abs(a.distance[axis]) - Math.abs(b.distance[axis]);
            if (d !== 0) return Math.abs(a.distance[axis]) - Math.abs(b.distance[axis]);

            if (a.anchor.matching.type === 'distance') return -1;
            if (b.anchor.matching.type === 'distance') return 1;
            return 0;
          }
        );

        if (!match) continue;

        // Special case if distance is zero, we need to check that we don't create duplicates
        if (match.distance[axis] === 0) {
          const existing = guides.find(
            g => g.matchingAnchor === match.anchor.matching && g.selfAnchor === match.anchor.self
          );
          if (existing) continue;
        }

        guides.push(
          snapProviders.get(match.anchor.matching.type).makeGuide(newB, match.anchor, axis)
        );
      }
    }

    // TODO: Remove guides that are too close to each other or redundant (e.g. center if both left and right)

    return {
      guides,
      anchors: anchorsToMatchAgainst,
      adjusted: newB
    };
  }
}
