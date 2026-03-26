import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const createPseudoState = async (variant: 'initial' | 'terminate' | 'entry' | 'exit' | 'final') => {
  const { diagram, layer } = TestModel.newDiagramWithLayer();
  await registerUMLNodes(diagram.document.registry.nodes);

  const node = layer.addNode({
    type: 'umlPseudoState',
    bounds: { x: 0, y: 0, w: 24, h: 24, r: 0 }
  });

  UnitOfWork.execute(diagram, uow => {
    node.updateCustomProps('umlPseudoState', p => (p.variant = variant), uow);
  });

  return node;
};

describe('UMLPseudoState node', () => {
  test('has anchors on all four sides and center', async () => {
    const node = await createPseudoState('initial');

    expect(node.anchors.map(a => a.id)).toEqual(['n', 'e', 's', 'w', 'c']);
  });

  test('supports all pseudo state variants', async () => {
    for (const variant of ['initial', 'terminate', 'entry', 'exit', 'final'] as const) {
      const node = await createPseudoState(variant);
      expect(node.renderProps.custom.umlPseudoState.variant).toBe(variant);
    }
  });
});
