import { beforeEach, describe, expect, test } from 'vitest';
import { TableHelper } from './tableUtils';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Transform, TransformFactory } from '@diagram-craft/geometry/transform';
import { TestLayerBuilder } from '@diagram-craft/model/test-support/testModel';

describe('TableHelper', () => {
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

    const cellB = layer.createNode({
      id: 'cell-b',
      type: 'tableCell',
      bounds: { x: 100, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellA = layer.createNode({
      id: 'cell-a',
      type: 'tableCell',
      bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 }
    });
    const cellD = layer.createNode({
      id: 'cell-d',
      type: 'tableCell',
      bounds: { x: 100, y: 100, w: 100, h: 100, r: 0 }
    });
    const cellC = layer.createNode({
      id: 'cell-c',
      type: 'tableCell',
      bounds: { x: 0, y: 100, w: 100, h: 100, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      row1.addChild(cellB, uow);
      row1.addChild(cellA, uow);
      row2.addChild(cellD, uow);
      row2.addChild(cellC, uow);
      table.addChild(row2, uow);
      table.addChild(row1, uow);
    });
  });

  test('resolves selected table', () => {
    const helper = new TableHelper(table);

    expect(helper.isTable()).toBe(true);
    expect(helper.tableNode).toBe(table);
    expect(helper.cell).toBe(undefined);
    expect(helper.getCurrentRow()).toBe(undefined);
  });

  test('resolves selected table cell', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const helper = new TableHelper(cellA);

    expect(helper.isTable()).toBe(true);
    expect(helper.tableNode).toBe(table);
    expect(helper.cell).toBe(cellA);
    expect(helper.getCurrentCell()).toBe(cellA);
    expect(helper.getCurrentRow()?.id).toBe('row-1');
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
    expect(helper.getCurrentCell()).toBe(undefined);
    expect(helper.getRowsSorted()).toEqual([]);
    expect(helper.getColumnCount()).toBe(0);
  });

  test('returns correct row index', () => {
    const topRow = table.children[1] as DiagramNode;
    const bottomRow = table.children[0] as DiagramNode;

    const cellA = topRow.children[1] as DiagramNode;
    const cellC = bottomRow.children[1] as DiagramNode;

    expect(new TableHelper(cellA).getCellRowIndex()).toBe(0);
    expect(new TableHelper(cellC).getCellRowIndex()).toBe(1);
  });

  test('returns correct column index', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellB = row1.children[0] as DiagramNode;

    expect(new TableHelper(cellA).getCellColumnIndex()).toBe(0);
    expect(new TableHelper(cellB).getCellColumnIndex()).toBe(1);
  });

  test('sorts rows and columns visually', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const helper = new TableHelper(cellA);

    const rows = helper.getRowsSorted();
    const columns = helper.getColumnsSorted(rows[0]!);

    expect(rows.map(r => r.id)).toEqual(['row-1', 'row-2']);
    expect(columns.map(c => c.id)).toEqual(['cell-a', 'cell-b']);
  });

  test('returns correct column count', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;

    expect(new TableHelper(cellA).getColumnCount()).toBe(2);
  });

  test('shrinking a cell shrinks the whole column', () => {
    const row1 = table.children[1] as DiagramNode;
    const row2 = table.children[0] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellC = row2.children[1] as DiagramNode;

    UnitOfWork.execute(diagram, uow => {
      cellA.transform(TransformFactory.fromTo(cellA.bounds, { ...cellA.bounds, w: 60 }), uow);
    });

    expect(cellA.bounds.w).toBe(60);
    expect(cellC.bounds.w).toBe(60);
  });

  test('shrinking a cell shrinks the whole row height', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellB = row1.children[0] as DiagramNode;

    UnitOfWork.execute(diagram, uow => {
      cellA.transform(TransformFactory.fromTo(cellA.bounds, { ...cellA.bounds, h: 40 }), uow);
    });

    expect(cellA.bounds.h).toBe(40);
    expect(cellB.bounds.h).toBe(40);
  });

  test('resizing a row height does not compound across cells', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellB = row1.children[0] as DiagramNode;

    UnitOfWork.execute(diagram, uow => {
      row1.transform(TransformFactory.fromTo(row1.bounds, { ...row1.bounds, h: 105 }), uow);
    });

    expect(row1.bounds.h).toBe(105);
    expect(cellA.bounds.h).toBe(105);
    expect(cellB.bounds.h).toBe(105);
  });

  test('table cell accepts dropped children', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const child = layer.addNode({
      id: 'dropped-child',
      type: 'rect',
      bounds: { x: 250, y: 250, w: 20, h: 20, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      cellA.getDefinition().onDrop?.({ x: 15, y: 15 }, cellA, [child], uow, 'default');
    });

    expect(child.parent).toBe(cellA);
    expect(cellA.children).toContain(child);
  });

  test('moving a table moves children nested inside its cells', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const child = layer.createNode({
      id: 'nested-child',
      type: 'rect',
      bounds: { x: 10, y: 10, w: 20, h: 20, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      cellA.addChild(child, uow);
    });

    const before = child.bounds;

    UnitOfWork.execute(diagram, uow => {
      table.transform(TransformFactory.fromTo(table.bounds, { ...table.bounds, x: 50, y: 40 }), uow);
    });

    expect(child.bounds).toEqual({ ...before, x: before.x + 50, y: before.y + 40 });
  });

  test('resizing a row propagates the bounds change to nested children in its cells', () => {
    const row1 = table.children[1] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const child = layer.createNode({
      id: 'nested-child-row-resize',
      type: 'rect',
      bounds: { x: 10, y: 10, w: 20, h: 20, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      cellA.addChild(child, uow);
    });

    const childBefore = child.bounds;
    const cellBefore = cellA.bounds;

    UnitOfWork.execute(diagram, uow => {
      row1.transform(TransformFactory.fromTo(row1.bounds, { ...row1.bounds, h: 105 }), uow);
    });

    expect(child.bounds).toEqual(
      Transform.box(childBefore, ...TransformFactory.fromTo(cellBefore, cellA.bounds))
    );
  });

  test('resizing a column propagates the bounds change to nested children in sibling cells', () => {
    const row1 = table.children[1] as DiagramNode;
    const row2 = table.children[0] as DiagramNode;
    const cellA = row1.children[1] as DiagramNode;
    const cellC = row2.children[1] as DiagramNode;
    const child = layer.createNode({
      id: 'nested-child-column-resize',
      type: 'rect',
      bounds: { x: 10, y: 110, w: 20, h: 20, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      cellC.addChild(child, uow);
    });

    const childBefore = child.bounds;
    const cellBefore = cellC.bounds;

    UnitOfWork.execute(diagram, uow => {
      cellA.transform(TransformFactory.fromTo(cellA.bounds, { ...cellA.bounds, w: 60 }), uow);
    });

    expect(child.bounds).toEqual(
      Transform.box(childBefore, ...TransformFactory.fromTo(cellBefore, cellC.bounds))
    );
  });
});
