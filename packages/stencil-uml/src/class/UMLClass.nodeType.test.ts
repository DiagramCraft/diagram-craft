import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { Transform, TransformFactory } from '@diagram-craft/geometry/transform';

const setupClassWithPort = async (type: 'umlClass' | 'umlStructuredClassifier' = 'umlClass') => {
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  await registerUMLNodes(diagram.document.registry.nodes);

  const host = layer.addNode({
    type,
    bounds: { x: 100, y: 100, w: 160, h: 80, r: 0 }
  });
  const port = layer.createNode({
    type: 'umlPort',
    bounds: { x: 255, y: 130, w: 10, h: 10, r: 0 }
  });

  UnitOfWork.execute(diagram, uow => {
    host.addChild(port, uow);
  });

  return { diagram, host, port };
};

const transformHost = (
  diagram: Awaited<ReturnType<typeof setupClassWithPort>>['diagram'],
  host: Awaited<ReturnType<typeof setupClassWithPort>>['host'],
  transforms: ReadonlyArray<Transform>
) => {
  UnitOfWork.execute(diagram, uow => {
    host.transform(transforms, uow);
  });
};

describe('UMLClass layout behavior', () => {
  test('does not resize when it only has port children', async () => {
    const { host: umlClass } = await setupClassWithPort();

    expect(umlClass.bounds).toEqual({ x: 100, y: 100, w: 160, h: 80, r: 0 });
  });

  test('does not resize ports when the class is resized', async () => {
    const { diagram, host: umlClass, port } = await setupClassWithPort();

    transformHost(
      diagram,
      umlClass,
      TransformFactory.fromTo(umlClass.bounds, { x: 100, y: 100, w: 220, h: 140, r: 0 })
    );

    expect(port.bounds.w).toBe(10);
    expect(port.bounds.h).toBe(10);
  });

  test('moves ports with the class during translation', async () => {
    const { diagram, host: umlClass, port } = await setupClassWithPort();
    const portBefore = { ...port.bounds };
    const transforms = TransformFactory.fromTo(umlClass.bounds, {
      x: 200,
      y: 100,
      w: 160,
      h: 80,
      r: 0
    });

    transformHost(diagram, umlClass, transforms);

    expect(port.bounds).toEqual(Transform.box(portBefore, ...transforms));
  });

  test('moves ports with the class during rotation', async () => {
    const { diagram, host: umlClass, port } = await setupClassWithPort();
    const transforms = TransformFactory.fromTo(umlClass.bounds, {
      x: 100,
      y: 100,
      w: 160,
      h: 80,
      r: Math.PI / 2
    });

    transformHost(diagram, umlClass, transforms);

    expect(port.bounds).toEqual({ x: 180, y: 175, w: 10, h: 10, r: Math.PI / 2 });
  });
});
