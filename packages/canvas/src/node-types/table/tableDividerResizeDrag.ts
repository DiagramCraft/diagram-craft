import { Drag, DragEvents } from '../../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { TableHelper } from './tableUtils';
import type { Releasable } from '@diagram-craft/utils/releasable';

type DividerType = 'row' | 'column';

const MIN_TABLE_DIVIDER_SIZE = 1;

const adjustRowHeight = (row: DiagramNode, h: number, uow: UnitOfWork) => {
  row.transform(TransformFactory.fromTo(row.bounds, { ...row.bounds, h }), uow);
};

const adjustColumnWidth = (colIdx: number, table: TableHelper, w: number, uow: UnitOfWork) => {
  for (const row of table.rows) {
    const cell = table.getColumnsSorted(row)[colIdx];
    if (!cell) continue;
    cell.transform(TransformFactory.fromTo(cell.bounds, { ...cell.bounds, w }), uow);
  }
};

export class TableDividerResizeDrag extends Drag {
  private readonly uow: UnitOfWork;
  private readonly table: TableHelper;
  private readonly originalSize: number;
  private readonly undoSession: Releasable;

  constructor(
    private readonly tableNode: DiagramNode,
    private readonly type: DividerType,
    private readonly index: number,
    private readonly initialPoint: Point
  ) {
    super();
    this.uow = UnitOfWork.begin(this.tableNode.diagram);
    this.undoSession = this.tableNode.diagram.undoManager.beginUndoableSession(
      this.type === 'column' ? 'Resize table column' : 'Resize table row'
    );
    this.table = new TableHelper(this.tableNode);
    this.originalSize = this.getOriginalSize();
  }

  onDrag(event: DragEvents.DragStart): void {
    if (!this.table.isTable()) return;

    if (this.type === 'column') {
      const row = this.table.getRowsSorted()[0];
      const cell = row ? this.table.getColumnsSorted(row)[this.index] : undefined;
      if (!cell) return;

      const width = Math.max(
        MIN_TABLE_DIVIDER_SIZE,
        this.originalSize + (event.offset.x - this.initialPoint.x)
      );
      adjustColumnWidth(this.index, this.table, width, this.uow);
      this.setState({ label: `w: ${width.toFixed(0)}` });
    } else {
      const row = this.table.getRowsSorted()[this.index];
      if (!row) return;

      const height = Math.max(
        MIN_TABLE_DIVIDER_SIZE,
        this.originalSize + (event.offset.y - this.initialPoint.y)
      );
      adjustRowHeight(row, height, this.uow);
      this.setState({ label: `h: ${height.toFixed(0)}` });
    }

    this.tableNode.getDefinition().onChildChanged(this.tableNode, this.uow);

    this.uow.notify();
    this.tableNode.diagram.selection.recalculateBoundingBox();
    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    const selection = this.tableNode.diagram.selection;
    if (selection.isChanged()) {
      this.uow.commitWithUndo(this.type === 'column' ? 'Resize table column' : 'Resize table row');
    } else {
      this.uow.abort();
    }
    this.undoSession.release();

    selection.rebaseline();
    this.emit('dragEnd');
  }

  cancel() {
    this.uow.abort();
    this.undoSession.release();
  }

  private getOriginalSize() {
    if (!this.table.isTable()) return 0;

    if (this.type === 'column') {
      const row = this.table.getRowsSorted()[0];
      const cell = row ? this.table.getColumnsSorted(row)[this.index] : undefined;
      return cell?.bounds.w ?? 0;
    }

    return this.table.getRowsSorted()[this.index]?.bounds.h ?? 0;
  }
}
