import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { TransformFactory } from '@diagram-craft/geometry/transform';

describe('UMLClass layout behavior', () => {
  test('does not resize when it only has port children', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const umlClass = layer.addNode({
      type: 'umlClass',
      bounds: { x: 100, y: 100, w: 160, h: 80, r: 0 }
    });
    const port = layer.createNode({
      type: 'umlPort',
      bounds: { x: 255, y: 130, w: 10, h: 10, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      umlClass.addChild(port, uow);
    });

    expect(umlClass.bounds).toEqual({ x: 100, y: 100, w: 160, h: 80, r: 0 });
  });

  test('does not resize ports when the class is resized', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const umlClass = layer.addNode({
      type: 'umlClass',
      bounds: { x: 100, y: 100, w: 160, h: 80, r: 0 }
    });
    const port = layer.createNode({
      type: 'umlPort',
      bounds: { x: 255, y: 130, w: 10, h: 10, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      umlClass.addChild(port, uow);
    });

    UnitOfWork.execute(diagram, uow => {
      umlClass.transform(
        TransformFactory.fromTo(umlClass.bounds, { x: 100, y: 100, w: 220, h: 140, r: 0 }),
        uow
      );
    });

    expect(port.bounds.w).toBe(10);
    expect(port.bounds.h).toBe(10);
  });
});
