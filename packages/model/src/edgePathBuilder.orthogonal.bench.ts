import { beforeAll, bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import type { DiagramEdge } from './diagramEdge';
import { TestModel } from './test-support/builder';
import { PointInNodeEndpoint } from './endpoint';
import { _p, Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from './unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import { _test } from './edgePathBuilder.orthogonal';

const r = new Random(123456);

const randomPoint = (d: number) => {
  return { x: r.nextFloat() * d, y: r.nextFloat() * d };
};

const dimension = 1000;

const opts = { time: 200 };

const randomBounds = () => {
  const p = randomPoint(dimension);
  return Box.fromCorners(p, Point.add(p, randomPoint(100)));
};

describe('orthogonal routing', () => {
  describe('no waypoints', () => {
    const edges: Array<DiagramEdge> = [];
    beforeAll(() => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();
      for (let i = 0; i < 100; i++) {
        const node1 = layer.addNode('1', 'rect', {
          bounds: randomBounds()
        });
        const node2 = layer.addNode('2', 'rect', {
          bounds: randomBounds()
        });
        const edge = layer.addEdge();
        edges.push(edge);
        edge.setStart(
          new PointInNodeEndpoint(node1, _p(0.5, 0.5), _p(0, 0), 'absolute'),
          UnitOfWork.immediate(diagram)
        );
        edge.setEnd(
          new PointInNodeEndpoint(node2, _p(0.5, 0.5), _p(0, 0), 'absolute'),
          UnitOfWork.immediate(diagram)
        );
      }
    });

    bench(
      'version1',
      () => {
        for (const edge of edges) {
          _test.buildOrthogonalEdgePathVersion1(edge, undefined, undefined);
        }
      },
      opts
    );
    bench(
      'version2',
      () => {
        for (const edge of edges) {
          _test.buildOrthogonalEdgePathVersion2(edge, undefined, undefined);
        }
      },
      opts
    );
  });
});
