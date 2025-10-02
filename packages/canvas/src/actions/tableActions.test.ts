import { describe, expect, test, beforeEach } from 'vitest';
import { TableRowMoveAction, TableColumnMoveAction } from './tableActions';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ActionContext } from '../action';
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
    table = layer.addNode({ id: 'table-1', type: 'table', bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });

    // Create row 1 (top row visually, but last in children)
    const row1 = layer.addNode({ id: 'row-1', type: 'tableRow', bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 } });

    // Create row 2 (bottom row visually, but first in children)
    const row2 = layer.addNode({ id: 'row-2', type: 'tableRow', bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 } });

    // Create cells for row 1 (rightmost first)
    const cellB = layer.addNode({ id: 'cell-b', type: 'rect', bounds: { x: 100, y: 0, w: 100, h: 100, r: 0 } });
    const cellA = layer.addNode({ id: 'cell-a', type: 'rect', bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 } });

    // Create cells for row 2 (rightmost first)
    const cellD = layer.addNode({ id: 'cell-d', type: 'rect', bounds: { x: 100, y: 100, w: 100, h: 100, r: 0 } });
    const cellC = layer.addNode({ id: 'cell-c', type: 'rect', bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 } });

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

    diagram.selectionState.setElements([cellA]);

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

    diagram.selectionState.setElements([cellC]);

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
    table = layer.addNode({ id: 'table-1', type: 'table', bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });

    // Create row 1 (top row)
    const row1 = layer.addNode({ id: 'row-1', type: 'tableRow', bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 } });

    // Create row 2 (bottom row)
    const row2 = layer.addNode({ id: 'row-2', type: 'tableRow', bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 } });

    // Create cells for row 1 (rightmost first)
    const cellB = layer.addNode({ id: 'cell-b', type: 'rect', bounds: { x: 100, y: 0, w: 100, h: 100, r: 0 } });
    const cellA = layer.addNode({ id: 'cell-a', type: 'rect', bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 } });

    // Create cells for row 2 (rightmost first)
    const cellD = layer.addNode({ id: 'cell-d', type: 'rect', bounds: { x: 100, y: 100, w: 100, h: 100, r: 0 } });
    const cellC = layer.addNode({ id: 'cell-c', type: 'rect', bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 } });

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

    diagram.selectionState.setElements([cellA]);

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

    diagram.selectionState.setElements([cellB]);

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
