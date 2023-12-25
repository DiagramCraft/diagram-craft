import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Point } from '../../geometry/point.ts';

export class ShapeControlPointDrag extends AbstractDrag {
  constructor(
    private readonly node: DiagramNode,
    private readonly callback: (x: number, y: number) => string
  ) {
    super();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    const label = this.callback(coord.x, coord.y);
    this.setState({ label });
    this.node.commitChanges();
  }

  onDragEnd(): void {}
}
