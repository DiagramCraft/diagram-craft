import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import {
  loadUMLStencils,
  registerUMLNodes
} from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { UMLDurationConstraintNodeDefinition } from '@diagram-craft/stencil-uml/sequence/UMLDurationConstraint.nodeType';

describe('UMLDurationConstraint', () => {
  test('registers the duration constraint node definition', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    expect(diagram.document.registry.nodes.get('umlDurationConstraint')?.name).toBe(
      'UML Duration Constraint'
    );
  });

  test('loads a sequence diagram stencil for the duration constraint', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();

    const stencils = await loadUMLStencils(diagram.document.registry);
    const sequencePackage = stencils.subPackages?.find(p => p.id === 'sequence');

    expect(sequencePackage?.stencils.some(s => s.id === 'uml-sequence-duration-constraint')).toBe(
      true
    );
  });

  test('exposes alignment and line toggles as custom properties', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const node = layer.addNode({
      type: 'umlDurationConstraint',
      bounds: { x: 0, y: 0, w: 24, h: 64, r: 0 }
    });

    const props = new UMLDurationConstraintNodeDefinition().getCustomPropertyDefinitions(node).entries;

    expect(props.map(p => ('label' in p ? p.label : undefined)).filter(Boolean)).toEqual([
      'Alignment',
      'Top Line',
      'Bottom Line'
    ]);
    expect(
      props.find(p => 'label' in p && p.label === 'Alignment' && 'type' in p)?.type
    ).toBe('select');
    expect(node.renderProps.custom.umlDurationConstraint.alignment).toBe('center');
    expect(node.renderProps.custom.umlDurationConstraint.topLine).toBe(false);
    expect(node.renderProps.custom.umlDurationConstraint.bottomLine).toBe(false);
  });
});
