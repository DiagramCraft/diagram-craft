import { describe, expect, test, vi } from 'vitest';
import type { BaseShapeBuildShapeProps } from '@diagram-craft/canvas/components/BaseNodeComponent';
import type { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { PartialRectNodeDefinition } from './PartialRect.nodeType';

const makePartialRect = (props?: {
  custom?: {
    partialRect?: {
      north?: boolean;
      south?: boolean;
      east?: boolean;
      west?: boolean;
    };
  };
}) => {
  const definition = new PartialRectNodeDefinition();
  const { layer } = TestModel.newDiagramWithLayer();
  const node = layer.addNode({
    type: 'partial-rect',
    bounds: { x: 10, y: 20, w: 100, h: 50, r: 0 },
    props
  });

  return { definition, node };
};

const makeBuildShapeProps = (
  node: ReturnType<typeof makePartialRect>['node']
): BaseShapeBuildShapeProps => ({
  node,
  nodeProps: node.renderProps,
  style: {},
  isSingleSelected: false,
  onMouseDown: vi.fn(),
  onDoubleClick: undefined,
  isReadOnly: false,
  childProps: {
    onMouseDown: vi.fn(),
    onDoubleClick: undefined
  },
  context: {} as BaseShapeBuildShapeProps['context']
});

const makeShapeBuilderSpy = () => ({
  boundaryPath: vi.fn(),
  path: vi.fn(),
  text: vi.fn()
});

describe('PartialRectNodeDefinition', () => {
  test('merges defaults so all sides are enabled by default', () => {
    const { node } = makePartialRect();

    expect(node.renderProps.custom.partialRect).toEqual({
      north: true,
      south: true,
      east: true,
      west: true
    });
  });

  test('renders only the enabled sides', () => {
    const { definition, node } = makePartialRect({
      custom: {
        partialRect: {
          north: false,
          south: true,
          east: true,
          west: false
        }
      }
    });
    const component = new definition.component(definition);
    const shapeBuilder = makeShapeBuilderSpy();

    component.buildShape(
      makeBuildShapeProps(node),
      shapeBuilder as unknown as ShapeBuilder
    );

    expect(shapeBuilder.boundaryPath).toHaveBeenCalledTimes(1);
    expect(shapeBuilder.path).toHaveBeenCalledTimes(2);
    expect(shapeBuilder.text).toHaveBeenCalledTimes(1);
  });
});
