import { Direction } from '../../geometry/direction.ts';
import { Diagram } from '../diagram.ts';
import { largest, smallest } from '../../utils/array.ts';
import { CanvasSnapProvider } from './canvasSnapProvider.ts';
import { NodeSnapProvider } from './nodeSnapProvider.ts';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider.ts';
import { VerifyNotReached } from '../../utils/assert.ts';
import { Range } from '../../geometry/range.ts';
import { GridSnapProvider } from './gridSnapProvider.ts';
import { NodeSizeSnapProvider } from './nodeSizeSnapProvider.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Line } from '../../geometry/line.ts';
import { Guide } from '../selectionState.ts';
import { Magnet, MagnetOfType, MagnetType } from './magnet.ts';
import { Axis } from '../../geometry/axis.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

type SnapResult = {
  guides: Guide[];
  adjusted: Box;
  magnets: Magnet[];
};

export type MatchingMagnetPair<T extends MagnetType> = {
  self: Magnet;
  matching: MagnetOfType<T>;
  distance: number;
};

export interface SnapProvider<T extends MagnetType> {
  getMagnets(box: Box): MagnetOfType<T>[];
  makeGuide(box: Box, match: MatchingMagnetPair<T>, axis: Axis): Guide | undefined;
  moveMagnet(magnet: MagnetOfType<T>, delta: Point): void;
}

class SourceSnapProvider implements SnapProvider<'source'> {
  getMagnets(_box: Box): MagnetOfType<'source'>[] {
    throw new VerifyNotReached();
  }

  makeGuide(_box: Box, _match: MatchingMagnetPair<'source'>, _axis: Axis): Guide {
    throw new VerifyNotReached();
  }

  moveMagnet(magnet: MagnetOfType<'source'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
  }
}

class SnapProviders {
  private readonly providers: {
    [T in MagnetType]: SnapProvider<T>;
  };

  constructor(diagram: Diagram, excludeNodeIds: string[]) {
    this.providers = {
      grid: new GridSnapProvider(diagram),
      source: new SourceSnapProvider(),
      node: new NodeSnapProvider(diagram, excludeNodeIds),
      distance: new NodeDistanceSnapProvider(diagram, excludeNodeIds),
      size: new NodeSizeSnapProvider(diagram, excludeNodeIds),
      canvas: new CanvasSnapProvider(diagram)
    };
  }

  get<T extends MagnetType>(type: T): SnapProvider<T> {
    return this.providers[type];
  }

  getMagnets(types: MagnetType[], b: Box) {
    return types.flatMap(t => this.get(t).getMagnets(b));
  }
}

const orhogonalLineDistance = (line1: Line, line2: Line, oAxis: 'h' | 'v') =>
  line1.from[Axis.toXY(oAxis)] - line2.from[Axis.toXY(oAxis)];

const rangeOverlap = (a1: Magnet, a2: Magnet) => {
  const axis = Axis.toXY(a1.axis);
  return Range.intersection(
    [a1.line.from[axis], a1.line.to[axis]],
    [a2.line.from[axis], a2.line.to[axis]]
  );
};

const orhogonalDistance = (a1: Magnet, a2: Magnet) => {
  const axis = Axis.toXY(Axis.orthogonal(a1.axis));
  return a1.line.from[axis] - a2.line.from[axis];
};

export class SnapManager {
  // TODO: Ideally we should find a better way to exclude the currently selected node
  //       maybe we can pass in the current selection instead of just the box (bounds)
  constructor(
    private readonly diagram: Diagram,
    private readonly excludeNodeIds: string[] = [],
    private readonly magnetTypes: ReadonlyArray<MagnetType> = [],
    private readonly threshold: number,
    private readonly enabled: boolean
  ) {}

  private matchMagnets(selfMagnets: Magnet[], otherMagnets: Magnet[]): MatchingMagnetPair<any>[] {
    const dest: MatchingMagnetPair<any>[] = [];

    for (const other of otherMagnets) {
      for (const self of selfMagnets) {
        if (other.axis !== self.axis) continue;
        if (other.respectDirection && other.matchDirection !== self.matchDirection) continue;
        if (!rangeOverlap(self, other)) continue;

        const distance = orhogonalDistance(self, other);
        if (Math.abs(distance) > this.threshold) continue;

        dest.push({ self, matching: other, distance });
      }
    }

    return dest;
  }

  // TODO: We should be able to merge snapResize and snapMove
  snapResize(b: Box, directions: Direction[]): SnapResult {
    if (!this.enabled) return { guides: [], magnets: [], adjusted: b };

    const enabledSnapProviders: MagnetType[] = [...this.magnetTypes];
    const snapProviders = new SnapProviders(this.diagram, this.excludeNodeIds);

    const selfMagnets = Magnet.forNode(b, 'source').filter(s =>
      directions.includes(s.matchDirection!)
    );

    const magnetsToMatchAgainst = snapProviders.getMagnets(enabledSnapProviders, b);

    const matchingMagnets = this.matchMagnets(selfMagnets, magnetsToMatchAgainst);

    const newBounds = Box.asMutableSnapshot(b);

    for (const axis of Axis.axises()) {
      // Find magnet with the closest orthogonal distance to the matching magnet line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingMagnets.filter(a => a.self.axis === axis),
        (a, b) => Math.abs(a.distance) - Math.abs(b.distance)
      );

      if (closest === undefined) continue;

      const distance = orhogonalDistance(closest.self, closest.matching);

      if (closest.self.matchDirection === 'n' || closest.self.matchDirection === 'w') {
        newBounds.get('pos')[Axis.toXY(Axis.orthogonal(axis))] -= distance;
        newBounds.get('size')[axis === 'h' ? 'h' : 'w'] += distance;
      } else {
        newBounds.get('size')[axis === 'h' ? 'h' : 'w'] -= distance;
      }
    }

    // Readjust self magnets to the new position - post snapping
    const newMagnets = Magnet.forNode(newBounds.getSnapshot(), 'source');
    selfMagnets.forEach(a => {
      a.line = newMagnets.find(b => b.matchDirection === a.matchDirection)!.line;
    });

    const newB = newBounds.getSnapshot();

    return {
      guides: this.generateGuides(
        newB,
        selfMagnets,
        matchingMagnets,
        snapProviders,
        enabledSnapProviders
      ),
      magnets: [...magnetsToMatchAgainst, ...selfMagnets],
      adjusted: newB
    };
  }

  snapMove(b: Box, directions: Direction[] = ['n', 'w', 'e', 's']): SnapResult {
    if (!this.enabled) return { guides: [], magnets: [], adjusted: b };

    const enabledSnapProviders: MagnetType[] = this.magnetTypes.filter(a => a !== 'size');
    const snapProviders = new SnapProviders(this.diagram, this.excludeNodeIds);

    const magnets = Magnet.forNode(b, 'source').filter(s => directions.includes(s.matchDirection!));

    const magnetsToMatchAgainst = snapProviders.getMagnets(enabledSnapProviders, b);

    const matchingMagnets = this.matchMagnets(magnets, magnetsToMatchAgainst);

    const newBounds = Box.asMutableSnapshot(b);

    // Snap to the closest matching magnet in each direction
    for (const axis of Axis.axises()) {
      // Find magnet with the closest orthogonal distance to the matching magnet line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingMagnets.filter(a => a.self.axis === axis),
        (a, b) => Math.abs(a.distance) - Math.abs(b.distance)
      );

      if (closest === undefined) continue;

      newBounds.get('pos')[Axis.toXY(Axis.orthogonal(axis))] -= orhogonalDistance(
        closest.self,
        closest.matching
      );
    }

    // Readjust self magnets to the new position - post snapping
    for (const a of magnets) {
      snapProviders.get(a.type).moveMagnet(a, Point.subtract(newBounds.get('pos'), b.pos));
    }

    const newB = newBounds.getSnapshot();

    return {
      guides: this.generateGuides(
        newB,
        magnets,
        matchingMagnets,
        snapProviders,
        enabledSnapProviders
      ),
      magnets: [...magnetsToMatchAgainst, ...magnets],
      adjusted: newB
    };
  }

  private generateGuides(
    bounds: Box,
    selfMagnets: Magnet[],
    matchingMagnets: MatchingMagnetPair<any>[],
    snapProviders: SnapProviders,
    enabledSnapProviders: MagnetType[]
  ) {
    // Check for guides in all four directions for each matching magnet
    // ... also draw the guide to the matching magnet that is furthest away
    const guides: Guide[] = [];
    for (const self of selfMagnets) {
      const axis = self.axis;
      const oAxis = Axis.orthogonal(axis);

      const otherMagnetsForMagnet = matchingMagnets.filter(a => a.self === self);
      if (otherMagnetsForMagnet.length === 0) continue;

      // Recalculate distance after snapping
      otherMagnetsForMagnet.forEach(e => {
        e.distance = orhogonalDistance(self, e.matching);
      });

      const match = largest(
        otherMagnetsForMagnet
          // only keep items on the right side of the self magnet
          .filter(e => e.distance >= 0)

          // and remove anything that is close post anspping
          .filter(e => Math.abs(orhogonalLineDistance(e.matching.line, e.self.line, oAxis)) < 1),
        (a, b) =>
          enabledSnapProviders.indexOf(a.matching.type) -
          enabledSnapProviders.indexOf(b.matching.type)
      );

      if (!match) continue;

      const guide = snapProviders.get(match.matching.type).makeGuide(bounds, match, axis);
      if (guide) guides.push(guide);
    }

    // TODO: Remove guides that are too close to each other or redundant (e.g. center if both left and right)

    return guides;
  }

  reviseGuides(guides: Guide[], b: Box): Guide[] {
    return guides.filter(g => {
      if (Line.isHorizontal(g.line)) {
        return g.line.from.y === b.pos.y || g.line.from.y === b.pos.y + b.size.h;
      } else {
        return g.line.from.x === b.pos.x || g.line.from.x === b.pos.x + b.size.w;
      }
    });
  }
}
