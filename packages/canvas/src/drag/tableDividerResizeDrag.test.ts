import { beforeEach, describe, expect, test } from 'vitest';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { TestLayerBuilder, TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DragEvents } from '../dragDropManager';
import { TableDividerResizeDrag } from './tableDividerResizeDrag';

describe('TableDividerResizeDrag', () => {
  const target = {} as EventTarget;

  let diagram: Diagram;
  let table: DiagramNode;
  let layer: TestLayerBuilder;

  beforeEach(() => {
    const diagramBuilder = TestModel.newDiagram();
    diagram = diagramBuilder;
    layer = diagramBuilder.newLayer();

    table = layer.addNode({
      id: 'table-1',
      type: 'table',
      bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
    });

    const row1 = layer.createNode({
      id: 'row-1',
      type: 'tableRow',
      bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 }
    });
    const row2 = layer.createNode({
      id: 'row-2',
      type: 'tableRow',
      bounds: { x: 0, y: 100, w: 200, h: 100, r: 0 }
    });

    const cellA = layer.createNode({
      id: 'cell-a',
      type: 'tableCell',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellB = layer.createNode({
      id: 'cell-b',
      type: 'tableCell',
      bounds: { x: 100, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellC = layer.createNode({
      id: 'cell-c',
      type: 'tableCell',
      bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 }
    });
    const cellD = layer.createNode({
      id: 'cell-d',
      type: 'tableCell',
      bounds: { x: 100, y: 100, w: 100, h: 100, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      row1.addChild(cellA, uow);
      row1.addChild(cellB, uow);
      row2.addChild(cellC, uow);
      row2.addChild(cellD, uow);
      table.addChild(row1, uow);
      table.addChild(row2, uow);
    });

    diagram.selection.setElements([table]);
  });

  test('dragging a column divider resizes the whole column', () => {
    const drag = new TableDividerResizeDrag(table, 'column', 0, { x: 100, y: 50 });

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 130, y: 50 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    const rows = table.children as DiagramNode[];
    const topLeft = (rows[0]!.children as DiagramNode[])[0]!;
    const bottomLeft = (rows[1]!.children as DiagramNode[])[0]!;

    expect(topLeft.bounds.w).toBe(130);
    expect(bottomLeft.bounds.w).toBe(130);
  });

  test('dragging a column divider uses the original width as the drag baseline', () => {
    const drag = new TableDividerResizeDrag(table, 'column', 0, { x: 100, y: 50 });

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 130, y: 50 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 140, y: 50 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    const rows = table.children as DiagramNode[];
    const topLeft = (rows[0]!.children as DiagramNode[])[0]!;
    const bottomLeft = (rows[1]!.children as DiagramNode[])[0]!;

    expect(topLeft.bounds.w).toBe(140);
    expect(bottomLeft.bounds.w).toBe(140);
  });

  test('dragging a row divider resizes the whole row', () => {
    const drag = new TableDividerResizeDrag(table, 'row', 0, { x: 50, y: 100 });

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 50, y: 125 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    const rows = table.children as DiagramNode[];
    const topRow = rows[0]!;
    const topLeft = (topRow.children as DiagramNode[])[0]!;
    const topRight = (topRow.children as DiagramNode[])[1]!;

    expect(topRow.bounds.h).toBe(125);
    expect(topLeft.bounds.h).toBe(125);
    expect(topRight.bounds.h).toBe(125);
  });

  test('dragging a row divider grows the table height', () => {
    const drag = new TableDividerResizeDrag(table, 'row', 0, { x: 50, y: 100 });

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 50, y: 125 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    expect(table.bounds.h).toBe(225);
  });

  test('dragging a row divider uses the original height as the drag baseline', () => {
    const drag = new TableDividerResizeDrag(table, 'row', 0, { x: 50, y: 100 });

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 50, y: 125 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 50, y: 140 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    const rows = table.children as DiagramNode[];
    const topRow = rows[0]!;
    const topLeft = (topRow.children as DiagramNode[])[0]!;
    const topRight = (topRow.children as DiagramNode[])[1]!;

    expect(topRow.bounds.h).toBe(140);
    expect(topLeft.bounds.h).toBe(140);
    expect(topRight.bounds.h).toBe(140);
  });

  test('shrinking a column divider closes the gap by relayouting sibling cells', () => {
    const drag = new TableDividerResizeDrag(table, 'column', 0, { x: 100, y: 50 });

    drag.onDrag(
      new DragEvents.DragStart(
        { x: 80, y: 50 },
        { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false },
        target
      )
    );

    const rows = table.children as DiagramNode[];
    const topLeft = (rows[0]!.children as DiagramNode[])[0]!;
    const topRight = (rows[0]!.children as DiagramNode[])[1]!;

    expect(topLeft.bounds.w).toBe(80);
    expect(topRight.bounds.x).toBe(80);
    expect(table.bounds.w).toBe(180);
  });
});
