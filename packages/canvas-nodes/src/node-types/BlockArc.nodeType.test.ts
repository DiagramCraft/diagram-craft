import { describe, expect, test } from 'vitest';
import { BlockArcNodeDefinition } from './BlockArc.nodeType';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { NumberCustomPropertyType } from '@diagram-craft/model/elementDefinitionRegistry';
import type { RawSegment } from '@diagram-craft/geometry/pathListBuilder';

type ArcSegment = Extract<RawSegment, ['A', number, number, number, 0 | 1, 0 | 1, number, number]>;

const makeBlockArc = (props?: {
  custom?: {
    blockArc?: {
      innerRadius?: number;
      startAngle?: number;
      endAngle?: number;
    };
  };
}) => {
  const definition = new BlockArcNodeDefinition();
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  const node = layer.addNode({
    type: 'blockArc',
    bounds: { x: 0, y: 0, w: 100, h: 100, r: 0 },
    props
  });

  return { definition, diagram, node };
};

const getNumberProp = (
  definition: BlockArcNodeDefinition,
  node: ReturnType<typeof makeBlockArc>['node'],
  label: string
) => {
  const property = definition
    .getCustomPropertyDefinitions(node)
    .entries.find(
      entry => entry.type === 'number' && 'label' in entry && entry.label === label
    ) as NumberCustomPropertyType | undefined;

  expect(property).toBeDefined();
  return property!;
};

const getArcSegments = (segments: RawSegment[]) =>
  segments.filter((segment): segment is ArcSegment => segment[0] === 'A');

describe('BlockArcNodeDefinition', () => {
  test('publishes symmetric bounds for end angle', () => {
    const { definition, node } = makeBlockArc();

    expect(getNumberProp(definition, node, 'End Angle')).toMatchObject({
      minValue: -360,
      maxValue: 360
    });
  });

  test('normalizes start angle below the current end angle', () => {
    const { definition, diagram, node } = makeBlockArc();
    const startAngle = getNumberProp(definition, node, 'Start Angle');

    UnitOfWork.execute(diagram, uow => {
      startAngle.set(270, uow);
    });

    expect(node.renderProps.custom.blockArc.startAngle).toBe(-90);
  });

  test('normalizes end angle above the current start angle', () => {
    const { definition, diagram, node } = makeBlockArc();
    const endAngle = getNumberProp(definition, node, 'End Angle');

    UnitOfWork.execute(diagram, uow => {
      endAngle.set(-90, uow);
    });

    expect(node.renderProps.custom.blockArc.endAngle).toBe(270);
  });

  test('uses the large-arc flag for spans above 180 degrees', () => {
    const { definition, node } = makeBlockArc();
    const path = definition.getBoundingPathBuilder(node).getPaths().singular();
    const arcs = getArcSegments(path.raw);

    expect(arcs).toHaveLength(2);
    expect(arcs.map(arc => arc[4])).toEqual([1, 1]);
  });

  test('clears the large-arc flag for spans at or below 180 degrees', () => {
    const { definition, node } = makeBlockArc({
      custom: {
        blockArc: {
          startAngle: 0,
          endAngle: 90
        }
      }
    });
    const path = definition.getBoundingPathBuilder(node).getPaths().singular();
    const arcs = getArcSegments(path.raw);

    expect(arcs).toHaveLength(2);
    expect(arcs.map(arc => arc[4])).toEqual([0, 0]);
  });
});
