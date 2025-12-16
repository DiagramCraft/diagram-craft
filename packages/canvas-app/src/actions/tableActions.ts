import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { TableHelper } from '@diagram-craft/canvas/node-types/Table.nodeType';
import { assert } from '@diagram-craft/utils/assert';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof tableActions> {}
  }
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

const adjustRowHeight = (row: DiagramNode, h: number, uow: UnitOfWork) => {
  row.transform(TransformFactory.fromTo(row.bounds, { ...row.bounds, h }), uow);
};

const adjustColumnWidth = (colIdx: number, table: TableHelper, w: number, uow: UnitOfWork) => {
  for (const r of table.rows) {
    const cell = r.children[colIdx]!;
    cell.transform(TransformFactory.fromTo(cell.bounds, { ...cell.bounds, w }), uow);
  }
};

const removeElement = (element: DiagramElement, uow: UnitOfWork) => {
  uow.snapshot(element);
  element.parent!.removeChild(element, uow);
  assertRegularLayer(element.layer);
  element.layer.removeElement(element, uow);
};

const addElement = (
  element: DiagramNode,
  parent: DiagramNode,
  uow: UnitOfWork,
  options?: { ref: DiagramNode; type: 'before' | 'after' }
) => {
  assertRegularLayer(parent.layer);

  uow.snapshot(element);
  parent.addChild(element, uow, options);
  parent.layer.addElement(element, uow);
};

const isTableCriteria = (context: ActionContext) => {
  return ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'change', () => {
    return TableHelper.get(context.model.activeDiagram).isTable();
  });
};

const swapPositions = (
  node1: DiagramNode,
  node2: DiagramNode,
  axis: 'x' | 'y',
  uow: UnitOfWork
) => {
  const t1 = TransformFactory.fromTo(node1.bounds, { ...node1.bounds, [axis]: node2.bounds[axis] });
  const t2 = TransformFactory.fromTo(node2.bounds, { ...node2.bounds, [axis]: node1.bounds[axis] });

  node1.transform(t1, uow);
  node2.transform(t2, uow);
};

export class TableDistributeAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly type: 'row' | 'column',
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
    this.name =
      type === 'row'
        ? $tStr('action.TABLE_ROW_DISTRIBUTE.name', 'Distribute rows')
        : $tStr('action.TABLE_COLUMN_DISTRIBUTE.name', 'Distribute columns');
  }

  getCriteria(context: ActionContext) {
    return [...super.getCriteria(context), isTableCriteria(context)];
  }

  execute(): void {
    const helper = TableHelper.get(this.context.model.activeDiagram);
    const table = helper.tableNode;
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    if (this.type === 'row') {
      const titleSize = table.renderProps.custom.table.title
        ? table.renderProps.custom.table.titleSize
        : 0;
      const availableHeight = table.bounds.h - titleSize;
      const rowHeight = availableHeight / helper.rows.length;

      helper.rows.forEach(r => adjustRowHeight(r, rowHeight, uow));
      commitWithUndo(uow, 'Distribute rows');
    } else {
      const colCount = helper.getColumnCount();
      const columnWidth = table.bounds.w / colCount;

      for (let i = 0; i < colCount; i++) {
        adjustColumnWidth(i, helper, columnWidth, uow);
      }
      commitWithUndo(uow, 'Distribute columns');
    }
  }
}

export class TableRemoveAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly type: 'row' | 'column',
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
    this.name =
      type === 'row'
        ? $tStr('action.TABLE_ROW_REMOVE.name', 'Remove row')
        : $tStr('action.TABLE_COLUMN_REMOVE.name', 'Remove column');
  }

  getCriteria(context: ActionContext) {
    return [...super.getCriteria(context), isTableCriteria(context)];
  }

  execute(): void {
    const helper = TableHelper.get(this.context.model.activeDiagram);
    assert.true(helper.isTable());

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    if (this.type === 'row') {
      const row = helper.getCellRow()!;
      removeElement(row, uow);
      commitWithUndo(uow, 'Remove row');
    } else {
      const colIdx = helper.getCellColumnIndex();
      if (colIdx === undefined) return;

      for (const row of helper.rows) {
        const cell = row.children[colIdx]!;
        removeElement(cell, uow);
      }
      commitWithUndo(uow, 'Remove column');
    }

    this.context.model.activeDiagram.selection.clear();
  }
}

export class TableInsertAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly type: 'row' | 'column',
    private readonly position: -1 | 1,
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
    if (type === 'row') {
      this.name =
        position === -1
          ? $tStr('action.TABLE_ROW_INSERT_BEFORE.name', 'Insert row before')
          : $tStr('action.TABLE_ROW_INSERT_AFTER.name', 'Insert row after');
    } else {
      this.name =
        position === -1
          ? $tStr('action.TABLE_COLUMN_INSERT_BEFORE.name', 'Insert column before')
          : $tStr('action.TABLE_COLUMN_INSERT_AFTER.name', 'Insert column after');
    }
  }

  getCriteria(context: ActionContext) {
    return [...super.getCriteria(context), isTableCriteria(context)];
  }

  execute(): void {
    const helper = TableHelper.get(this.context.model.activeDiagram);
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    if (this.type === 'row') {
      const rowIdx = helper.getCellRowIndex();
      if (rowIdx === undefined) return;

      const rows = helper.getRowsSorted();
      const current = rows[rowIdx]!;
      const newRow = current.duplicate();

      // Shift rows below the insertion point
      const startIdx = rowIdx + (this.position === -1 ? 0 : 1);
      for (let i = startIdx; i < rows.length; i++) {
        const r = rows[i]!;
        const t = TransformFactory.fromTo(r.bounds, {
          ...r.bounds,
          y: r.bounds.y + newRow.bounds.h
        });
        r.transform(t, uow);
      }

      addElement(newRow, helper.tableNode, uow, {
        ref: current,
        type: this.position === -1 ? 'before' : 'after'
      });

      commitWithUndo(uow, 'Insert row');
    } else {
      const colIdx = helper.getCellColumnIndex();
      if (colIdx === undefined) return;

      for (const row of helper.rows) {
        const columns = helper.getColumnsSorted(row);
        const cell = columns[colIdx]!;
        const newCell = cell.duplicate();

        // Shift columns after the insertion point
        const startIdx = colIdx + (this.position === -1 ? 0 : 1);
        for (let i = startIdx; i < columns.length; i++) {
          const c = columns[i]!;
          const t = TransformFactory.fromTo(c.bounds, {
            ...c.bounds,
            x: c.bounds.x + newCell.bounds.w
          });
          c.transform(t, uow);
        }

        addElement(newCell, row, uow, {
          ref: cell,
          type: this.position === -1 ? 'before' : 'after'
        });
      }

      commitWithUndo(uow, 'Insert column');
    }
  }
}

export class TableRowMoveAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly direction: -1 | 1,
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
    this.name =
      direction === -1
        ? $tStr('action.TABLE_ROW_MOVE_UP.name', 'Move row up')
        : $tStr('action.TABLE_ROW_MOVE_DOWN.name', 'Move row down');
  }

  getCriteria(context: ActionContext) {
    const baseCriteria = super.getCriteria(context);

    const check = () => {
      const helper = TableHelper.get(context.model.activeDiagram);
      if (!helper.isTable()) return false;

      const rowIdx = helper.getCellRowIndex();
      if (rowIdx === undefined) return false;

      const targetIdx = rowIdx + this.direction;
      return targetIdx >= 0 && targetIdx < helper.getRowsSorted().length;
    };

    return [
      ...baseCriteria,
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'change', check),
      ActionCriteria.EventTriggered(context.model.activeDiagram, 'diagramChange', check)
    ];
  }

  execute(): void {
    const helper = TableHelper.get(this.context.model.activeDiagram);
    const rowIdx = helper.getCellRowIndex();
    if (rowIdx === undefined) return;

    const rows = helper.getRowsSorted();
    const targetIdx = rowIdx + this.direction;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    const currentRow = rows[rowIdx]!;
    const targetRow = rows[targetIdx]!;

    swapPositions(currentRow, targetRow, 'y', uow);

    // Reorder children - top-most row is last in children array
    helper.tableNode.removeChild(currentRow, uow);
    helper.tableNode.addChild(currentRow, uow, {
      ref: targetRow,
      type: this.direction === -1 ? 'after' : 'before'
    });

    commitWithUndo(uow, this.direction === -1 ? 'Move row up' : 'Move row down');
  }
}

export class TableColumnMoveAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly direction: -1 | 1,
    context: ActionContext
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
    this.name =
      direction === -1
        ? $tStr('action.TABLE_COLUMN_MOVE_LEFT.name', 'Move column left')
        : $tStr('action.TABLE_COLUMN_MOVE_RIGHT.name', 'Move column right');
  }

  getCriteria(context: ActionContext) {
    const baseCriteria = super.getCriteria(context);

    const check = () => {
      const helper = TableHelper.get(context.model.activeDiagram);
      if (!helper.isTable()) return false;

      const colIdx = helper.getCellColumnIndex();
      if (colIdx === undefined) return false;

      const colCount = helper.getColumnCount();
      const targetIdx = colIdx + this.direction;
      return targetIdx >= 0 && targetIdx < colCount;
    };

    return [
      ...baseCriteria,
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'change', check),
      ActionCriteria.EventTriggered(context.model.activeDiagram, 'diagramChange', check)
    ];
  }

  execute(): void {
    const helper = TableHelper.get(this.context.model.activeDiagram);
    const colIdx = helper.getCellColumnIndex();
    if (colIdx === undefined) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    for (const row of helper.rows) {
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
