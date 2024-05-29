import { AbstractAction, ActionContext } from '../action';
import { Diagram } from '@diagram-craft/model/diagram';
import { ActionMapFactory, State } from '../keyMap';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { TransformFactory } from '@diagram-craft/geometry/transform';

declare global {
  interface ActionMap {
    TABLE_ROW_INSERT_BEFORE: TableInsertAction;
    TABLE_ROW_INSERT_AFTER: TableInsertAction;
    TABLE_ROW_REMOVE: TableRemoveAction;
    TABLE_ROW_DISTRIBUTE: TableDistributeAction;

    TABLE_COLUMN_INSERT_BEFORE: TableInsertAction;
    TABLE_COLUMN_INSERT_AFTER: TableInsertAction;
    TABLE_COLUMN_REMOVE: TableRemoveAction;
    TABLE_COLUMN_DISTRIBUTE: TableDistributeAction;
  }
}

export const tableActions: ActionMapFactory = (state: State) => ({
  TABLE_ROW_INSERT_BEFORE: new TableInsertAction(state.diagram, 'row', -1),
  TABLE_ROW_INSERT_AFTER: new TableInsertAction(state.diagram, 'row', 1),
  TABLE_ROW_REMOVE: new TableRemoveAction(state.diagram, 'row'),
  TABLE_ROW_DISTRIBUTE: new TableDistributeAction(state.diagram, 'row'),
  TABLE_COLUMN_INSERT_BEFORE: new TableInsertAction(state.diagram, 'column', -1),
  TABLE_COLUMN_INSERT_AFTER: new TableInsertAction(state.diagram, 'column', 1),
  TABLE_COLUMN_REMOVE: new TableRemoveAction(state.diagram, 'column'),
  TABLE_COLUMN_DISTRIBUTE: new TableDistributeAction(state.diagram, 'column')
});

const getTableNode = (diagram: Diagram): DiagramNode | undefined => {
  const elements = diagram.selectionState.elements;
  if (elements.length === 1 && isNode(elements[0])) {
    if (elements[0].parent?.nodeType === 'tableRow') return elements[0].parent.parent;
    if (elements[0].nodeType === 'table') return elements[0];
  }
};

const adjustRowHeight = (row: DiagramNode, h: number, uow: UnitOfWork) => {
  const t = TransformFactory.fromTo(row.bounds, { ...row.bounds, h });
  row.transform(t, uow);
};

const adjustColumnWidth = (colIdx: number, table: DiagramNode, w: number, uow: UnitOfWork) => {
  for (const r of table.children) {
    const cell = (r as DiagramNode).children![colIdx];
    const t = TransformFactory.fromTo(cell.bounds, { ...cell.bounds, w });
    cell.transform(t, uow);
  }
};

const getCellRow = (diagram: Diagram): number | undefined => {
  const table = getTableNode(diagram);
  if (!table) return;

  const elements = diagram.selectionState.elements;
  if (elements.length !== 1 || !isNode(elements[0])) return;

  const rows = table.children as DiagramNode[];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].children.includes(elements[0])) return i;
  }
  return undefined;
};

const getCellColumn = (diagram: Diagram): number | undefined => {
  const table = getTableNode(diagram);
  if (!table) return;

  const elements = diagram.selectionState.elements;
  if (elements.length !== 1 || !isNode(elements[0])) return;

  const rows = table.children as DiagramNode[];
  for (let i = 0; i < rows.length; i++) {
    const idx = rows[i].children.indexOf(elements[0]);
    if (idx >= 0) return idx;
  }
  return undefined;
};

export class TableDistributeAction extends AbstractAction {
  constructor(
    private readonly diagram: Diagram,
    private readonly type: 'row' | 'column'
  ) {
    super();
  }

  execute(_context: ActionContext): void {
    const tableElement = getTableNode(this.diagram);
    if (!tableElement) return;

    if (this.type === 'row') {
      const h = tableElement.bounds.h;
      const rows = tableElement.children.filter(
        c => isNode(c) && c.nodeType === 'tableRow'
      ) as DiagramNode[];
      const rowHeight = h / rows.length;

      const uow = new UnitOfWork(this.diagram, true);
      rows.forEach(r => adjustRowHeight(r, rowHeight, uow));
      commitWithUndo(uow, 'Distribute rows');
    } else {
      const w = tableElement.bounds.w;

      const colCount = (tableElement.children[0] as DiagramNode).children.filter(c =>
        isNode(c)
      ).length;

      const columnWidth = w / colCount;

      const uow = new UnitOfWork(this.diagram, true);
      for (let i = 0; i < colCount; i++) {
        adjustColumnWidth(i, tableElement, columnWidth, uow);
      }
      commitWithUndo(uow, 'Distribute columns');
    }
  }
}

export class TableRemoveAction extends AbstractAction {
  constructor(
    private readonly diagram: Diagram,
    private readonly type: 'row' | 'column'
  ) {
    super();

    diagram.selectionState.on('change', () => {
      this.enabled = this.isEnabled({} as ActionContext);
      this.emit('actionchanged', { action: this });
    });

    this.enabled = this.isEnabled({} as ActionContext);
  }

  isEnabled(_context: ActionContext): boolean {
    const elements = this.diagram.selectionState.elements;
    return (
      elements.length === 1 && isNode(elements[0]) && elements[0].parent?.nodeType === 'tableRow'
    );
  }

  execute(_context: ActionContext): void {
    const rowIdx = getCellRow(this.diagram);
    const colIdx = getCellColumn(this.diagram);

    const table = getTableNode(this.diagram);
    if (!table) return;

    if (this.type === 'row') {
      if (rowIdx === undefined) return;

      const uow = new UnitOfWork(this.diagram, true);
      const row = table.children[rowIdx];
      uow.snapshot(row);
      table.removeChild(row, uow);
      row.layer.removeElement(row, uow);
      commitWithUndo(uow, 'Remove row');
    } else {
      if (colIdx === undefined) return;

      const uow = new UnitOfWork(this.diagram, true);
      for (const r of table.children) {
        const cell = (r as DiagramNode).children[colIdx];
        uow.snapshot(cell);
        (r as DiagramNode).removeChild(cell, uow);
        cell.layer.removeElement(cell, uow);
      }
      commitWithUndo(uow, 'Remove column');
    }

    this.diagram.selectionState.clear();
  }
}

export class TableInsertAction extends AbstractAction {
  constructor(
    private readonly diagram: Diagram,
    private readonly type: 'row' | 'column',
    private readonly position: -1 | 1
  ) {
    super();

    diagram.selectionState.on('change', () => {
      this.enabled = this.isEnabled({} as ActionContext);
      this.emit('actionchanged', { action: this });
    });

    this.enabled = this.isEnabled({} as ActionContext);
  }

  isEnabled(_context: ActionContext): boolean {
    const elements = this.diagram.selectionState.elements;
    return (
      elements.length === 1 && isNode(elements[0]) && elements[0].parent?.nodeType === 'tableRow'
    );
  }

  execute(_context: ActionContext): void {
    const rowIdx = getCellRow(this.diagram);
    const colIdx = getCellColumn(this.diagram);

    const table = getTableNode(this.diagram);
    if (!table) return;

    if (this.type === 'row') {
      if (rowIdx === undefined) return;

      const uow = new UnitOfWork(this.diagram, true);
      const newRow = (table.children[rowIdx] as DiagramNode).duplicate();

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
      table.addChild(newRow, uow);
      table.layer.addElement(newRow, uow);

      commitWithUndo(uow, 'Insert row');
    } else {
      if (colIdx === undefined) return;

      const uow = new UnitOfWork(this.diagram, true);

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
        (r as DiagramNode).addChild(newCell, uow);
        table.layer.addElement(newCell, uow);
      }

      commitWithUndo(uow, 'Insert column');
    }
  }
}
