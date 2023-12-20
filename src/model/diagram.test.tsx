import { describe, expect, test } from 'vitest';
import { Diagram } from './diagram.ts';
import { TransformFactory } from '../geometry/transform.ts';
import { ReactNodeDefinition } from '../react-canvas-viewer/reactNodeDefinition.ts';
import { DiagramNode } from './diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry.ts';
import { PathBuilder } from '../geometry/pathBuilder.ts';

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
    nodeDefinitionRegistry.register(
      new ReactNodeDefinition('a', 'a', () => null, {
        getBoundingPath: () => new PathBuilder()
      })
    );

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
});
