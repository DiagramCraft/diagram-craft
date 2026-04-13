import { Drag, DragEvents } from '../../dragDropManager';
import { Point } from '@diagram-craft/geometry/point';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import type { UndoCapture } from '@diagram-craft/model/undoManager';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { TableHelper } from './tableUtils';

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
  private readonly capture: UndoCapture;
  private readonly table: TableHelper;
  private readonly originalSize: number;

  constructor(
    private readonly tableNode: DiagramNode,
    private readonly type: DividerType,
    private readonly index: number,
    private readonly initialPoint: Point
  ) {
    super();
    this.capture = this.tableNode.diagram.undoManager.beginCapture(
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
      adjustColumnWidth(this.index, this.table, width, this.capture.uow);
      this.setState({ label: `w: ${width.toFixed(0)}` });
    } else {
      const row = this.table.getRowsSorted()[this.index];
      if (!row) return;

      const height = Math.max(
        MIN_TABLE_DIVIDER_SIZE,
        this.originalSize + (event.offset.y - this.initialPoint.y)
      );
      adjustRowHeight(row, height, this.capture.uow);
      this.setState({ label: `h: ${height.toFixed(0)}` });
    }

    this.tableNode.getDefinition().onChildChanged(this.tableNode, this.capture.uow);

    this.capture.uow.notify();
    this.tableNode.diagram.selection.recalculateBoundingBox();
    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd(): void {
    const selection = this.tableNode.diagram.selection;
    this.capture.commit();

    selection.rebaseline();
    this.emit('dragEnd');
  }

  cancel() {
    this.capture.abort();
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
