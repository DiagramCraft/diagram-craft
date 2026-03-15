import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { createProvisionalLinkedNode } from './linkedNode';

describe('createProvisionalLinkedNode', () => {
  test('duplicates the source node, centers it on the target point, and reconnects the edge', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const source = layer.addNode({
      id: 'source',
      type: 'rect',
      bounds: { x: 10, y: 20, w: 120, h: 80, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      source.setText('source label', uow);
    });

    const edge = ElementFactory.edge({
      start: new AnchorEndpoint(source, 'c'),
      end: new FreeEndpoint({ x: 300, y: 220 }),
      layer
    });
    UnitOfWork.execute(diagram, uow => {
      layer.addElement(edge, uow);
    });

    const newNode = createProvisionalLinkedNode(source, edge, { x: 300, y: 220 });

    expect(newNode.id).not.toBe(source.id);
    expect(newNode.nodeType).toBe(source.nodeType);
    expect(newNode.getText()).toBe('source label');
    expect(newNode.bounds.x).toBe(240);
    expect(newNode.bounds.y).toBe(180);
    expect(edge.end.position).toEqual(newNode._getAnchorPosition('c'));
    expect(diagram.selection.nodes).toEqual([newNode]);
  });

  test('keeps duplicated children on the provisional node', () => {
    const diagram = TestModel.newDiagram();
    const layer = diagram.newLayer();
    const source = layer.addNode({
      id: 'source',
      type: 'group',
      bounds: { x: 0, y: 0, w: 200, h: 150, r: 0 }
    });
    const child = layer.createNode({
      id: 'child',
      type: 'rect',
      bounds: { x: 20, y: 20, w: 40, h: 40, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      source.setChildren([child], uow);
    });

    const edge = ElementFactory.edge({
      start: new AnchorEndpoint(source, 'c'),
      end: new FreeEndpoint({ x: 400, y: 300 }),
      layer
    });
    UnitOfWork.execute(diagram, uow => {
      layer.addElement(edge, uow);
    });

    const newNode = createProvisionalLinkedNode(source, edge, { x: 400, y: 300 });

    expect(newNode.children).toHaveLength(1);
  });
});
