import { AbstractAction, ActionContext, ActionCriteria } from '../action';
import { Diagram } from '@diagram-craft/model/diagram';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { TableHelper } from '../node-types/Table.nodeType';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';

declare global {
  interface ActionMap extends ReturnType<typeof tableActions> {}
}

export const tableActions = (context: ActionContext) => ({
  TABLE_ROW_INSERT_BEFORE: new TableInsertAction('row', -1, context),
  TABLE_ROW_INSERT_AFTER: new TableInsertAction('row', 1, context),
  TABLE_ROW_REMOVE: new TableRemoveAction('row', context),
  TABLE_ROW_DISTRIBUTE: new TableDistributeAction('row', context),
  TABLE_ROW_MOVE_UP: new TableRowMoveAction(-1, context),
  TABLE_ROW_MOVE_DOWN: new TableRowMoveAction(1, context),
  TABLE_COLUMN_INSERT_BEFORE: new TableInsertAction('column', -1, context),
  TABLE_COLUMN_INSERT_AFTER: new TableInsertAction('column', 1, context),
  TABLE_COLUMN_REMOVE: new TableRemoveAction('column', context),
  TABLE_COLUMN_DISTRIBUTE: new TableDistributeAction('column', context),
  TABLE_COLUMN_MOVE_LEFT: new TableColumnMoveAction(-1, context),
  TABLE_COLUMN_MOVE_RIGHT: new TableColumnMoveAction(1, context)
});

const getTableHelper = (diagram: Diagram): TableHelper => {
  return new TableHelper(diagram.selectionState.elements[0]!);
};

const adjustRowHeight = (row: DiagramNode, h: number, uow: UnitOfWork) => {
  const t = TransformFactory.fromTo(row.bounds, { ...row.bounds, h });
  row.transform(t, uow);
};

const adjustColumnWidth = (colIdx: number, table: DiagramNode, w: number, uow: UnitOfWork) => {
  for (const r of table.children) {
    const cell = (r as DiagramNode).children[colIdx]!;
    const t = TransformFactory.fromTo(cell.bounds, { ...cell.bounds, w });
    cell.transform(t, uow);
  }
};

const swapPositions = (
  node1: DiagramNode,
  node2: DiagramNode,
  axis: 'x' | 'y',
  uow: UnitOfWork
) => {
  const coord1 = node1.bounds[axis];
  const coord2 = node2.bounds[axis];

  const t1 = TransformFactory.fromTo(node1.bounds, { ...node1.bounds, [axis]: coord2 });
  const t2 = TransformFactory.fromTo(node2.bounds, { ...node2.bounds, [axis]: coord1 });

  node1.transform(t1, uow);
  node2.transform(t2, uow);
};

export class TableDistributeAction extends AbstractAction {
  constructor(
    private readonly type: 'row' | 'column',
    context: ActionContext
  ) {
    super(context);
  }

  execute(): void {
    const helper = getTableHelper(this.context.model.activeDiagram);

    const tableElement = helper.tableNode;

    if (this.type === 'row') {
      const h =
        tableElement.bounds.h -
        (tableElement.renderProps.custom.table.title
          ? tableElement.renderProps.custom.table.titleSize
          : 0);
      const rows = tableElement.children.filter(
        c => isNode(c) && c.nodeType === 'tableRow'
      ) as DiagramNode[];
      const rowHeight = h / rows.length;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      rows.forEach(r => adjustRowHeight(r, rowHeight, uow));
      commitWithUndo(uow, 'Distribute rows');
    } else {
      const w = tableElement.bounds.w;

      const colCount = (tableElement.children[0] as DiagramNode).children.filter(c =>
        isNode(c)
      ).length;

      const columnWidth = w / colCount;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      for (let i = 0; i < colCount; i++) {
        adjustColumnWidth(i, tableElement, columnWidth, uow);
      }
      commitWithUndo(uow, 'Distribute columns');
    }
  }
}

export class TableRemoveAction extends AbstractAction {
  constructor(
    private readonly type: 'row' | 'column',
    context: ActionContext
  ) {
    super(context);
  }

  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.selectionState,
      'change',
      () => {
        const helper = getTableHelper(context.model.activeDiagram);
        return helper?.isTable() ?? false;
      }
    );
  }

  execute(): void {
    const helper = getTableHelper(this.context.model.activeDiagram);
    if (!helper?.tableNode) return;

    const rowIdx = helper.getCellRow();
    const colIdx = helper.getCellColumn();
    const table = helper.tableNode;

    if (this.type === 'row') {
      if (rowIdx === undefined) return;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      const row = helper.getRowsSorted()[rowIdx]!;
      uow.snapshot(row);
      table.removeChild(row, uow);
      assertRegularLayer(row.layer);
      row.layer.removeElement(row, uow);
      commitWithUndo(uow, 'Remove row');
    } else {
      if (colIdx === undefined) return;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      for (const r of table.children) {
        const cell = (r as DiagramNode).children[colIdx]!;
        uow.snapshot(cell);
        (r as DiagramNode).removeChild(cell, uow);
        assertRegularLayer(cell.layer);
        cell.layer.removeElement(cell, uow);
      }
      commitWithUndo(uow, 'Remove column');
    }

    this.context.model.activeDiagram.selectionState.clear();
  }
}

export class TableInsertAction extends AbstractAction {
  constructor(
    private readonly type: 'row' | 'column',
    private readonly position: -1 | 1,
    context: ActionContext
  ) {
    super(context);
  }

  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram.selectionState,
      'change',
      () => {
        const helper = getTableHelper(context.model.activeDiagram);
        return helper?.isTable() ?? false;
      }
    );
  }

  execute(): void {
    const helper = getTableHelper(this.context.model.activeDiagram);

    const rowIdx = helper.getCellRow();
    const colIdx = helper.getCellColumn();
    const table = helper.tableNode;

    if (this.type === 'row') {
      if (rowIdx === undefined) return;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      const rows = helper.getRowsSorted();
      const current = rows[rowIdx]!;
      const newRow = current.duplicate();

      // Shift nodes below
      for (let i = rowIdx + (this.position === -1 ? 0 : 1); i < rows.length; i++) {
        const r = rows[i]!;
        const t = TransformFactory.fromTo(r.bounds, {
          ...r.bounds,
          y: r.bounds.y + newRow.bounds.h
        });
        r.transform(t, uow);
      }

      uow.snapshot(newRow);
      table.addChild(newRow, uow, {
        ref: current,
        type: this.position === -1 ? 'before' : 'after'
      });
      assertRegularLayer(table.layer);
      table.layer.addElement(newRow, uow);

      commitWithUndo(uow, 'Insert row');
    } else {
      if (colIdx === undefined) return;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);

      for (const r of table.children) {
        const row = r as DiagramNode;
        const columns = helper.getColumnsSorted(row);
        const cell = columns[colIdx]!;
        const newCell = cell.duplicate();

        // Shift following columns
        for (let i = colIdx + (this.position === -1 ? 0 : 1); i < columns.length; i++) {
          const c = columns[i]!;
          const t = TransformFactory.fromTo(c.bounds, {
            ...c.bounds,
            x: c.bounds.x + newCell.bounds.w
          });
          c.transform(t, uow);
        }

        uow.snapshot(newCell);
        row.addChild(newCell, uow, {
          ref: cell,
          type: this.position === -1 ? 'before' : 'after'
        });
        assertRegularLayer(table.layer);
        table.layer.addElement(newCell, uow);
      }

      commitWithUndo(uow, 'Insert column');
    }
  }
}

export class TableRowMoveAction extends AbstractSelectionAction {
  constructor(
    private readonly direction: -1 | 1,
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: ActionContext) {
    const baseCriteria = super.getCriteria(context);

    const check = () => {
      const helper = getTableHelper(context.model.activeDiagram);
      if (!helper.isTable()) return false;

      const rowIdx = helper.getCellRow();
      if (rowIdx === undefined) return false;

      const targetIdx = rowIdx + this.direction;
      return targetIdx >= 0 && targetIdx < helper.getRowsSorted().length;
    };

    return [
      ...baseCriteria,
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'change', check),
      ActionCriteria.EventTriggered(context.model.activeDiagram, 'change', check)
    ];
  }

  execute(): void {
    const helper = getTableHelper(this.context.model.activeDiagram);
    const table = helper.tableNode;
    const rowIdx = helper.getCellRow();
    if (rowIdx === undefined) return;

    const rows = helper.getRowsSorted();
    const targetIdx = rowIdx + this.direction;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    const currentRow = rows[rowIdx]!;
    const targetRow = rows[targetIdx]!;

    swapPositions(currentRow, targetRow, 'y', uow);

    // Reorder children - top-most row is last in children array
    table.removeChild(currentRow, uow);
    table.addChild(currentRow, uow, {
      ref: targetRow,
      type: this.direction === -1 ? 'after' : 'before'
    });

    commitWithUndo(uow, this.direction === -1 ? 'Move row up' : 'Move row down');
  }
}

export class TableColumnMoveAction extends AbstractSelectionAction {
  constructor(
    private readonly direction: -1 | 1,
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: ActionContext) {
    const baseCriteria = super.getCriteria(context);

    const check = () => {
      const helper = getTableHelper(context.model.activeDiagram);
      if (!helper.isTable()) return false;

      const colIdx = helper.getCellColumn();
      if (colIdx === undefined) return false;

      const colCount = helper.getColumnCount();
      const targetIdx = colIdx + this.direction;
      return targetIdx >= 0 && targetIdx < colCount;
    };

    return [
      ...baseCriteria,
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'change', check),
      ActionCriteria.EventTriggered(context.model.activeDiagram, 'change', check)
    ];
  }

  execute(): void {
    const helper = getTableHelper(this.context.model.activeDiagram);
    const table = helper.tableNode;
    const colIdx = helper.getCellColumn();
    if (colIdx === undefined) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    for (const r of table.children) {
      const row = r as DiagramNode;
      const columns = helper.getColumnsSorted(row);

      const targetIdx = colIdx + this.direction;
      if (targetIdx < 0 || targetIdx >= columns.length) return;

      const currentCell = columns[colIdx]!;
      const targetCell = columns[targetIdx]!;

      swapPositions(currentCell, targetCell, 'x', uow);

      // Reorder children - right-most column is first in children array
      row.removeChild(currentCell, uow);
      row.addChild(currentCell, uow, {
        ref: targetCell,
        type: this.direction === -1 ? 'before' : 'after'
      });
    }

    commitWithUndo(uow, this.direction === -1 ? 'Move column left' : 'Move column right');
  }
}
