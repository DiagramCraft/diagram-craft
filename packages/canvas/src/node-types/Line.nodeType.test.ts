import { describe, expect, test } from 'vitest';
import { LineNodeDefinition } from './Line.nodeType';
import { TestModel } from '@diagram-craft/model/test-support/testModel';

describe('LineNodeDefinition', () => {
  test('getBoundingPathBuilder returns horizontal line path', () => {
    const definition = new LineNodeDefinition();
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ type: 'line', bounds: { x: 0, y: 0, w: 100, h: 50, r: 0 } });

    const pathBuilder = definition.getBoundingPathBuilder(node);
    const paths = pathBuilder.getPaths();

    expect(paths.all()).toHaveLength(1);
    const path = paths.singular();
    expect(path.start.y).toBe(25);
  });

  test('getBoundingPathBuilder creates path from left to right', () => {
    const definition = new LineNodeDefinition();
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ type: 'line', bounds: { x: 10, y: 20, w: 80, h: 40, r: 0 } });

    const pathBuilder = definition.getBoundingPathBuilder(node);
    const paths = pathBuilder.getPaths();
    const path = paths.singular();

    expect(path.start.x).toBe(10);
    expect(path.end.x).toBe(90);
    expect(path.start.y).toBe(40);
    expect(path.end.y).toBe(40);
  });

  test('getBoundingPathBuilder respects node bounds transformation', () => {
    const definition = new LineNodeDefinition();
    const { layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ type: 'line', bounds: { x: 0, y: 0, w: 200, h: 100, r: 0 } });

    const pathBuilder = definition.getBoundingPathBuilder(node);
    const paths = pathBuilder.getPaths();
    const path = paths.singular();

    expect(path.start.x).toBe(0);
    expect(path.end.x).toBe(200);
    expect(path.start.y).toBe(50);
    expect(path.end.y).toBe(50);
  });
});
