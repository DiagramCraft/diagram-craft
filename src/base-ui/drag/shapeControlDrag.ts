import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Point } from '../../geometry/point.ts';

export class ShapeControlPointDrag extends AbstractDrag {
  constructor(
    private readonly node: DiagramNode,
    private readonly callback: (x: number, y: number) => void
  ) {
    super();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.callback(coord.x, coord.y);
    this.node.commitChanges();
  }

  onDragEnd(): void {}
}
