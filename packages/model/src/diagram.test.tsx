import { describe, expect, test } from 'vitest';
import { Diagram, DocumentBuilder } from './diagram';
import { DiagramNode } from './diagramNode';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry';
import { assertRegularLayer, RegularLayer } from './diagramLayer';
import { UnitOfWork } from './unitOfWork';
import { TestNodeDefinition } from './TestNodeDefinition';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from './diagramDocument';

const bounds = {
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  r: 0
};

describe('Diagram', () => {
  test('visibleElements()', () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(new TestNodeDefinition('rect', 'Rectangle'));

    const diagram = new Diagram(
      newid(),
      'Name',
      new DiagramDocument(registry, new EdgeDefinitionRegistry())
    );

    const layer1 = new RegularLayer(newid(), 'Layer 1', [], diagram);
    diagram.layers.add(layer1, new UnitOfWork(diagram));

    const layer2 = new RegularLayer(newid(), 'Layer 2', [], diagram);
    diagram.layers.add(layer2, new UnitOfWork(diagram));

    const uow = new UnitOfWork(diagram);
    const node1 = new DiagramNode('1', 'rect', bounds, diagram, layer1, {}, {});
    const node2 = new DiagramNode('2', 'rect', bounds, diagram, layer2, {}, {});
    layer1.addElement(node1, uow);
    layer2.addElement(node2, uow);
    uow.commit();

    expect(diagram.visibleElements()).toStrictEqual([node1, node2]);
    diagram.layers.toggleVisibility(layer1);
    expect(diagram.visibleElements()).toStrictEqual([node2]);
    diagram.layers.toggleVisibility(layer2);
    expect(diagram.visibleElements()).toStrictEqual([]);
  });

  test('transform rotate', () => {
    const nodeDefinitionRegistry = new NodeDefinitionRegistry();
    nodeDefinitionRegistry.register(new TestNodeDefinition('rect', 'Rectangle'));

    const { diagram } = DocumentBuilder.empty(
      '1',
      '1',
      new DiagramDocument(nodeDefinitionRegistry, new EdgeDefinitionRegistry())
    );

    const uow = new UnitOfWork(diagram);

    const layer = diagram.activeLayer;
    assertRegularLayer(layer);

    const node1 = new DiagramNode('1', 'rect', bounds, diagram, layer, {}, {});
    layer.addElement(node1, uow);

    const node2 = new DiagramNode(
      '2',
      'rect',
      {
        x: 100,
        y: 100,
        w: 100,
        h: 100,
        r: 0
      },
      diagram,
      layer,
      {},
      {}
    );
    layer.addElement(node2, uow);

    const nodes = [node1, node2];

    const before = { x: 0, y: 0, w: 200, h: 200, r: 0 };
    const after = { x: 0, y: 0, w: 200, h: 200, r: Math.PI / 2 };

    diagram.transformElements(nodes, TransformFactory.fromTo(before, after), uow);
    uow.commit();

    expect(node1.bounds).toStrictEqual({ x: 100, y: 0, w: 100, h: 100, r: Math.PI / 2 });
    expect(node2.bounds).toStrictEqual({ x: 0, y: 100, w: 100, h: 100, r: Math.PI / 2 });
  });
});
