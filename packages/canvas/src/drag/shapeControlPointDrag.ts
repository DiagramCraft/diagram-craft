import { AbstractDrag, Modifiers } from '../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

export class ShapeControlPointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;
  constructor(
    private readonly node: DiagramNode,
    private readonly callback: (pos: Point, uow: UnitOfWork) => string
  ) {
    super();
    this.uow = new UnitOfWork(this.node.diagram, true);
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    const label = this.callback(coord, this.uow);
    this.setState({ label });
    this.uow.notify();
  }

  onDragEnd(): void {
    commitWithUndo(this.uow, 'Adjust shape');
  }
}
