import { describe, expect, test } from 'vitest';
import { Diagram } from './diagram.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { ReactNodeDefinition } from '../react-canvas-viewer/reactNodeDefinition.ts';
import { DiagramNode } from './diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './nodeDefinition.ts';

describe('Diagram', () => {
  test('transform rotate', () => {
    const node1 = new DiagramNode(
      '1',
      'a',
      {
        pos: { x: 0, y: 0 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      undefined
    );

    const node2 = new DiagramNode(
      '2',
      'a',
      {
        pos: { x: 100, y: 100 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      undefined
    );

    const nodeDefinitionRegistry = new NodeDefinitionRegistry();
    nodeDefinitionRegistry.register(new ReactNodeDefinition('a', 'a', () => null));

    const nodes = [node1, node2];
    const diagram = new Diagram(
      '1',
      '1',
      nodeDefinitionRegistry,
      new EdgeDefinitionRegistry(),
      nodes
    );

    const before = { pos: { x: 0, y: 0 }, size: { w: 200, h: 200 }, rotation: 0 };
    const after = { pos: { x: 0, y: 0 }, size: { w: 200, h: 200 }, rotation: Math.PI / 2 };
    diagram.transformElements(nodes, TransformFactory.fromTo(before, after));

    expect(node1.bounds.rotation).toStrictEqual(Math.PI / 2);
    expect(node1.bounds.pos).toStrictEqual({ x: 100, y: 0 });
    expect(node1.bounds.size).toStrictEqual({ w: 100, h: 100 });

    expect(node2.bounds.rotation).toStrictEqual(Math.PI / 2);
    expect(node2.bounds.pos).toStrictEqual({ x: 0, y: 100 });
    expect(node2.bounds.size).toStrictEqual({ w: 100, h: 100 });
  });

  test.skip('transform rotate - inverse', () => {
    const node1 = new DiagramNode(
      '1',
      'a',
      {
        pos: { x: 10, y: 10 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      undefined
    );

    const node2 = new DiagramNode(
      '2',
      'a',
      {
        pos: { x: 100, y: 100 },
        size: { w: 100, h: 100 },
        rotation: 0
      },
      undefined
    );

    const nodes = [node1, node2];
    const diagram = new Diagram(
      '1',
      '1',
      new NodeDefinitionRegistry(),
      new EdgeDefinitionRegistry(),
      nodes
    );

    const before = { pos: { x: 10, y: 10 }, size: { w: 200, h: 300 }, rotation: 0 };
    const after = { pos: { x: 10, y: 10 }, size: { w: 200, h: 300 }, rotation: Math.PI / 3 };

    diagram.transformElements(nodes, TransformFactory.fromTo(before, after));
    diagram.transformElements(nodes, TransformFactory.fromTo(after, before));

    expect(node1.bounds.rotation).toStrictEqual(0);
    expect(node1.bounds.pos).toStrictEqual({ x: 10, y: 10 });
    expect(node1.bounds.size).toStrictEqual({ w: 100, h: 100 });

    expect(node2.bounds.rotation).toStrictEqual(0);
    expect(node2.bounds.pos).toStrictEqual({ x: 100, y: 100 });
    expect(node2.bounds.size).toStrictEqual({ w: 100, h: 100 });
  });
});
