import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { Point } from '@diagram-craft/geometry';

export class ShapeControlPointDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;
  constructor(
    private readonly node: DiagramNode,
    private readonly callback: (x: number, y: number, uow: UnitOfWork) => string
  ) {
    super();
    this.uow = new UnitOfWork(this.node.diagram, true);
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    const label = this.callback(coord.x, coord.y, this.uow);
    this.setState({ label });
    this.uow.notify();
  }

  onDragEnd(): void {
    commitWithUndo(this.uow, 'Adjust shape');
  }
}
