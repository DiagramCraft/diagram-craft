import { describe, expect, test } from 'vitest';
import { Diagram } from './diagram.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { ReactNodeDefinition } from '../react-canvas-viewer/reactNodeDefinition.ts';
import { DiagramNode } from './diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry.ts';
import { newid } from '../utils/id.ts';
import { Layer } from './diagramLayer.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { Rect } from '../react-canvas-viewer/node-types/Rect.tsx';
import { RectNodeDefinition } from '../react-canvas-viewer/node-types/Rect.nodeType.ts';

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
    registry.register(new RectNodeDefinition());

    const diagram = new Diagram(newid(), 'Name', registry, new EdgeDefinitionRegistry());
    const layer1 = new Layer(newid(), 'Layer 1', [], diagram);
    diagram.layers.add(layer1, new UnitOfWork(diagram));

    const layer2 = new Layer(newid(), 'Layer 2', [], diagram);
    diagram.layers.add(layer2, new UnitOfWork(diagram));

    const uow = new UnitOfWork(diagram);
    const node1 = new DiagramNode('1', 'rect', bounds, diagram, layer1);
    const node2 = new DiagramNode('2', 'rect', bounds, diagram, layer2);
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
    nodeDefinitionRegistry.register(
      new ReactNodeDefinition(Rect, new RectNodeDefinition('rect', 'Rectangle'))
    );

    const diagram = new Diagram('1', '1', nodeDefinitionRegistry, new EdgeDefinitionRegistry());
    diagram.layers.add(new Layer('default', 'Default', [], diagram), new UnitOfWork(diagram));

    const uow = new UnitOfWork(diagram);

    const layer = diagram.layers.active;

    const node1 = new DiagramNode('1', 'rect', bounds, diagram, layer);
    diagram.layers.active.addElement(node1, uow);

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
      layer
    );
    diagram.layers.active.addElement(node2, uow);

    const nodes = [node1, node2];

    const before = { x: 0, y: 0, w: 200, h: 200, r: 0 };
    const after = { x: 0, y: 0, w: 200, h: 200, r: Math.PI / 2 };

    diagram.transformElements(nodes, TransformFactory.fromTo(before, after), uow);
    uow.commit();

    expect(node1.bounds).toStrictEqual({ x: 100, y: 0, w: 100, h: 100, r: Math.PI / 2 });
    expect(node2.bounds).toStrictEqual({ x: 0, y: 100, w: 100, h: 100, r: Math.PI / 2 });
  });
});
