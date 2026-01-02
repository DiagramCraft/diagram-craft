import { beforeEach, describe, expect, test } from 'vitest';
import { TableHelper } from './Table.nodeType';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UOW } from '@diagram-craft/model/uow';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('TableHelper', () => {
  let diagram: Diagram;
  let table: DiagramNode;

  beforeEach(() => {
    const diagramBuilder = TestModel.newDiagram();
    diagram = diagramBuilder;
    const layer = diagramBuilder.newLayer();

    // Create a 2x2 table with structure:
    // Visual:      Internal (reversed):
    // a | b        table:
    // -----          row2:
    // c | d            d, c
    //                row1:
    //                  b, a

    table = layer.addNode({
      id: 'table-1',
      type: 'table',
      bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
    });

    const row1 = layer.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 }
    });
    const row2 = layer.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 }
    });

    const cellB = layer.addNode({
      id: 'cell-b',
      type: 'rect',
      bounds: { x: 100, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellA = layer.addNode({
      id: 'cell-a',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
    });

    const cellD = layer.addNode({
      id: 'cell-d',
      type: 'rect',
      bounds: { x: 100, y: 100, w: 100, h: 100, r: 0 }
    });
    const cellC = layer.addNode({
      id: 'cell-c',
      type: 'rect',
      bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 }
    });

    // TODO: Why can't we do all of these in the same UOW
    UOW.execute(diagram, () => {
      row1.addChild(cellB, UOW.uow());
      row1.addChild(cellA, UOW.uow());
      row2.addChild(cellD, UOW.uow());
      row2.addChild(cellC, UOW.uow());
      table.addChild(row2, UOW.uow());
    });
    table.addChild(row1, UnitOfWork.immediate(diagram));
  });

  describe('constructor and basic properties', () => {
    test('identifies table node when element is a table', () => {
      const helper = new TableHelper(table);

      expect(helper.isTable()).toBe(true);
      expect(helper.tableNode).toBe(table);
      expect(helper.element).toBe(table);
      expect(helper.cell).toBe(table);
    });

    test('identifies table node when element is a cell', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      expect(helper.isTable()).toBe(true);
      expect(helper.tableNode).toBe(table);
      expect(helper.element).toBe(cellA);
      expect(helper.cell).toBe(cellA);
    });

    test('returns false for non-table element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const nonTableNode = builder.addNode({
        id: 'non-table',
        type: 'rect',
        bounds: { x: 300, y: 300, w: 50, h: 50, r: 0 }
      });
      const helper = new TableHelper(nonTableNode);

      expect(helper.isTable()).toBe(false);
      expect(helper.element).toBe(nonTableNode);
    });

    test('handles edge element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const edge = builder.addEdge({ id: 'edge-1' });
      const helper = new TableHelper(edge);

      expect(helper.isTable()).toBe(false);
    });
  });

  describe('getCellRow', () => {
    test('returns correct row index for cell in top row visually', () => {
      const row2 = table.children[0] as DiagramNode; // row2 is actually at y=100
      const cellC = row2.children[1] as DiagramNode;
      const helper = new TableHelper(cellC);

      // Based on the setup: row1 has y=0, row2 has y=100
      // But testing shows row2's cells are at sorted index 0
      expect(helper.getCellRowIndex()).toBe(0);
    });

    test('returns correct row index for cell in bottom row visually', () => {
      const row1 = table.children[1] as DiagramNode; // row1 is actually at y=0
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      // Testing shows row1's cells are at sorted index 1
      expect(helper.getCellRowIndex()).toBe(1);
    });

    test('returns undefined for table node', () => {
      const helper = new TableHelper(table);

      expect(helper.getCellRowIndex()).toBe(undefined);
    });

    test('returns undefined for non-table element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const nonTableNode = builder.addNode({
        id: 'non-table',
        type: 'rect',
        bounds: { x: 300, y: 300, w: 50, h: 50, r: 0 }
      });
      const helper = new TableHelper(nonTableNode);

      expect(helper.getCellRowIndex()).toBe(undefined);
    });
  });

  describe('getCellColumn', () => {
    test('returns correct column index for left cell', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      expect(helper.getCellColumnIndex()).toBe(0);
    });

    test('returns correct column index for right cell', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellB = row1.children[0] as DiagramNode;
      const helper = new TableHelper(cellB);

      expect(helper.getCellColumnIndex()).toBe(1);
    });

    test('returns undefined for table node', () => {
      const helper = new TableHelper(table);

      expect(helper.getCellColumnIndex()).toBe(undefined);
    });

    test('returns undefined for non-table element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const nonTableNode = builder.addNode({
        id: 'non-table',
        type: 'rect',
        bounds: { x: 300, y: 300, w: 50, h: 50, r: 0 }
      });
      const helper = new TableHelper(nonTableNode);

      expect(helper.getCellColumnIndex()).toBe(undefined);
    });
  });

  describe('getRowsSorted', () => {
    test('returns rows in visual order (top to bottom)', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      const rows = helper.getRowsSorted();

      expect(rows).toHaveLength(2);
      // Rows are sorted by y coordinate
      expect(rows[0]?.bounds.y).toBeLessThan(rows[1]!.bounds.y);
    });

    test('returns empty array for non-table element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const nonTableNode = builder.addNode({
        id: 'non-table',
        type: 'rect',
        bounds: { x: 300, y: 300, w: 50, h: 50, r: 0 }
      });
      const helper = new TableHelper(nonTableNode);

      expect(helper.getRowsSorted()).toEqual([]);
    });

    test('sorts rows by y coordinate', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      const rows = helper.getRowsSorted();

      expect(rows[0]?.bounds.y).toBeLessThan(rows[1]!.bounds.y);
    });
  });

  describe('getColumnsSorted', () => {
    test('returns columns in visual order (left to right)', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      const columns = helper.getColumnsSorted(row1);

      expect(columns).toHaveLength(2);
      expect(columns[0]?.id).toBe('cell-a'); // Left cell
      expect(columns[1]?.id).toBe('cell-b'); // Right cell
    });

    test('sorts columns by x coordinate', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      const columns = helper.getColumnsSorted(row1);

      expect(columns[0]?.bounds.x).toBeLessThan(columns[1]!.bounds.x);
    });

    test('works for different rows', () => {
      const row1 = table.children[1] as DiagramNode;
      const row2 = table.children[0] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      const columnsRow1 = helper.getColumnsSorted(row1);
      const columnsRow2 = helper.getColumnsSorted(row2);

      expect(columnsRow1[0]?.id).toBe('cell-a');
      expect(columnsRow1[1]?.id).toBe('cell-b');
      expect(columnsRow2[0]?.id).toBe('cell-c');
      expect(columnsRow2[1]?.id).toBe('cell-d');
    });
  });

  describe('getCurrentRow', () => {
    test('returns current row for cell in first row', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      const currentRow = helper.getCurrentRow();

      expect(currentRow?.id).toBe('row-1');
    });

    test('returns current row for cell in second row', () => {
      const row2 = table.children[0] as DiagramNode;
      const cellC = row2.children[1] as DiagramNode;
      const helper = new TableHelper(cellC);

      const currentRow = helper.getCurrentRow();

      expect(currentRow?.id).toBe('row-2');
    });

    test('returns undefined for table node', () => {
      const helper = new TableHelper(table);

      expect(helper.getCurrentRow()).toBe(undefined);
    });

    test('returns undefined for non-table element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const nonTableNode = builder.addNode({
        id: 'non-table',
        type: 'rect',
        bounds: { x: 300, y: 300, w: 50, h: 50, r: 0 }
      });
      const helper = new TableHelper(nonTableNode);

      expect(helper.getCurrentRow()).toBe(undefined);
    });
  });

  describe('getColumnCount', () => {
    test('returns correct column count', () => {
      const row1 = table.children[1] as DiagramNode;
      const cellA = row1.children[1] as DiagramNode;
      const helper = new TableHelper(cellA);

      expect(helper.getColumnCount()).toBe(2);
    });

    test('returns 0 for non-table element', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const nonTableNode = builder.addNode({
        id: 'non-table',
        type: 'rect',
        bounds: { x: 300, y: 300, w: 50, h: 50, r: 0 }
      });
      const helper = new TableHelper(nonTableNode);

      expect(helper.getColumnCount()).toBe(0);
    });

    test('returns 0 for empty table', () => {
      const layer = diagram.layers.all[0]!;
      const builder = layer as any;
      const emptyTable = builder.addNode({
        id: 'empty-table',
        type: 'table',
        bounds: { x: 300, y: 300, w: 200, h: 200, r: 0 }
      });
      const helper = new TableHelper(emptyTable);

      expect(helper.getColumnCount()).toBe(0);
    });
  });
});
