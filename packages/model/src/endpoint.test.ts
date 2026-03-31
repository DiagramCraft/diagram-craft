import { describe, expect, test } from 'vitest';
import { AnchorEndpoint, Endpoint, PointInNodeEndpoint } from './endpoint';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import { ElementLookup } from './elementLookup';
import type { DiagramNode } from './diagramNode';

describe('endpoint', () => {
  test('treats absolute offsets that land on a corner as corners', () => {
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 } });

    const endpoint = new PointInNodeEndpoint(node, { x: 0, y: 0 }, { x: 10, y: 0 }, 'absolute');

    expect(endpoint.position).toStrictEqual({ x: 10, y: 0 });
    expect(endpoint.isCorner()).toBe(true);
  });

  test('supports deferred node lookup during deserialization', () => {
    const lookup = new ElementLookup<DiagramNode>();
    const endpoint = Endpoint.deserialize(
      {
        anchor: 'c',
        node: { id: 'node-1' },
        offset: { x: 0, y: 0 }
      },
      lookup,
      true
    );

    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'node-1' });
    lookup.set(node.id, node);

    expect(endpoint).toBeInstanceOf(AnchorEndpoint);
    expect((endpoint as AnchorEndpoint).node).toBe(node);
    expect(endpoint.position).toStrictEqual({ x: 5, y: 5 });
  });

  test('calculates anchor positions relative to a collapsed ancestor', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const container = layer.addNode({
      type: 'container',
      bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 }
    });
    const child = layer.addNode({
      type: 'rect',
      bounds: { x: 50, y: 50, w: 100, h: 100, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      diagram.moveElement([child], uow, layer, {
        relation: 'on',
        element: container
      });

      container.updateCustomProps(
        '_collapsible',
        (props: any) => {
          props.mode = 'collapsed';
          props.bounds = Box.toString({ x: 0, y: 0, w: 200, h: 200, r: 0 });
        },
        uow
      );
    });

    const endpoint = new AnchorEndpoint(child, 'c', { x: 0.25, y: 0.25 });

    expect(endpoint.position).toStrictEqual({ x: 31.25, y: 31.25 });
  });

  test('projects point-in-node endpoints to the collapsed ancestor boundary', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const container = layer.addNode({
      type: 'container',
      bounds: { x: 0, y: 0, w: 50, h: 50, r: 0 }
    });
    const child = layer.addNode({
      type: 'rect',
      bounds: { x: 50, y: 50, w: 100, h: 100, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      diagram.moveElement([child], uow, layer, {
        relation: 'on',
        element: container
      });

      container.updateCustomProps(
        '_collapsible',
        (props: any) => {
          props.mode = 'collapsed';
          props.bounds = Box.toString({ x: 0, y: 0, w: 200, h: 200, r: 0 });
        },
        uow
      );
    });

    const endpoint = new PointInNodeEndpoint(child, undefined, { x: 2, y: 0.5 }, 'relative');

    expect(endpoint.position).toStrictEqual({ x: 50, y: 25 });
  });
});
