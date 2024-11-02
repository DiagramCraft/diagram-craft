import { Diagram } from '../diagram';
import { CanvasSnapProvider } from './canvasSnapProvider';
import { NodeSnapProvider } from './nodeSnapProvider';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider';
import { GridSnapProvider } from './gridSnapProvider';
import { NodeSizeSnapProvider } from './nodeSizeSnapProvider';
import { Guide } from '../selectionState';
import { Magnet, MagnetOfType, MagnetType } from './magnet';
import { Axis } from '@diagram-craft/geometry/axis';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';
import { Direction } from '@diagram-craft/geometry/direction';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { largest, smallest } from '@diagram-craft/utils/array';
import { Angle } from '@diagram-craft/geometry/angle';
import { SnapManagerConfig } from './snapManagerConfig';

type SnapResult<T> = {
  guides: ReadonlyArray<Guide>;
  adjusted: T;
  magnets: ReadonlyArray<Magnet>;
};

export type MatchingMagnetPair<T extends MagnetType> = {
  self: Magnet;
  matching: MagnetOfType<T>;
  distance: number;
};

export interface SnapProvider<T extends MagnetType> {
  getMagnets(box: Box): ReadonlyArray<MagnetOfType<T>>;
  makeGuide(box: Box, match: MatchingMagnetPair<T>, axis: Axis): Guide | undefined;
  moveMagnet(magnet: MagnetOfType<T>, delta: Point): void;
}

class SourceSnapProvider implements SnapProvider<'source'> {
  getMagnets(_box: Box): ReadonlyArray<MagnetOfType<'source'>> {
    throw new VerifyNotReached();
  }

  makeGuide(_box: Box, _match: MatchingMagnetPair<'source'>, _axis: Axis): Guide {
    throw new VerifyNotReached();
  }

  moveMagnet(magnet: MagnetOfType<'source'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
  }
}

export type EligibleNodePredicate = (nodeId: string) => boolean;

class SnapProviders {
  readonly #providers: {
    [T in MagnetType]: SnapProvider<T>;
  };

  constructor(diagram: Diagram, eligibleNodePredicate: EligibleNodePredicate) {
    this.#providers = {
      grid: new GridSnapProvider(diagram),
      source: new SourceSnapProvider(),
      node: new NodeSnapProvider(diagram, eligibleNodePredicate),
      distance: new NodeDistanceSnapProvider(diagram, eligibleNodePredicate),
      size: new NodeSizeSnapProvider(diagram, eligibleNodePredicate),
      canvas: new CanvasSnapProvider(diagram)
    };
  }

  get<T extends MagnetType>(type: T): SnapProvider<T> {
    return this.#providers[type];
  }

  getMagnets(types: ReadonlyArray<MagnetType>, b: Box) {
    return types.flatMap(t => this.get(t).getMagnets(b));
  }
}

const orthogonalLineDistance = (line1: Line, line2: Line, oAxis: Axis) =>
  line1.from[Axis.toXY(oAxis)] - line2.from[Axis.toXY(oAxis)];

const rangeOverlap = (a1: Magnet, a2: Magnet) => {
  const axis = Axis.toXY(a1.axis);
  return Range.intersection(
    [a1.line.from[axis], a1.line.to[axis]],
    [a2.line.from[axis], a2.line.to[axis]]
  );
};

const orthogonalDistance = (a1: Magnet, a2: Magnet) => {
  const axis = Axis.toXY(Axis.orthogonal(a1.axis));
  return a1.line.from[axis] - a2.line.from[axis];
};

export class SnapManager {
  private readonly magnetTypes: ReadonlyArray<MagnetType>;
  private readonly threshold: number;
  private readonly enabled: boolean;

  constructor(
    private readonly diagram: Diagram,
    private readonly eligibleNodePredicate: EligibleNodePredicate = () => true,
    config: SnapManagerConfig
  ) {
    this.magnetTypes = config.magnetTypes;
    this.threshold = config.threshold;
    this.enabled = config.enabled;
  }

  private matchMagnets(
    selfMagnets: ReadonlyArray<Magnet>,
    otherMagnets: ReadonlyArray<Magnet>
  ): ReadonlyArray<MatchingMagnetPair<MagnetType>> {
    const dest: MatchingMagnetPair<MagnetType>[] = [];

    for (const other of otherMagnets) {
      for (const self of selfMagnets) {
        if (other.axis !== self.axis) continue;
        if (other.respectDirection && other.matchDirection !== self.matchDirection) continue;
        if (!rangeOverlap(self, other)) continue;

        const distance = orthogonalDistance(self, other);
        if (Math.abs(distance) > this.threshold) continue;

        dest.push({ self, matching: other, distance });
      }
    }

    return dest;
  }

  snapPoint(p: Point): SnapResult<Point> {
    if (!this.enabled) return { guides: [], magnets: [], adjusted: p };
    if (!this.magnetTypes.find(a => a === 'grid')) return { guides: [], magnets: [], adjusted: p };

    return {
      guides: [],
      magnets: [],
      adjusted: GridSnapProvider.snapPoint(p, this.diagram.props.grid?.size ?? 10)
    };
  }

  snapRotate(b: Box): SnapResult<Box> {
    if (!this.enabled) return { guides: [], magnets: [], adjusted: b };

    const newBounds = Box.asReadWrite(b);

    const roundTo = 5;

    const angle = Angle.toDeg(b.r);
    if (angle % roundTo !== 0) {
      newBounds.r = Angle.toRad(Math.round(Angle.toDeg(b.r) / roundTo) * roundTo);
    }

    return { guides: [], magnets: [], adjusted: WritableBox.asBox(newBounds) };
  }

  // TODO: We should be able to merge snapResize and snapMove
  snapResize(b: Box, directions: ReadonlyArray<Direction>): SnapResult<Box> {
    if (!this.enabled) return { guides: [], magnets: [], adjusted: b };

    const enabledSnapProviders: ReadonlyArray<MagnetType> = [...this.magnetTypes];
    const snapProviders = new SnapProviders(this.diagram, this.eligibleNodePredicate);

    const selfMagnets = Magnet.forNode(b, 'source').filter(s =>
      directions.includes(s.matchDirection!)
    );

    const magnetsToMatchAgainst = snapProviders.getMagnets(enabledSnapProviders, b);

    const matchingMagnets = this.matchMagnets(selfMagnets, magnetsToMatchAgainst);

    const newBounds = Box.asReadWrite(b);

    for (const axis of Axis.axises()) {
      // Find magnet with the closest orthogonal distance to the matching magnet line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingMagnets.filter(a => a.self.axis === axis),
        (a, b) => Math.abs(a.distance) - Math.abs(b.distance)
      );

      if (closest === undefined) continue;

      const distance = orthogonalDistance(closest.self, closest.matching);

      if (closest.self.matchDirection === 'n' || closest.self.matchDirection === 'w') {
        newBounds[Axis.toXY(Axis.orthogonal(axis))] -= distance;
        newBounds[axis === Axis.h ? 'h' : 'w'] += distance;
      } else {
        newBounds[axis === Axis.h ? 'h' : 'w'] -= distance;
      }
    }

    // Readjust self magnets to the new position - post snapping
    const newMagnets = Magnet.forNode(WritableBox.asBox(newBounds), 'source');
    selfMagnets.forEach(a => {
      a.line = newMagnets.find(b => b.matchDirection === a.matchDirection)!.line;
    });

    return {
      guides: this.generateGuides(
        WritableBox.asBox(newBounds),
        selfMagnets,
        matchingMagnets,
        snapProviders,
        enabledSnapProviders
      ),
      magnets: [...magnetsToMatchAgainst, ...selfMagnets],
      adjusted: WritableBox.asBox(newBounds)
    };
  }

  snapMove(b: Box, directions: ReadonlyArray<Direction> = ['n', 'w', 'e', 's']): SnapResult<Box> {
    if (!this.enabled) return { guides: [], magnets: [], adjusted: b };

    const enabledSnapProviders: ReadonlyArray<MagnetType> = this.magnetTypes.filter(
      a => a !== 'size'
    );
    const snapProviders = new SnapProviders(this.diagram, this.eligibleNodePredicate);

    const isAllDirections = directions.length === 4;
    const magnets = Magnet.forNode(b, 'source').filter(
      s =>
        directions.includes(s.matchDirection!) ||
        (isAllDirections && s.matchDirection === undefined)
    );

    const magnetsToMatchAgainst = snapProviders.getMagnets(enabledSnapProviders, b);

    const matchingMagnets = this.matchMagnets(magnets, magnetsToMatchAgainst);

    const newBounds = Box.asReadWrite(b);

    // Snap to the closest matching magnet in each direction
    for (const axis of Axis.axises()) {
      // Find magnet with the closest orthogonal distance to the matching magnet line
      // i.e. optimize for snapping the least distance
      const closest = smallest(
        matchingMagnets.filter(a => a.self.axis === axis),
        (a, b) => Math.abs(a.distance) - Math.abs(b.distance)
      );

      if (closest === undefined) continue;

      newBounds[Axis.toXY(Axis.orthogonal(axis)) === 'x' ? 'x' : 'y'] -= orthogonalDistance(
        closest.self,
        closest.matching
      );
    }

    // Readjust self magnets to the new position - post snapping
    for (const a of magnets) {
      snapProviders.get(a.type).moveMagnet(a, Point.subtract(newBounds, b));
    }

    return {
      guides: this.generateGuides(
        WritableBox.asBox(newBounds),
        magnets,
        matchingMagnets,
        snapProviders,
        enabledSnapProviders
      ),
      magnets: [...magnetsToMatchAgainst, ...magnets],
      adjusted: WritableBox.asBox(newBounds)
    };
  }

  private generateGuides(
    bounds: Box,
    selfMagnets: ReadonlyArray<Magnet>,
    matchingMagnets: ReadonlyArray<MatchingMagnetPair<MagnetType>>,
    snapProviders: SnapProviders,
    enabledSnapProviders: ReadonlyArray<MagnetType>
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
        e.distance = orthogonalDistance(self, e.matching);
      });

      const match = largest(
        otherMagnetsForMagnet
          // only keep items on the right side of the self magnet
          .filter(e => e.distance >= 0)

          // and remove anything that is close post snapping
          .filter(e => Math.abs(orthogonalLineDistance(e.matching.line, e.self.line, oAxis)) < 1),
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

  reviseGuides(guides: ReadonlyArray<Guide>, b: Box): ReadonlyArray<Guide> {
    return guides.filter(g => {
      if (Line.isHorizontal(g.line)) {
        return g.line.from.y === b.y || g.line.from.y === b.y + b.h;
      } else {
        return g.line.from.x === b.x || g.line.from.x === b.x + b.w;
      }
    });
  }
}
