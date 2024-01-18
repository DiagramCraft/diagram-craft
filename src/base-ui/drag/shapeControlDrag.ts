import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { Point } from '../../geometry/point.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

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
    const snapshot = this.uow.commit();

    this.node.diagram.undoManager.add(
      new SnapshotUndoableAction('Adjust shape', this.node.diagram, snapshot)
    );
  }
}
