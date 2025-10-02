import { AbstractAction, ActionContext, ActionCriteria } from '../action';
import { Diagram } from '@diagram-craft/model/diagram';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { assert } from '@diagram-craft/utils/assert';

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

const getTableNode = (diagram: Diagram): DiagramNode | undefined => {
  const elements = diagram.selectionState.elements;
  if (elements.length === 1 && isNode(elements[0])) {
    if (isNode(elements[0].parent) && elements[0].parent?.nodeType === 'tableRow') {
      assert.node(elements[0].parent.parent!);
      assert.true(elements[0].parent.parent.nodeType === 'table');

      return elements[0].parent.parent;
    }
    if (elements[0].nodeType === 'table') return elements[0];
  }
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

const getCellRow = (diagram: Diagram): number | undefined => {
  const table = getTableNode(diagram);
  if (!table) return;

  const elements = diagram.selectionState.elements;
  if (elements.length !== 1 || !isNode(elements[0])) return;

  const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]!.children.includes(elements[0])) return i;
  }
  return undefined;
};

const getCellColumn = (diagram: Diagram): number | undefined => {
  const table = getTableNode(diagram);
  if (!table) return;

  const elements = diagram.selectionState.elements;
  if (elements.length !== 1 || !isNode(elements[0])) return;

  const cell = elements[0];
  const row = cell.parent as DiagramNode;
  if (!row) return undefined;

  const columns = (row.children as DiagramNode[]).toSorted((a, b) => a.bounds.x - b.bounds.x);
  return columns.indexOf(cell);
};

export class TableDistributeAction extends AbstractAction {
  constructor(
    private readonly type: 'row' | 'column',
    context: ActionContext
  ) {
    super(context);
  }

  execute(): void {
    const tableElement = getTableNode(this.context.model.activeDiagram);
    if (!tableElement) return;

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
        const elements = context.model.activeDiagram.selectionState.elements;
        return (
          elements.length === 1 &&
          isNode(elements[0]) &&
          isNode(elements[0].parent) &&
          elements[0].parent?.nodeType === 'tableRow'
        );
      }
    );
  }

  execute(): void {
    const rowIdx = getCellRow(this.context.model.activeDiagram);
    const colIdx = getCellColumn(this.context.model.activeDiagram);

    const table = getTableNode(this.context.model.activeDiagram);
    if (!table) return;

    if (this.type === 'row') {
      if (rowIdx === undefined) return;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      const row = table.children[rowIdx]!;
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
        const elements = context.model.activeDiagram.selectionState.elements;
        return (
          elements.length === 1 &&
          isNode(elements[0]) &&
          isNode(elements[0].parent) &&
          elements[0].parent?.nodeType === 'tableRow'
        );
      }
    );
  }

  execute(): void {
    const rowIdx = getCellRow(this.context.model.activeDiagram);
    const colIdx = getCellColumn(this.context.model.activeDiagram);

    const table = getTableNode(this.context.model.activeDiagram);
    if (!table) return;

    if (this.type === 'row') {
      if (rowIdx === undefined) return;

      const uow = new UnitOfWork(this.context.model.activeDiagram, true);
      const current = table.children[rowIdx] as DiagramNode;
      const newRow = current.duplicate();

      // Shift nodes below
      for (let i = rowIdx + (this.position === -1 ? 0 : 1); i < table.children.length; i++) {
        const r = table.children[i] as DiagramNode;
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
        const cell = (r as DiagramNode).children[colIdx] as DiagramNode;
        const newCell = cell.duplicate();

        // Shift following columns
        for (
          let i = colIdx + (this.position === -1 ? 0 : 1);
          i < (r as DiagramNode).children.length;
          i++
        ) {
          const c = (r as DiagramNode).children[i] as DiagramNode;
          const t = TransformFactory.fromTo(c.bounds, {
            ...c.bounds,
            x: c.bounds.x + newCell.bounds.w
          });
          c.transform(t, uow);
        }

        uow.snapshot(newCell);
        (r as DiagramNode).addChild(newCell, uow, {
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

export class TableRowMoveAction extends AbstractAction {
  constructor(
    private readonly direction: -1 | 1,
    context: ActionContext
  ) {
    super(context);
  }

  getCriteria(context: ActionContext) {
    const checkEnabled = () => {
      const elements = context.model.activeDiagram.selectionState.elements;
      if (
        elements.length !== 1 ||
        !isNode(elements[0]) ||
        !isNode(elements[0].parent) ||
        elements[0].parent?.nodeType !== 'tableRow'
      ) {
        return false;
      }

      const table = getTableNode(context.model.activeDiagram);
      if (!table) return false;

      const rowIdx = getCellRow(context.model.activeDiagram);
      if (rowIdx === undefined) return false;

      const targetIdx = rowIdx + this.direction;
      return targetIdx >= 0 && targetIdx < table.children.length;
    };

    return [
      ActionCriteria.EventTriggered(
        context.model.activeDiagram.selectionState,
        'change',
        checkEnabled
      ),
      ActionCriteria.EventTriggered(context.model.activeDiagram, 'change', checkEnabled)
    ];
  }

  execute(): void {
    const rowIdx = getCellRow(this.context.model.activeDiagram);
    const table = getTableNode(this.context.model.activeDiagram);
    if (!table || rowIdx === undefined) return;

    const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
    const targetIdx = rowIdx + this.direction;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);
    const currentRow = rows[rowIdx]!;
    const targetRow = rows[targetIdx]!;

    // Swap positions
    const currentY = currentRow.bounds.y;
    const targetY = targetRow.bounds.y;

    const t1 = TransformFactory.fromTo(currentRow.bounds, { ...currentRow.bounds, y: targetY });
    const t2 = TransformFactory.fromTo(targetRow.bounds, { ...targetRow.bounds, y: currentY });

    currentRow.transform(t1, uow);
    targetRow.transform(t2, uow);

    // Reorder children - remember that top-most row is last in children array
    table.removeChild(currentRow, uow);
    table.addChild(currentRow, uow, {
      ref: targetRow,
      type: this.direction === -1 ? 'after' : 'before'
    });

    commitWithUndo(uow, this.direction === -1 ? 'Move row up' : 'Move row down');
  }
}

export class TableColumnMoveAction extends AbstractAction {
  constructor(
    private readonly direction: -1 | 1,
    context: ActionContext
  ) {
    super(context);
  }

  getCriteria(context: ActionContext) {
    const checkEnabled = () => {
      const elements = context.model.activeDiagram.selectionState.elements;
      if (
        elements.length !== 1 ||
        !isNode(elements[0]) ||
        !isNode(elements[0].parent) ||
        elements[0].parent?.nodeType !== 'tableRow'
      ) {
        return false;
      }

      const table = getTableNode(context.model.activeDiagram);
      if (!table || table.children.length === 0) {
        return false;
      }

      const colIdx = getCellColumn(context.model.activeDiagram);
      if (colIdx === undefined) {
        return false;
      }

      const colCount = (table.children[0] as DiagramNode).children.length;
      const targetIdx = colIdx + this.direction;
      return targetIdx >= 0 && targetIdx < colCount;
    };

    return [
      ActionCriteria.EventTriggered(
        context.model.activeDiagram.selectionState,
        'change',
        checkEnabled
      ),
      ActionCriteria.EventTriggered(context.model.activeDiagram, 'change', checkEnabled)
    ];
  }

  execute(): void {
    const colIdx = getCellColumn(this.context.model.activeDiagram);
    const table = getTableNode(this.context.model.activeDiagram);
    if (!table || colIdx === undefined) return;

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    // Move column in each row
    for (const r of table.children) {
      const row = r as DiagramNode;
      const columns = (row.children as DiagramNode[]).toSorted((a, b) => a.bounds.x - b.bounds.x);

      const targetIdx = colIdx + this.direction;
      if (targetIdx < 0 || targetIdx >= columns.length) return;

      const currentCell = columns[colIdx]!;
      const targetCell = columns[targetIdx]!;

      // Swap x positions
      const currentX = currentCell.bounds.x;
      const targetX = targetCell.bounds.x;

      const t1 = TransformFactory.fromTo(currentCell.bounds, { ...currentCell.bounds, x: targetX });
      const t2 = TransformFactory.fromTo(targetCell.bounds, { ...targetCell.bounds, x: currentX });

      currentCell.transform(t1, uow);
      targetCell.transform(t2, uow);

      // Reorder children - remember that right-most column is first in children array
      row.removeChild(currentCell, uow);
      row.addChild(currentCell, uow, {
        ref: targetCell,
        type: this.direction === -1 ? 'before' : 'after'
      });
    }

    commitWithUndo(uow, this.direction === -1 ? 'Move column left' : 'Move column right');
  }
}
