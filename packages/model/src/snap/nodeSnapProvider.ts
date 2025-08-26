import type { Diagram } from '../diagram';
import type { EligibleNodePredicate, MatchingMagnetPair, SnapProvider } from './snapManager';
import { Highlight } from '../selectionState';
import { Magnet, MagnetOfType } from './magnet';
import { isNode } from '../diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { Range } from '@diagram-craft/geometry/range';
import { Axis } from '@diagram-craft/geometry/axis';
import { Line } from '@diagram-craft/geometry/line';
import { Point } from '@diagram-craft/geometry/point';
import { unique } from '@diagram-craft/utils/array';

const N = Infinity;
const minX = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.x, b.x + b.w), N);
const maxX = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.x, b.x + b.w), 0);
const minY = (...bs: Box[]) => bs.reduce((p, b) => Math.min(p, b.y, b.y + b.h), N);
const maxY = (...bs: Box[]) => bs.reduce((p, b) => Math.max(p, b.y, b.y + b.h), 0);

type AnchorWithDistance = [MagnetOfType<'node'>, number];

const compareFn = (a: AnchorWithDistance, b: AnchorWithDistance) => b[1] - a[1];

export class NodeSnapProvider implements SnapProvider<'node'> {
  constructor(
    private readonly diagram: Diagram,
    private readonly eligibleNodePredicate: EligibleNodePredicate
  ) {}

  private getRange(b: Box, axis: Axis) {
    if (axis === 'h') {
      return Range.of(b.x, b.x + b.w);
    } else {
      return Range.of(b.y, b.y + b.h);
    }
  }

  getMagnets(box: Box): MagnetOfType<'node'>[] {
    const dest: { h: AnchorWithDistance[]; v: AnchorWithDistance[] } = { h: [], v: [] };
    const center = Box.center(box);

    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    for (const node of this.diagram.visibleElements()) {
      if (!isNode(node)) continue;
      if (node.isLabelNode()) continue;
      if (!this.eligibleNodePredicate(node.id)) continue;
      for (const other of Magnet.forNode(node.bounds)) {
        // TODO: We should be able to filter out even more here
        //       by considering the direction of the magnet line
        if (
          !Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) &&
          !Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
        ) {
          continue;
        }

        other.type = 'node';
        (other as MagnetOfType<'node'>).node = node;

        if (Line.isHorizontal(other.line)) {
          other.line = Line.of(
            { x: 0, y: other.line.to.y },
            { x: this.diagram.viewBox.dimensions.w, y: other.line.to.y }
          );
          dest.h.push([
            other as MagnetOfType<'node'>,
            Point.squareDistance(center, Box.center(node.bounds))
          ]);
        } else {
          other.line = Line.of(
            { x: other.line.to.x, y: 0 },
            { x: other.line.to.x, y: this.diagram.viewBox.dimensions.h }
          );
          dest.v.push([
            other as MagnetOfType<'node'>,
            Point.squareDistance(center, Box.center(node.bounds))
          ]);
        }
      }
    }

    if (dest.h.length > 1) dest.h = unique(dest.h.sort(compareFn), e => e[0].line.from.y);
    if (dest.v.length > 1) dest.v = unique(dest.v.sort(compareFn), e => e[0].line.from.x);

    return [...dest.h.map(e => e[0]), ...dest.v.map(e => e[0])];
  }

  makeHighlight(box: Box, match: MatchingMagnetPair<'node'>, _axis: Axis): Highlight {
    const mBox = match.matching.node.bounds;
    return {
      line: Line.isHorizontal(match.matching.line)
        ? Line.horizontal(match.matching.line.from.y, [minX(mBox, box), maxX(mBox, box)])
        : Line.vertical(match.matching.line.from.x, [minY(mBox, box), maxY(mBox, box)]),
      matchingMagnet: match.matching,
      selfMagnet: match.self
    };
  }

  moveMagnet(magnet: MagnetOfType<'node'>, delta: Point): void {
    magnet.line = Line.move(magnet.line, delta);
  }

  consolidateHighlights(guides: Highlight[]): Highlight[] {
    return guides;
  }
}
