import { Diagram } from '../diagram.ts';
import { Box } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { Axis } from '../../geometry/axis.ts';
import { Range } from '../../geometry/range.ts';
import { DiagramNode } from '../diagramNode.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { isNode } from '../diagramElement.ts';

export abstract class AbstractNodeSnapProvider {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly excludedNodeIds: ReadonlyArray<string>
  ) {}

  protected get(b: Box, dir: Direction) {
    if (dir === 'e' || dir === 'w') {
      return dir === 'e' ? b.pos.x + b.size.w : b.pos.x;
    } else {
      return dir === 'n' ? b.pos.y : b.pos.y + b.size.h;
    }
  }

  protected getRange(b: Box, axis: Axis) {
    if (axis === 'h') {
      return Range.of(b.pos.x, b.pos.x + b.size.w);
    } else {
      return Range.of(b.pos.y, b.pos.y + b.size.h);
    }
  }

  protected getViableNodes(box: Box) {
    const boxHRange = this.getRange(box, 'h');
    const boxVRange = this.getRange(box, 'v');

    const result: Record<Direction, Array<DiagramNode>> = {
      n: [],
      w: [],
      e: [],
      s: []
    };

    for (const node of this.diagram.visibleElements()) {
      if (!isNode(node)) continue;
      if (node.props.labelForEdgeId) continue;
      if (this.excludedNodeIds.includes(node.id)) continue;
      if (Box.intersects(node.bounds, box)) continue;
      if (node.bounds.rotation !== 0) continue;

      if (
        Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) ||
        Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
      ) {
        if (this.get(node.bounds, 's') < box.pos.y) {
          result.n.push(node);
        } else if (this.get(node.bounds, 'e') < box.pos.x) {
          result.w.push(node);
        } else if (node.bounds.pos.x > this.get(box, 'e')) {
          result.e.push(node);
        } else if (node.bounds.pos.y > this.get(box, 's')) {
          result.s.push(node);
        } else {
          VERIFY_NOT_REACHED();
        }
      }
    }
    return result;
  }
}
