import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  loadUMLStencils,
  registerUMLNodes
} from '@diagram-craft/stencil-uml/stencil-uml-loader';

describe('UMLLifeline', () => {
  test('registers the lifeline container and line node definitions', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    expect(diagram.document.registry.nodes.get('umlLifelineContainer')?.name).toBe(
      'UML Lifeline Container'
    );
    expect(diagram.document.registry.nodes.get('umlLifeline')?.name).toBe('UML Lifeline');
  });

  test('loads a sequence diagram stencil for the lifeline', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();

    const stencils = await loadUMLStencils(diagram.document.registry);
    const sequencePackage = stencils.subPackages?.find(p => p.id === 'sequence');

    expect(sequencePackage?.stencils.some(s => s.id === 'uml-sequence-lifeline')).toBe(true);
  });

  test('lays out the head as the first child and the line as the second child', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const container = layer.addNode({
      type: 'umlLifelineContainer',
      bounds: { x: 100, y: 100, w: 120, h: 220, r: 0 }
    });
    const head = layer.createNode({
      type: 'umlRect',
      bounds: { x: 0, y: 0, w: 80, h: 30, r: 0 }
    });
    const line = layer.createNode({
      type: 'umlLifeline',
      bounds: { x: 0, y: 0, w: 12, h: 50, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      container.addChild(head, uow);
      container.addChild(line, uow);
    });

    expect(head.bounds).toEqual({ x: 120, y: 100, w: 80, h: 30, r: 0 });
    expect(line.bounds).toEqual({ x: 154, y: 130, w: 12, h: 190, r: 0 });
  });
});
