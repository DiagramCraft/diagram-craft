import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  loadUMLStencils,
  registerUMLNodes
} from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { UMLLifelineNodeDefinition } from '@diagram-craft/stencil-uml/sequence/UMLLifeline.nodeType';
import { UMLLifelineExecutionNodeDefinition } from '@diagram-craft/stencil-uml/sequence/UMLLifelineExecution.nodeType';
import { TransformFactory } from '@diagram-craft/geometry/transform';

describe('UMLLifeline', () => {
  test('registers the lifeline container and line node definitions', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    expect(diagram.document.registry.nodes.get('umlLifelineContainer')?.name).toBe(
      'UML Lifeline Container'
    );
    expect(diagram.document.registry.nodes.get('umlLifeline')?.name).toBe('UML Lifeline');
    expect(diagram.document.registry.nodes.get('umlLifelineExecution')?.name).toBe(
      'UML Lifeline Execution'
    );
    expect(diagram.document.registry.nodes.get('umlDestroy')?.name).toBe('UML Destroy');
  });

  test('loads a sequence diagram stencil for the lifeline', async () => {
    const { diagram } = TestModel.newDiagramWithLayer();

    const stencils = await loadUMLStencils(diagram.document.registry);
    const sequencePackage = stencils.subPackages?.find(p => p.id === 'sequence');

    expect(sequencePackage?.stencils.some(s => s.id === 'uml-sequence-lifeline')).toBe(true);
    expect(sequencePackage?.stencils.some(s => s.id === 'uml-sequence-execution')).toBe(true);
    expect(sequencePackage?.stencils.some(s => s.id === 'uml-sequence-destroy')).toBe(true);
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

  test('adds executions on the lifeline while preserving their vertical position', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const lifeline = layer.addNode({
      type: 'umlLifeline',
      bounds: { x: 154, y: 130, w: 12, h: 190, r: 0 }
    });
    const execution = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 40, y: 210, w: 10, h: 40, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      new UMLLifelineNodeDefinition().onDrop(
        { x: 160, y: 210 },
        lifeline,
        [execution],
        uow,
        'default'
      );
    });

    expect(execution.parent).toBe(lifeline);
    expect(execution.bounds).toEqual({ x: 155, y: 210, w: 10, h: 40, r: 0 });
  });

  test('nests executions slightly to the right of their parent execution', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const parentExecution = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 155, y: 140, w: 10, h: 80, r: 0 }
    });
    const childExecution = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 0, y: 0, w: 10, h: 40, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      new UMLLifelineExecutionNodeDefinition().onDrop(
        { x: 0, y: 0 },
        parentExecution,
        [childExecution],
        uow,
        'default'
      );
    });

    expect(childExecution.parent).toBe(parentExecution);
    expect(childExecution.bounds).toEqual({ x: 163, y: 150, w: 10, h: 40, r: 0 });
  });

  test('moves executions when the lifeline container is moved horizontally', async () => {
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
    const lifeline = layer.createNode({
      type: 'umlLifeline',
      bounds: { x: 0, y: 0, w: 12, h: 50, r: 0 }
    });
    const execution = layer.createNode({
      type: 'umlLifelineExecution',
      bounds: { x: 0, y: 0, w: 10, h: 40, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      container.addChild(head, uow);
      container.addChild(lifeline, uow);
      lifeline.addChild(execution, uow);
      new UMLLifelineNodeDefinition().onDrop(
        { x: 160, y: 160 },
        lifeline,
        [execution],
        uow,
        'default'
      );
    });

    UnitOfWork.execute(diagram, uow => {
      container.transform(
        TransformFactory.fromTo(container.bounds, { x: 200, y: 100, w: 120, h: 220, r: 0 }),
        uow
      );
    });

    expect(lifeline.bounds).toEqual({ x: 254, y: 130, w: 12, h: 190, r: 0 });
    expect(execution.bounds).toEqual({ x: 255, y: 130, w: 10, h: 40, r: 0 });
  });

  test('adds destroy markers on the lifeline at the dropped vertical position', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const lifeline = layer.addNode({
      type: 'umlLifeline',
      bounds: { x: 154, y: 130, w: 12, h: 190, r: 0 }
    });
    const destroy = layer.addNode({
      type: 'umlDestroy',
      bounds: { x: 0, y: 0, w: 10, h: 10, r: 0 }
    });

    UnitOfWork.execute(diagram, uow => {
      new UMLLifelineNodeDefinition().onDrop({ x: 160, y: 210 }, lifeline, [destroy], uow, 'default');
    });

    expect(destroy.parent).toBe(lifeline);
    expect(destroy.bounds).toEqual({ x: 155, y: 205, w: 10, h: 10, r: 0 });
  });
});
