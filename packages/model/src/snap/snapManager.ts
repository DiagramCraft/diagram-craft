import type { Diagram } from '../diagram';
import { CanvasSnapProvider } from './canvasSnapProvider';
import { NodeSnapProvider } from './nodeSnapProvider';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider';
import { GridSnapProvider } from './gridSnapProvider';
import { NodeSizeSnapProvider } from './nodeSizeSnapProvider';
import { GuidesSnapProvider } from './guidesSnapProvider';
import { Highlight } from '../selectionState';
import { Magnet, MagnetOfType, MagnetType } from './magnet';
import { Axis } from '@diagram-craft/geometry/axis';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';
import { Direction } from '@diagram-craft/geometry/direction';
import { assert, VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import { groupBy, largest, smallest } from '@diagram-craft/utils/array';
import { Angle } from '@diagram-craft/geometry/angle';
import { SnapManagerConfig } from './snapManagerConfig';

/**
 * Result of a snap operation containing visual highlights, adjusted position/geometry, and magnets
 * @template T - The type being snapped (Point, Line, or Box)
 */
type SnapResult<T> = {
  /** Visual highlights to show snap guides/lines to the user */
  highlights: ReadonlyArray<Highlight>;
  /** The adjusted position/geometry after snapping */
  adjusted: T;
  /** All magnets involved in the snap operation */
  magnets: ReadonlyArray<Magnet>;
};

/**
 * Represents a pair of magnets that can snap together
 * @template T - The specific magnet type being matched
 */
export type MatchingMagnetPair<T extends MagnetType> = {
  /** The magnet from the element being moved/resized */
  self: Magnet;
  /** The target magnet that self snaps to */
  matching: MagnetOfType<T>;
  /** Orthogonal distance between the magnets */
  distance: number;
};

/**
 * Interface for providing snap targets of a specific magnet type
 * Each snap provider handles one type of snapping (grid, nodes, guides, etc.)
 * @template T - The specific magnet type this provider handles
 */
export interface SnapProvider<T extends MagnetType> {
  /** Get all magnets of this type that could be snap targets for the given box */
  getMagnets(box: Box): ReadonlyArray<MagnetOfType<T>>;

  /** Create a visual highlight/guide line for a successful snap match */
  highlight(box: Box, match: MatchingMagnetPair<T>, axis: Axis): Highlight | undefined;

  /** Combine multiple highlights into consolidated guide lines */
  filterHighlights(guides: Highlight[]): Highlight[];
}

/**
 * Special snap provider for 'source' magnets - magnets belonging to the element being moved
 * This provider handles updating source magnet positions but doesn't provide snap targets
 */
class SourceSnapProvider implements SnapProvider<'source'> {
  /** Source provider doesn't provide magnets - throws if called */
  getMagnets(_box: Box): ReadonlyArray<MagnetOfType<'source'>> {
    throw new VerifyNotReached();
  }

  /** Source provider doesn't create highlights - throws if called */
  highlight(_box: Box, _match: MatchingMagnetPair<'source'>, _axis: Axis): Highlight {
    throw new VerifyNotReached();
  }

  filterHighlights(guides: Highlight[]): Highlight[] {
    return guides;
  }
}

/**
 * Predicate function to determine which nodes are eligible for snapping
 * Used to exclude nodes being moved/resized from being snap targets for themselves
 */
export type EligibleNodePredicate = (nodeId: string) => boolean;

/**
 * Registry of all snap providers, indexed by magnet type
 * Manages the different types of snapping available (grid, nodes, guides, etc.)
 */
class SnapProviders {
  readonly #providers: {
    [T in MagnetType]: SnapProvider<T>;
  };

  /**
   * Initialize all snap providers for a diagram
   * @param diagram - The diagram containing elements to snap to
   * @param eligibleNodePredicate - Function to filter which nodes can be snap targets
   */
  constructor(diagram: Diagram, eligibleNodePredicate: EligibleNodePredicate) {
    this.#providers = {
      grid: new GridSnapProvider(diagram),
      guide: new GuidesSnapProvider(diagram),
      source: new SourceSnapProvider(),
      node: new NodeSnapProvider(diagram, eligibleNodePredicate),
      distance: new NodeDistanceSnapProvider(diagram, eligibleNodePredicate),
      size: new NodeSizeSnapProvider(diagram, eligibleNodePredicate),
      canvas: new CanvasSnapProvider(diagram)
    };
  }

  /** Get the snap provider for a specific magnet type */
  get<T extends MagnetType>(type: T): SnapProvider<T> {
    return this.#providers[type];
  }

  /** Get all magnets from the specified provider types for the given box */
  getMagnets(types: ReadonlyArray<MagnetType>, b: Box) {
    return types.flatMap(t => this.get(t).getMagnets(b));
  }
}

/**
 * Check if two magnets have overlapping ranges along their axis
 * Two magnets can only snap if their lines overlap when projected onto their shared axis
 * @returns Range intersection or undefined if no overlap
 */
const rangeOverlap = (a1: Magnet, a2: Magnet) => {
  const axis = Axis.toXY(a1.axis);
  return Range.intersection(
    [a1.line.from[axis], a1.line.to[axis]],
    [a2.line.from[axis], a2.line.to[axis]]
  );
};

/**
 * Calculate the orthogonal distance between two magnets
 * This is the actual snapping distance - how far to move to align the magnets
 */
const orthogonalDistance = (a1: Magnet, a2: Magnet) => {
  const axis = Axis.toXY(Axis.orthogonal(a1.axis));
  return a1.line.from[axis] - a2.line.from[axis];
};

/**
 * Main class responsible for performing snap operations on diagram elements
 *
 * The SnapManager handles snapping of points, lines, and boxes to various targets:
 * - Grid lines
 * - Other nodes (edges, centers)
 * - Guide lines
 * - Canvas boundaries
 * - Equal distances between nodes
 * - Equal sizes between nodes
 *
 * It uses a magnet-based system where each element has magnetic lines that can
 * attract to other magnetic lines within a threshold distance.
 */
export class SnapManager {
  private readonly magnetTypes: ReadonlyArray<MagnetType>;
  private readonly threshold: number;
  private readonly enabled: boolean;

  /**
   * Create a new SnapManager
   * @param diagram - The diagram containing elements to snap to
   * @param eligibleNodePredicate - Function to filter which nodes can be snap targets (defaults to all)
   * @param config - Configuration specifying enabled magnet types, threshold, and enabled state
   */
  constructor(
    private readonly diagram: Diagram,
    private readonly eligibleNodePredicate: EligibleNodePredicate = () => true,
    config: SnapManagerConfig
  ) {
    this.magnetTypes = config.magnetTypes;
    this.threshold = config.threshold;
    this.enabled = config.enabled;
  }

  /**
   * Find all possible magnet pairs that can snap together
   * Magnets can snap if they:
   * - Are on the same axis (both horizontal or both vertical)
   * - Have matching directions (if direction is respected)
   * - Have overlapping ranges along their axis
   * - Are within the snap threshold distance
   */
  private matchMagnets(
    sourceMagnets: ReadonlyArray<Magnet>,
    magnetsToMatchAgainst: ReadonlyArray<Magnet>
  ): ReadonlyArray<MatchingMagnetPair<MagnetType>> {
    const dest: Array<MatchingMagnetPair<MagnetType>> = [];

    for (const other of magnetsToMatchAgainst) {
      for (const self of sourceMagnets) {
        if (other.axis !== self.axis) continue;
        if (other.respectDirection && other.matchDirection !== self.matchDirection) continue;
        /*if (!rangeOverlap(self, other)) {
          VERIFY_NOT_REACHED();
        }*/

        const distance = orthogonalDistance(self, other);
        if (Math.abs(distance) > this.threshold) continue;

        dest.push({ self, matching: other, distance });
      }
    }

    return dest;
  }

  /**
   * Snap a point. Only snapping to grid
   */
  snapPoint(p: Point): SnapResult<Point> {
    if (!this.enabled || !this.magnetTypes.includes('grid')) {
      return { highlights: [], magnets: [], adjusted: p };
    }

    return {
      highlights: [],
      magnets: [],
      adjusted: GridSnapProvider.snapPoint(p, this.diagram.props.grid?.size ?? 10)
    };
  }

  /**
   * Snap a horizontal or vertical line to nodes or grid
   * Used for drawing straight lines that should align with existing elements
   */
  snapOrthoLinearLine(line: Line): SnapResult<Line> {
    assert.true(Line.isHorizontal(line) || Line.isVertical(line));

    if (!this.enabled) return { highlights: [], magnets: [], adjusted: line };

    if (this.magnetTypes.includes('node')) {
      const snapProviders = new SnapProviders(this.diagram, this.eligibleNodePredicate);
      const magnets = snapProviders.get('node').getMagnets(Box.fromLine(line));

      const matchingMagnets = this.matchMagnets(
        [{ type: 'source', line, axis: Line.isHorizontal(line) ? Axis.h : Axis.v }],
        magnets
      );

      if (matchingMagnets.length > 0) {
        const [m] = matchingMagnets;
        return {
          highlights: [],
          magnets: [],
          adjusted: Line.isHorizontal(line)
            ? Line.horizontal(m.matching.line.from.y, Range.of(line.from.x, line.to.x))
            : Line.vertical(m.matching.line.from.x, Range.of(line.from.y, line.to.y))
        };
      }
    }

    if (this.magnetTypes.includes('grid')) {
      const p = Line.isHorizontal(line) ? Point.of(0, line.from.y) : Point.of(line.from.x, 0);
      const snappedPoint = GridSnapProvider.snapPoint(p, this.diagram.props.grid?.size ?? 10);

      if (!Point.isEqual(p, snappedPoint)) {
        return {
          highlights: [],
          magnets: [],
          adjusted: Line.isHorizontal(line)
            ? Line.horizontal(snappedPoint.y, Range.of(line.from.x, line.to.x))
            : Line.vertical(snappedPoint.x, Range.of(line.from.y, line.to.y))
        };
      }
    }

    return { highlights: [], magnets: [], adjusted: line };
  }

  /**
   * Snap rotation angles to 5-degree increments
   * Helps align rotated elements to common angles
   */
  snapRotate(b: Box): SnapResult<Box> {
    if (!this.enabled) return { highlights: [], magnets: [], adjusted: b };

    const newBounds = Box.asReadWrite(b);

    const roundTo = 5;

    const angle = Angle.toDeg(b.r);
    if (angle % roundTo !== 0) {
      newBounds.r = Angle.toRad(Math.round(Angle.toDeg(b.r) / roundTo) * roundTo);
    }

    return { highlights: [], magnets: [], adjusted: WritableBox.asBox(newBounds) };
  }

  /**
   * Snap element edges while resizing
   * Only the edges in the specified directions will be snapped
   * @param b - The box being resized
   * @param directions - Which edges are being moved (e.g. ['e', 's'] for bottom-right corner)
   * TODO: We should be able to merge snapResize and snapMove
   */
  snapResize(b: Box, directions: ReadonlyArray<Direction>): SnapResult<Box> {
    if (!this.enabled) return { highlights: [], magnets: [], adjusted: b };

    const enabledSnapProviders = [...this.magnetTypes];
    const snapProviders = new SnapProviders(this.diagram, this.eligibleNodePredicate);

    const sourceMagnets = Magnet.forNode(b).filter(s => directions.includes(s.matchDirection!));

    const magnetsToMatchAgainst = snapProviders.getMagnets(enabledSnapProviders, b);

    const matchingMagnets = this.matchMagnets(sourceMagnets, magnetsToMatchAgainst);

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
    const newMagnets = Magnet.forNode(WritableBox.asBox(newBounds));
    sourceMagnets.forEach(a => {
      a.line = newMagnets.find(b => b.matchDirection === a.matchDirection)!.line;
    });

    return {
      highlights: this.generateHighlights(
        WritableBox.asBox(newBounds),
        sourceMagnets,
        matchingMagnets,
        snapProviders,
        enabledSnapProviders
      ),
      magnets: [...magnetsToMatchAgainst, ...sourceMagnets],
      adjusted: WritableBox.asBox(newBounds)
    };
  }

  /**
   * Snap element while moving
   * Can snap any edge of the element, with center snapping enabled for all-direction moves
   * @param b - The box being moved
   * @param directions - Which directions to consider for snapping (defaults to all)
   */
  snapMove(b: Box, directions: ReadonlyArray<Direction> = ['n', 'w', 'e', 's']): SnapResult<Box> {
    if (!this.enabled) return { highlights: [], magnets: [], adjusted: b };

    const enabledSnapProviders: ReadonlyArray<MagnetType> = this.magnetTypes.filter(
      a => a !== 'size'
    );
    const snapProviders = new SnapProviders(this.diagram, this.eligibleNodePredicate);

    const isAllDirections = directions.length === 4;
    const magnets = Magnet.forNode(b).filter(
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

      newBounds[Axis.toXY(Axis.orthogonal(axis))] -= orthogonalDistance(
        closest.self,
        closest.matching
      );
    }

    // Readjust self magnets to the new position - post snapping
    for (const a of magnets) {
      Magnet.move(a, Point.subtract(newBounds, b));
    }

    return {
      highlights: this.generateHighlights(
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

  /**
   * Generate visual highlights for successful snap matches
   * Creates highlights showing where elements have snapped to
   * @param bounds - The final bounds after snapping
   * @param selfMagnets - Magnets from the element being moved
   * @param matchingMagnets - All successful magnet matches
   * @param snapProviders - Provider registry for creating highlights
   * @param enabledSnapProviders - Which provider types are enabled
   */
  private generateHighlights(
    bounds: Box,
    selfMagnets: ReadonlyArray<Magnet>,
    matchingMagnets: ReadonlyArray<MatchingMagnetPair<MagnetType>>,
    snapProviders: SnapProviders,
    enabledSnapProviders: ReadonlyArray<MagnetType>
  ) {
    // Check for guides in all four directions for each matching magnet
    // ... also draw the guide to the matching magnet that is furthest away
    const guides: Highlight[] = [];
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
          .filter(e => Math.abs(Line.orthogonalDistance(e.matching.line, e.self.line, oAxis)) < 1),
        (a, b) =>
          enabledSnapProviders.indexOf(a.matching.type) -
          enabledSnapProviders.indexOf(b.matching.type)
      );

      if (!match) continue;

      const guide = snapProviders.get(match.matching.type).highlight(bounds, match, axis);
      if (guide) guides.push(guide);
    }

    // TODO: Remove guides that are too close to each other or redundant (e.g. center if both left and right)

    // Consolidate guides
    const consolidatedGuides: Highlight[] = [];
    const groupedGuides = groupBy(guides, g => g.matchingMagnet.type);
    for (const [type, guidesOfType] of groupedGuides) {
      const snapProvider = snapProviders.get(type);
      consolidatedGuides.push(...snapProvider.filterHighlights(guidesOfType));
    }

    return consolidatedGuides;
  }

  /**
   * Filter highlights to only show those that align with the current box edges
   * Used to update highlights when an element's position changes during interaction
   */
  reviseHighlights(guides: ReadonlyArray<Highlight>, b: Box): ReadonlyArray<Highlight> {
    return guides.filter(g => {
      if (Line.isHorizontal(g.line)) {
        return g.line.from.y === b.y || g.line.from.y === b.y + b.h;
      } else {
        return g.line.from.x === b.x || g.line.from.x === b.x + b.w;
      }
    });
  }
}
