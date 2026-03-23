import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { UMLFrameNodeDefinition } from '@diagram-craft/stencil-uml/common/UMLFrame.nodeType';

describe('UMLFrame compartments', () => {
  test('exposes hasCompartments as a custom property', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const frame = layer.addNode({
      type: 'umlFrame',
      bounds: { x: 100, y: 100, w: 200, h: 150, r: 0 }
    });

    const props = new UMLFrameNodeDefinition().getCustomPropertyDefinitions(frame).entries;

    expect(props.map(p => ('label' in p ? p.label : undefined)).filter(Boolean)).toEqual([
      'Has Compartments'
    ]);
    expect(frame.renderProps.custom.umlFrame.hasCompartments).toBe(false);
  });

  test('stacks regular children vertically and snaps ports to the nearest side', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const frame = layer.addNode({
      type: 'umlFrame',
      bounds: { x: 100, y: 100, w: 200, h: 150, r: 0 },
      props: {
        custom: {
          umlFrame: {
            labelH: 24,
            hasCompartments: true
          }
        }
      }
    });
    const topChild = layer.createNode({
      type: 'umlRect',
      bounds: { x: 120, y: 140, w: 160, h: 30, r: 0 }
    });
    const bottomChild = layer.createNode({
      type: 'umlRect',
      bounds: { x: 120, y: 200, w: 160, h: 40, r: 0 }
    });
    const port = layer.createNode({
      type: 'umlPort',
      bounds: { x: 96, y: 145, w: 10, h: 10, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      frame.addChild(topChild, uow);
      frame.addChild(bottomChild, uow);
      frame.addChild(port, uow);
    });

    expect(topChild.bounds.x).toBe(190);
    expect(topChild.bounds.y).toBe(100);
    expect(topChild.bounds.w).toBe(110);
    expect(topChild.bounds.h).toBeCloseTo(64.285714, 5);
    expect(topChild.bounds.r).toBe(0);
    expect(bottomChild.bounds.x).toBe(190);
    expect(bottomChild.bounds.y).toBeCloseTo(164.285714, 5);
    expect(bottomChild.bounds.w).toBe(110);
    expect(bottomChild.bounds.h).toBeCloseTo(85.714286, 5);
    expect(bottomChild.bounds.r).toBe(0);
    expect(port.bounds).toEqual({ x: 95, y: 145, w: 10, h: 10, r: 0 });
    expect(frame.bounds.x).toBe(100);
    expect(frame.bounds.y).toBe(100);
    expect(frame.bounds.w).toBe(200);
    expect(frame.bounds.h).toBe(150);
    expect(frame.bounds.r).toBe(0);
  });
});
