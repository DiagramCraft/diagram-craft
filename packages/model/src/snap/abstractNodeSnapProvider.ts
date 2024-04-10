import { Diagram } from '../diagram';
import { DiagramNode } from '../diagramNode';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils';
import { isNode } from '../diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { Direction } from '@diagram-craft/geometry/direction';
import { Axis } from '@diagram-craft/geometry/axis';
import { Range } from '@diagram-craft/geometry/range';

export abstract class AbstractNodeSnapProvider {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly excludedNodeIds: ReadonlyArray<string>
  ) {}

  protected get(b: Box, dir: Direction) {
    if (dir === 'e' || dir === 'w') {
      return dir === 'e' ? b.x + b.w : b.x;
    } else {
      return dir === 'n' ? b.y : b.y + b.h;
    }
  }

  protected getRange(b: Box, axis: Axis) {
    if (axis === 'h') {
      return Range.of(b.x, b.x + b.w);
    } else {
      return Range.of(b.y, b.y + b.h);
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
      if (node.bounds.r !== 0) continue;

      if (
        Range.overlaps(this.getRange(node.bounds, 'h'), boxHRange) ||
        Range.overlaps(this.getRange(node.bounds, 'v'), boxVRange)
      ) {
        if (this.get(node.bounds, 's') < box.y) {
          result.n.push(node);
        } else if (this.get(node.bounds, 'e') < box.x) {
          result.w.push(node);
        } else if (node.bounds.x > this.get(box, 'e')) {
          result.e.push(node);
        } else if (node.bounds.y > this.get(box, 's')) {
          result.s.push(node);
        } else {
          VERIFY_NOT_REACHED();
        }
      }
    }
    return result;
  }
}
