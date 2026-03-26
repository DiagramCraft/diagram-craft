import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { LayoutCapableShapeNodeDefinitionInterface } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';

const createState = async (text = 'State') => {
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  await registerUMLNodes(diagram.document.registry.nodes);

  const node = layer.addNode({
    type: 'umlState',
    bounds: { x: 0, y: 0, w: 160, h: 100, r: 0 }
  });

  UnitOfWork.execute(diagram, uow => {
    node.setText(text, uow);
  });

  return node;
};

const setInternalActivities = async (
  node: Awaited<ReturnType<typeof createState>>,
  text: string
) => {
  UnitOfWork.execute(node.diagram, uow => {
    node.setText(text, uow, 'internalActivities');
  });
};

const getContainerPadding = (node: Awaited<ReturnType<typeof createState>>) =>
  (node.getDefinition() as LayoutCapableShapeNodeDefinitionInterface).getContainerPadding(node);

describe('UMLState layout behavior', () => {
  test('uses top container padding when it has a title', async () => {
    const node = await createState();

    expect(getContainerPadding(node)).toEqual({
      top: 24,
      bottom: 0,
      left: 0,
      right: 0
    });
  });

  test('does not reserve title space when the title is empty', async () => {
    const node = await createState('');

    expect(getContainerPadding(node)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    });
  });

  test('reserves space for internal activities below the title', async () => {
    const node = await createState();
    await setInternalActivities(node, 'entry / initialize()');

    expect(getContainerPadding(node)).toEqual({
      top: 48,
      bottom: 0,
      left: 0,
      right: 0
    });
  });

  test('reserves only internal activities space when the title is empty', async () => {
    const node = await createState('');
    await setInternalActivities(node, 'entry / initialize()');

    expect(getContainerPadding(node)).toEqual({
      top: 24,
      bottom: 0,
      left: 0,
      right: 0
    });
  });

  test('does not render a title section when the name is empty', async () => {
    const node = await createState('');

    expect(getContainerPadding(node)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    });
  });
});
