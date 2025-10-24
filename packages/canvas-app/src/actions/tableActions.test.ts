import { describe, expect, test, beforeEach } from 'vitest';
import {
  TableRowMoveAction,
  TableColumnMoveAction,
  TableInsertAction,
  TableRemoveAction,
  TableDistributeAction
} from './tableActions';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ActionContext } from '@diagram-craft/canvas/action';
import { TestModel } from '@diagram-craft/model/test-support/builder';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('TableRowMoveAction', () => {
  let diagram: Diagram;
  let table: DiagramNode;
  let context: ActionContext;

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

    // Create table node
    table = layer.addNode({
      id: 'table-1',
      type: 'table',
      bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
    });

    // Create row 1 (top row visually, but last in children)
    const row1 = layer.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 }
    });

    // Create row 2 (bottom row visually, but first in children)
    const row2 = layer.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 }
    });

    // Create cells for row 1 (rightmost first)
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

    // Create cells for row 2 (rightmost first)
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

    // Build hierarchy (reverse order)
    const uow = UnitOfWork.immediate(diagram);
    row1.addChild(cellB, uow);
    row1.addChild(cellA, uow);
    row2.addChild(cellD, uow);
    row2.addChild(cellC, uow);
    table.addChild(row2, uow);
    table.addChild(row1, uow);

    context = {
      model: {
        activeDiagram: diagram,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;
  });

  test('moves top row down', () => {
    const row1 = table.children[1] as DiagramNode;
    const row2 = table.children[0] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableRowMoveAction(1, context);
    action.execute();

    // After moving down, row1 should have y=100 and row2 should have y=0
    expect(row1.bounds.y).toBe(100);
    expect(row2.bounds.y).toBe(0);

    // Check children order: row2 should now be last (visually top)
    const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
    expect(rows[0]?.id).toBe('row-2');
    expect(rows[1]?.id).toBe('row-1');
  });

  test('moves bottom row up', () => {
    const row1 = table.children[1] as DiagramNode;
    const row2 = table.children[0] as DiagramNode;
    const cellC = row2.children[1] as DiagramNode;

    diagram.selection.setElements([cellC]);

    const action = new TableRowMoveAction(-1, context);
    action.execute();

    // After moving up, row2 should have y=0 and row1 should have y=100
    expect(row2.bounds.y).toBe(0);
    expect(row1.bounds.y).toBe(100);

    // Check children order: row2 should now be last (visually top)
    const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
    expect(rows[0]?.id).toBe('row-2');
    expect(rows[1]?.id).toBe('row-1');
  });
});

describe('TableColumnMoveAction', () => {
  let diagram: Diagram;
  let table: DiagramNode;
  let context: ActionContext;

  beforeEach(() => {
    const diagramBuilder = TestModel.newDiagram();
    diagram = diagramBuilder;
    const layer = diagramBuilder.newLayer();

    // Create a 2x2 table
    table = layer.addNode({
      id: 'table-1',
      type: 'table',
      bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
    });

    // Create row 1 (top row)
    const row1 = layer.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 }
    });

    // Create row 2 (bottom row)
    const row2 = layer.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 }
    });

    // Create cells for row 1 (rightmost first)
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

    // Create cells for row 2 (rightmost first)
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

    // Build hierarchy (reverse order)
    const uow = UnitOfWork.immediate(diagram);
    row1.addChild(cellB, uow);
    row1.addChild(cellA, uow);
    row2.addChild(cellD, uow);
    row2.addChild(cellC, uow);
    table.addChild(row2, uow);
    table.addChild(row1, uow);

    context = {
      model: {
        activeDiagram: diagram,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;
  });

  test('moves left column right', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellB = row1.children[0] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableColumnMoveAction(1, context);
    action.execute();

    // After moving right, cellA should have x=100 and cellB should have x=0
    expect(cellA.bounds.x).toBe(100);
    expect(cellB.bounds.x).toBe(0);

    // Check all cells in both rows
    const row2 = table.children[0] as DiagramNode;
    const cellC = row2.children[1] as DiagramNode;
    const cellD = row2.children[0] as DiagramNode;

    expect(cellC.bounds.x).toBe(100);
    expect(cellD.bounds.x).toBe(0);
  });

  test('moves right column left', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellB = row1.children[0] as DiagramNode;
    const row2 = table.children[0] as DiagramNode;
    const cellC = row2.children[1] as DiagramNode;
    const cellD = row2.children[0] as DiagramNode;

    diagram.selection.setElements([cellB]);

    const action = new TableColumnMoveAction(-1, context);
    action.execute();

    // After moving left, cellB should have x=0 and cellA should have x=100
    expect(cellB.bounds.x).toBe(0);
    expect(cellA.bounds.x).toBe(100);

    // Check all cells in both rows - D also moved to the left
    expect(cellD.bounds.x).toBe(0);
    expect(cellC.bounds.x).toBe(100);
  });
});

describe('TableInsertAction', () => {
  let diagram: Diagram;
  let table: DiagramNode;
  let context: ActionContext;

  beforeEach(() => {
    const diagramBuilder = TestModel.newDiagram();
    diagram = diagramBuilder;
    const layer = diagramBuilder.newLayer();

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

    const uow = UnitOfWork.immediate(diagram);
    row1.addChild(cellB, uow);
    row1.addChild(cellA, uow);
    row2.addChild(cellD, uow);
    row2.addChild(cellC, uow);
    table.addChild(row2, uow);
    table.addChild(row1, uow);

    context = {
      model: {
        activeDiagram: diagram,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;
  });

  test('inserts row before top row', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableInsertAction('row', -1, context);
    action.execute();

    const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
    expect(rows).toHaveLength(3);

    // New row should be at y=0, original top row shifted to y=100
    expect(rows[0]!.bounds.y).toBe(0);
    expect(rows[1]!.bounds.y).toBe(100);
    expect(rows[2]!.bounds.y).toBe(200);
  });

  test('inserts row after top row', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableInsertAction('row', 1, context);
    action.execute();

    const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
    expect(rows).toHaveLength(3);

    // Original top row at y=0, new row at y=100, original bottom row shifted
    expect(rows[0]!.bounds.y).toBe(0);
    expect(rows[1]!.bounds.y).toBe(100);
    expect(rows[2]!.bounds.y).toBe(200);
  });

  test('inserts column before left column', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableInsertAction('column', -1, context);
    action.execute();

    const row1After = table.children[1] as DiagramNode;
    const row2After = table.children[0] as DiagramNode;

    const columnsRow1 = (row1After.children as DiagramNode[]).toSorted(
      (a, b) => a.bounds.x - b.bounds.x
    );
    const columnsRow2 = (row2After.children as DiagramNode[]).toSorted(
      (a, b) => a.bounds.x - b.bounds.x
    );

    expect(columnsRow1).toHaveLength(3);
    expect(columnsRow2).toHaveLength(3);

    // New column at x=0, original left at x=100
    expect(columnsRow1[0]!.bounds.x).toBe(0);
    expect(columnsRow1[1]!.id).toBe('cell-a');
    expect(columnsRow1[1]!.bounds.x).toBe(100);
  });

  test('inserts column after right column', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellB = row1.children[0] as DiagramNode;

    diagram.selection.setElements([cellB]);

    const action = new TableInsertAction('column', 1, context);
    action.execute();

    const row1After = table.children[1] as DiagramNode;
    const row2After = table.children[0] as DiagramNode;

    const columnsRow1 = (row1After.children as DiagramNode[]).toSorted(
      (a, b) => a.bounds.x - b.bounds.x
    );
    const columnsRow2 = (row2After.children as DiagramNode[]).toSorted(
      (a, b) => a.bounds.x - b.bounds.x
    );

    expect(columnsRow1).toHaveLength(3);
    expect(columnsRow2).toHaveLength(3);

    // Original right at x=100, new column at x=200
    expect(columnsRow1[1]!.id).toBe('cell-b');
    expect(columnsRow1[1]!.bounds.x).toBe(100);
    expect(columnsRow1[2]!.bounds.x).toBe(200);
  });
});

describe('TableRemoveAction', () => {
  let diagram: Diagram;
  let table: DiagramNode;
  let context: ActionContext;

  beforeEach(() => {
    const diagramBuilder = TestModel.newDiagram();
    diagram = diagramBuilder;
    const layer = diagramBuilder.newLayer();

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

    // Create cells in left-to-right order (matching real app behavior)
    const cellA = layer.addNode({
      id: 'cell-a',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellB = layer.addNode({
      id: 'cell-b',
      type: 'rect',
      bounds: { x: 100, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellC = layer.addNode({
      id: 'cell-c',
      type: 'rect',
      bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 }
    });
    const cellD = layer.addNode({
      id: 'cell-d',
      type: 'rect',
      bounds: { x: 100, y: 100, w: 100, h: 100, r: 0 }
    });

    const uow = UnitOfWork.immediate(diagram);
    row1.addChild(cellA, uow);
    row1.addChild(cellB, uow);
    row2.addChild(cellC, uow);
    row2.addChild(cellD, uow);
    table.addChild(row2, uow);
    table.addChild(row1, uow);

    context = {
      model: {
        activeDiagram: diagram,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;
  });

  test('removes top row', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableRemoveAction('row', context);
    action.execute();

    const rows = table.children as DiagramNode[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('row-2');
  });

  test('removes bottom row', () => {
    const row2 = table.children[0] as DiagramNode;
    const cellC = row2.children[1] as DiagramNode;

    diagram.selection.setElements([cellC]);

    const action = new TableRemoveAction('row', context);
    action.execute();

    const rows = table.children as DiagramNode[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('row-1');
  });

  test('removes left column', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[0] as DiagramNode; // Left cell at array index 0

    diagram.selection.setElements([cellA]);

    const action = new TableRemoveAction('column', context);
    action.execute();

    const row1After = table.children[1] as DiagramNode;
    const row2After = table.children[0] as DiagramNode;

    expect(row1After.children).toHaveLength(1);
    expect(row2After.children).toHaveLength(1);

    // Left column removed, right column remains
    const remainingCell1 = row1After.children[0] as DiagramNode;
    const remainingCell2 = row2After.children[0] as DiagramNode;
    expect(remainingCell1.id).toBe('cell-b');
    expect(remainingCell2.id).toBe('cell-d');
  });

  test('removes right column', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellB = row1.children[1] as DiagramNode; // Right cell at array index 1

    diagram.selection.setElements([cellB]);

    const action = new TableRemoveAction('column', context);
    action.execute();

    const row1After = table.children[1] as DiagramNode;
    const row2After = table.children[0] as DiagramNode;

    expect(row1After.children).toHaveLength(1);
    expect(row2After.children).toHaveLength(1);

    // Right column removed, left column remains
    const remainingCell1 = row1After.children[0] as DiagramNode;
    const remainingCell2 = row2After.children[0] as DiagramNode;
    expect(remainingCell1.id).toBe('cell-a');
    expect(remainingCell2.id).toBe('cell-c');
  });

  test('clears selection after removal', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[0] as DiagramNode;

    diagram.selection.setElements([cellA]);

    const action = new TableRemoveAction('row', context);
    action.execute();

    expect(diagram.selection.isEmpty()).toBe(true);
  });
});

describe('TableDistributeAction', () => {
  let diagram: Diagram;
  let table: DiagramNode;
  let context: ActionContext;

  beforeEach(() => {
    const diagramBuilder = TestModel.newDiagram();
    diagram = diagramBuilder;
    const layer = diagramBuilder.newLayer();

    table = layer.addNode({
      id: 'table-1',
      type: 'table',
      bounds: { x: 0, y: 0, w: 300, h: 300, r: 0 }
    });

    // Create 3 rows with different heights
    const row1 = layer.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 300, h: 50, r: 0 }
    });
    const row2 = layer.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 50, w: 300, h: 150, r: 0 }
    });
    const row3 = layer.addNode({
      id: 'row-3',
      type: 'tableRow',
      bounds: { x: 0, y: 200, w: 300, h: 100, r: 0 }
    });

    // Create cells with different widths for each row
    const cellA1 = layer.addNode({
      id: 'cell-a1',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 }
    });
    const cellA2 = layer.addNode({
      id: 'cell-a2',
      type: 'rect',
      bounds: { x: 50, y: 0, w: 100, h: 50, r: 0 }
    });
    const cellA3 = layer.addNode({
      id: 'cell-a3',
      type: 'rect',
      bounds: { x: 150, y: 0, w: 150, h: 50, r: 0 }
    });

    const cellB1 = layer.addNode({
      id: 'cell-b1',
      type: 'rect',
      bounds: { x: 0, y: 50, w: 50, h: 150, r: 0 }
    });
    const cellB2 = layer.addNode({
      id: 'cell-b2',
      type: 'rect',
      bounds: { x: 50, y: 50, w: 100, h: 150, r: 0 }
    });
    const cellB3 = layer.addNode({
      id: 'cell-b3',
      type: 'rect',
      bounds: { x: 150, y: 50, w: 150, h: 150, r: 0 }
    });

    const cellC1 = layer.addNode({
      id: 'cell-c1',
      type: 'rect',
      bounds: { x: 0, y: 200, w: 50, h: 100, r: 0 }
    });
    const cellC2 = layer.addNode({
      id: 'cell-c2',
      type: 'rect',
      bounds: { x: 50, y: 200, w: 100, h: 100, r: 0 }
    });
    const cellC3 = layer.addNode({
      id: 'cell-c3',
      type: 'rect',
      bounds: { x: 150, y: 200, w: 150, h: 100, r: 0 }
    });

    const uow = UnitOfWork.immediate(diagram);
    row1.addChild(cellA1, uow);
    row1.addChild(cellA2, uow);
    row1.addChild(cellA3, uow);
    row2.addChild(cellB1, uow);
    row2.addChild(cellB2, uow);
    row2.addChild(cellB3, uow);
    row3.addChild(cellC1, uow);
    row3.addChild(cellC2, uow);
    row3.addChild(cellC3, uow);
    table.addChild(row3, uow);
    table.addChild(row2, uow);
    table.addChild(row1, uow);

    context = {
      model: {
        activeDiagram: diagram,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;
  });

  test('distributes rows evenly', () => {
    const row1 = table.children[2] as DiagramNode;
    const cellA1 = row1.children[0] as DiagramNode;

    diagram.selection.setElements([cellA1]);

    const action = new TableDistributeAction('row', context);
    action.execute();

    // Table height is 300, so each row should be 100
    const rows = (table.children as DiagramNode[]).toSorted((a, b) => a.bounds.y - b.bounds.y);
    expect(rows[0]!.bounds.h).toBe(100);
    expect(rows[1]!.bounds.h).toBe(100);
    expect(rows[2]!.bounds.h).toBe(100);
  });

  test('distributes columns evenly', () => {
    const row1 = table.children[2] as DiagramNode;
    const cellA1 = row1.children[0] as DiagramNode;

    diagram.selection.setElements([cellA1]);

    const action = new TableDistributeAction('column', context);
    action.execute();

    // Table width is 300, 3 columns, so each should be 100
    const row1After = table.children[2] as DiagramNode;
    const row2After = table.children[1] as DiagramNode;
    const row3After = table.children[0] as DiagramNode;

    // Check all cells in each column have same width
    expect((row1After.children[0] as DiagramNode).bounds.w).toBe(100);
    expect((row1After.children[1] as DiagramNode).bounds.w).toBe(100);
    expect((row1After.children[2] as DiagramNode).bounds.w).toBe(100);

    expect((row2After.children[0] as DiagramNode).bounds.w).toBe(100);
    expect((row2After.children[1] as DiagramNode).bounds.w).toBe(100);
    expect((row2After.children[2] as DiagramNode).bounds.w).toBe(100);

    expect((row3After.children[0] as DiagramNode).bounds.w).toBe(100);
    expect((row3After.children[1] as DiagramNode).bounds.w).toBe(100);
    expect((row3After.children[2] as DiagramNode).bounds.w).toBe(100);
  });

  test('distributes rows with table title', () => {
    // Create a new table with title configured
    const diagram2 = TestModel.newDiagram();
    const layer2 = diagram2.newLayer();

    const table2 = layer2.addNode({
      id: 'table-2',
      type: 'table',
      bounds: { x: 0, y: 0, w: 300, h: 300, r: 0 },
      // @ts-expect-error - test property
      props: {
        custom: {
          table: {
            title: true,
            titleSize: 50
          }
        }
      }
    });

    const row1 = layer2.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 50, w: 300, h: 50, r: 0 }
    });
    const row2 = layer2.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 100, w: 300, h: 100, r: 0 }
    });
    const row3 = layer2.addNode({
      id: 'row-3',
      type: 'tableRow',
      bounds: { x: 0, y: 200, w: 300, h: 100, r: 0 }
    });

    const cellA = layer2.addNode({
      id: 'cell-a',
      type: 'rect',
      bounds: { x: 0, y: 50, w: 100, h: 50, r: 0 }
    });
    const cellB = layer2.addNode({
      id: 'cell-b',
      type: 'rect',
      bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 }
    });
    const cellC = layer2.addNode({
      id: 'cell-c',
      type: 'rect',
      bounds: { x: 0, y: 200, w: 100, h: 100, r: 0 }
    });

    const uow = UnitOfWork.immediate(diagram2);
    row1.addChild(cellA, uow);
    row2.addChild(cellB, uow);
    row3.addChild(cellC, uow);
    table2.addChild(row3, uow);
    table2.addChild(row2, uow);
    table2.addChild(row1, uow);

    diagram2.selection.setElements([cellA]);

    const context2 = {
      model: {
        activeDiagram: diagram2,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;

    const action = new TableDistributeAction('row', context2);
    action.execute();

    // Table height is 300, title takes 50, so 250 left for 3 rows = 83.33... each
    const expectedHeight = (300 - 50) / 3;
    expect(row1.bounds.h).toBeCloseTo(expectedHeight);
    expect(row2.bounds.h).toBeCloseTo(expectedHeight);
    expect(row3.bounds.h).toBeCloseTo(expectedHeight);
  });

  test('distributes rows in 2x2 table', () => {
    // Create a simpler 2x2 table
    const diagram2 = TestModel.newDiagram();
    const layer2 = diagram2.newLayer();

    const table2 = layer2.addNode({
      id: 'table-2',
      type: 'table',
      bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
    });

    const row1 = layer2.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 200, h: 80, r: 0 }
    });
    const row2 = layer2.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 80, w: 200, h: 120, r: 0 }
    });

    const cellA = layer2.addNode({
      id: 'cell-a',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 100, h: 80, r: 0 }
    });
    const cellB = layer2.addNode({
      id: 'cell-b',
      type: 'rect',
      bounds: { x: 100, y: 0, w: 100, h: 80, r: 0 }
    });
    const cellC = layer2.addNode({
      id: 'cell-c',
      type: 'rect',
      bounds: { x: 0, y: 80, w: 100, h: 120, r: 0 }
    });
    const cellD = layer2.addNode({
      id: 'cell-d',
      type: 'rect',
      bounds: { x: 100, y: 80, w: 100, h: 120, r: 0 }
    });

    const uow = UnitOfWork.immediate(diagram2);
    row1.addChild(cellA, uow);
    row1.addChild(cellB, uow);
    row2.addChild(cellC, uow);
    row2.addChild(cellD, uow);
    table2.addChild(row2, uow);
    table2.addChild(row1, uow);

    diagram2.selection.setElements([cellA]);

    const context2 = {
      model: {
        activeDiagram: diagram2,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;

    const action = new TableDistributeAction('row', context2);
    action.execute();

    // Each row should be 100 (200 / 2)
    expect(row1.bounds.h).toBe(100);
    expect(row2.bounds.h).toBe(100);
  });

  test('distributes columns in 2x2 table', () => {
    // Create a simpler 2x2 table with uneven column widths
    const diagram2 = TestModel.newDiagram();
    const layer2 = diagram2.newLayer();

    const table2 = layer2.addNode({
      id: 'table-2',
      type: 'table',
      bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
    });

    const row1 = layer2.addNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 }
    });
    const row2 = layer2.addNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 }
    });

    const cellA = layer2.addNode({
      id: 'cell-a',
      type: 'rect',
      bounds: { x: 0, y: 0, w: 50, h: 100, r: 0 }
    });
    const cellB = layer2.addNode({
      id: 'cell-b',
      type: 'rect',
      bounds: { x: 50, y: 0, w: 150, h: 100, r: 0 }
    });
    const cellC = layer2.addNode({
      id: 'cell-c',
      type: 'rect',
      bounds: { x: 0, y: 100, w: 50, h: 100, r: 0 }
    });
    const cellD = layer2.addNode({
      id: 'cell-d',
      type: 'rect',
      bounds: { x: 50, y: 100, w: 150, h: 100, r: 0 }
    });

    const uow = UnitOfWork.immediate(diagram2);
    row1.addChild(cellA, uow);
    row1.addChild(cellB, uow);
    row2.addChild(cellC, uow);
    row2.addChild(cellD, uow);
    table2.addChild(row2, uow);
    table2.addChild(row1, uow);

    diagram2.selection.setElements([cellA]);

    const context2 = {
      model: {
        activeDiagram: diagram2,
        on: () => {},
        off: () => {}
      }
    } as unknown as ActionContext;

    const action = new TableDistributeAction('column', context2);
    action.execute();

    // Each column should be 100 (200 / 2)
    expect(cellA.bounds.w).toBe(100);
    expect(cellB.bounds.w).toBe(100);
    expect(cellC.bounds.w).toBe(100);
    expect(cellD.bounds.w).toBe(100);
  });
});
