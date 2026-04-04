import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import type { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { assert } from '@diagram-craft/utils/assert';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

declare global {
  namespace DiagramCraft {
    interface UnitOfWorkMetadata {
      // TODO: This is a coarse UOW-scoped guard for re-entrant table sync.
      //       If unrelated table updates ever happen synchronously in the same call stack,
      //       this may suppress more than intended. Consider narrowing this to specific
      //       cell or table ids if that becomes a real issue.
      inTableSyncOperation?: boolean;
    }
  }
}

export const getOwningTable = (element: DiagramElement): DiagramNode | undefined => {
  if (!isNode(element)) return undefined;

  if (element.nodeType === 'table') return element;

  if (element.nodeType === 'tableRow') {
    const parent = element.parent;
    if (isNode(parent) && parent.nodeType === 'table') return parent;
    return undefined;
  }

  if (element.nodeType === 'tableCell') {
    const row = element.parent;
    const table = isNode(row) ? row.parent : undefined;
    if (isNode(row) && row.nodeType === 'tableRow' && isNode(table) && table.nodeType === 'table') {
      return table;
    }
  }

  return undefined;
};

export const getOwningTableCell = (element: DiagramElement): DiagramNode | undefined => {
  if (!isNode(element)) return undefined;
  if (element.nodeType === 'tableCell') return element;
  return undefined;
};

export const assertTableRow = (row: DiagramNode) => {
  assert.true(row.nodeType === 'tableRow');
};

export const assertTableCell = (cell: DiagramNode) => {
  assert.true(cell.nodeType === 'tableCell');
};

export const setBoundsAndTransformChildren = (
  node: DiagramNode,
  bounds: Box,
  uow: UnitOfWork,
  opts?: { inTableSyncOperation?: boolean }
) => {
  if (Box.isEqual(node.bounds, bounds)) return;

  const previousBounds = node.bounds;
  const transforms = TransformFactory.fromTo(previousBounds, bounds);
  node.setBounds(bounds, uow);

  if (transforms.length === 0) return;

  const previousInTableSyncOperation = uow.metadata.inTableSyncOperation;
  if (opts?.inTableSyncOperation) {
    uow.metadata.inTableSyncOperation = true;
  }

  try {
    node.getDefinition().onTransform(transforms, node, bounds, previousBounds, uow);
  } finally {
    uow.metadata.inTableSyncOperation = previousInTableSyncOperation;
  }
};

export type TableDividerBand = {
  id: string;
  type: 'row' | 'column';
  index: number;
  bounds: Box;
};

export const getTableRowsSorted = (table: DiagramNode): DiagramNode[] => {
  return (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
};

export const getTableColumnsSorted = (row: DiagramNode): DiagramNode[] => {
  return (row.children as DiagramNode[]).toSorted((a, b) => a.bounds.x - b.bounds.x);
};

export const getTableDividerBands = (
  table: DiagramNode,
  bandSize: number
): TableDividerBand[] => {
  if (table.nodeType !== 'table') return [];

  const rows = getTableRowsSorted(table);
  if (rows.length === 0) return [];

  const bandOffset = bandSize / 2;
  const dividerBands: TableDividerBand[] = [];

  const firstRowColumns = getTableColumnsSorted(rows[0]!);
  for (let i = 0; i < firstRowColumns.length - 1; i++) {
    const cell = firstRowColumns[i]!;
    dividerBands.push({
      id: `column-${i}`,
      type: 'column',
      index: i,
      bounds: {
        x: cell.bounds.x + cell.bounds.w - bandOffset,
        y: table.bounds.y,
        w: bandSize,
        h: table.bounds.h,
        r: 0
      }
    });
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i]!;
    dividerBands.push({
      id: `row-${i}`,
      type: 'row',
      index: i,
      bounds: {
        x: table.bounds.x,
        y: row.bounds.y + row.bounds.h - bandOffset,
        w: table.bounds.w,
        h: bandSize,
        r: 0
      }
    });
  }

  return dividerBands;
};

export class TableHelper {
  readonly #tableNode: DiagramNode | undefined;
  readonly cell: DiagramNode | undefined;

  constructor(readonly element: DiagramElement) {
    this.#tableNode = getOwningTable(element);
    this.cell = this.#tableNode ? getOwningTableCell(element) : undefined;
  }

  static get(diagram: Diagram) {
    return new TableHelper(diagram.selection.elements[0]!);
  }

  get tableNode() {
    assert.present(this.#tableNode);
    return this.#tableNode;
  }

  isTable() {
    return !!this.#tableNode;
  }

  get rows() {
    return this.tableNode.children.filter(isNode);
  }

  getCurrentCell() {
    return this.cell;
  }

  getCellRow() {
    return this.rows[this.getCellRowIndex()!];
  }

  getCellRowIndex(): number | undefined {
    if (!this.#tableNode) return;

    const rows = getTableRowsSorted(this.#tableNode);
    for (let i = 0; i < rows.length; i++) {
      if (this.cell && rows[i]!.children.includes(this.cell)) return i;
    }
    return undefined;
  }

  getCellColumnIndex(): number | undefined {
    if (!this.#tableNode || !this.cell) return;

    const row = this.cell.parent as DiagramNode;
    if (!row) return undefined;

    return getTableColumnsSorted(row).indexOf(this.cell);
  }

  getRowsSorted(): DiagramNode[] {
    if (!this.#tableNode) return [];
    return getTableRowsSorted(this.#tableNode);
  }

  getColumnsSorted(row: DiagramNode): DiagramNode[] {
    return getTableColumnsSorted(row);
  }

  getCurrentRow(): DiagramNode | undefined {
    const rowIdx = this.getCellRowIndex();
    if (rowIdx === undefined) return undefined;
    return this.getRowsSorted()[rowIdx];
  }

  getColumnCount(): number {
    if (!this.#tableNode || this.#tableNode.children.length === 0) return 0;
    return (this.#tableNode.children[0] as DiagramNode).children.length;
  }
}
