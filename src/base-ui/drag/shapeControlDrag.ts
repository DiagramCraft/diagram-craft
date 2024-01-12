import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Point } from '../../geometry/point.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

export class ShapeControlPointDrag extends AbstractDrag {
  constructor(
    private readonly node: DiagramNode,
    private readonly callback: (x: number, y: number, uow: UnitOfWork) => string
  ) {
    super();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    UnitOfWork.execute(this.node.diagram, uow => {
      const label = this.callback(coord.x, coord.y, uow);
      this.setState({ label });
    });
  }

  onDragEnd(): void {}
}
