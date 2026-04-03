import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { assert } from '@diagram-craft/utils/assert';

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

export const getOwningTableRow = (element: DiagramElement): DiagramNode | undefined => {
  if (!isNode(element)) return undefined;

  if (element.nodeType === 'tableRow') return element;

  const cell = getOwningTableCell(element);
  if (cell) {
    const row = cell.parent;
    if (isNode(row) && row.nodeType === 'tableRow') return row;
  }

  return undefined;
};

export const assertTableRow = (row: DiagramNode) => {
  assert.true(row.nodeType === 'tableRow');
};

export const assertTableCell = (cell: DiagramNode) => {
  assert.true(cell.nodeType === 'tableCell');
};
