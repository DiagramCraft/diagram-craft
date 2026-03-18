import { describe, expect, test } from 'vitest';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerUMLNodes } from '@diagram-craft/stencil-uml/stencil-uml-loader';
import { Translation, TransformFactory } from '@diagram-craft/geometry/transform';
import { transformElements } from '@diagram-craft/model/diagramElement';
import { FreeEndpoint, PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

describe('UMLLifelineExecution', () => {
  test('uses the expected nine execution anchors', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const execution = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 155, y: 140, w: 10, h: 40, r: 0 }
    });

    expect(execution.anchors).toEqual([
      { id: 'tl', start: { x: 0, y: 0 }, type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'bl', start: { x: 0, y: 1 }, type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'r1', start: { x: 1, y: 0 / 6 }, type: 'point', isPrimary: true, normal: 0 },
      { id: 'r2', start: { x: 1, y: 1 / 6 }, type: 'point', isPrimary: true, normal: 0 },
      { id: 'r3', start: { x: 1, y: 2 / 6 }, type: 'point', isPrimary: true, normal: 0 },
      { id: 'r4', start: { x: 1, y: 3 / 6 }, type: 'point', isPrimary: true, normal: 0 },
      { id: 'r5', start: { x: 1, y: 4 / 6 }, type: 'point', isPrimary: true, normal: 0 },
      { id: 'r6', start: { x: 1, y: 5 / 6 }, type: 'point', isPrimary: true, normal: 0 },
      { id: 'r7', start: { x: 1, y: 6 / 6 }, type: 'point', isPrimary: true, normal: 0 }
    ]);
  });

  test('resizes a linked execution after a vertical move to keep the edge horizontal', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const source = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 }
    });
    const dependent = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 70, w: 10, h: 50, r: 0 }
    });
    layer.addEdge({ startNodeId: source.id, startAnchor: 'r4', endNodeId: dependent.id, endAnchor: 'bl' });

    UnitOfWork.execute(diagram, uow => {
      transformElements([source], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(source.bounds).toEqual({ x: 100, y: 110, w: 10, h: 40, r: 0 });
    expect(dependent.bounds).toEqual({ x: 200, y: 70, w: 10, h: 60, r: 0 });
  });

  test('cascades through a chain of linked executions', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const a = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 } });
    const b = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 200, y: 70, w: 10, h: 50, r: 0 } });
    const c = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 300, y: 45, w: 10, h: 50, r: 0 } });
    layer.addEdge({ startNodeId: a.id, startAnchor: 'r4', endNodeId: b.id, endAnchor: 'bl' });
    layer.addEdge({ startNodeId: b.id, startAnchor: 'r4', endNodeId: c.id, endAnchor: 'bl' });

    UnitOfWork.execute(diagram, uow => {
      transformElements([a], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(b.bounds).toEqual({ x: 200, y: 70, w: 10, h: 60, r: 0 });
    expect(c.bounds).toEqual({ x: 300, y: 45, w: 10, h: 55, r: 0 });
  });

  test('follows both incoming and outgoing linked executions from a single transformed node', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const incoming = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 }
    });
    const root = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 80, w: 10, h: 40, r: 0 }
    });
    const outgoing = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 300, y: 50, w: 10, h: 50, r: 0 }
    });
    const incomingEdge = layer.addEdge({
      startNodeId: incoming.id,
      startAnchor: 'r4',
      endNodeId: root.id,
      endAnchor: 'bl'
    });
    const outgoingEdge = layer.addEdge({
      startNodeId: root.id,
      startAnchor: 'r4',
      endNodeId: outgoing.id,
      endAnchor: 'bl'
    });

    UnitOfWork.execute(diagram, uow => {
      transformElements([root], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(incoming.bounds).toEqual({ x: 100, y: 100, w: 10, h: 40, r: 0 });
    expect(outgoing.bounds).toEqual({ x: 300, y: 50, w: 10, h: 60, r: 0 });
    expect(incomingEdge.start.position.y).toBe(incomingEdge.end.position.y);
    expect(outgoingEdge.start.position.y).toBe(outgoingEdge.end.position.y);
  });

  test('does not cascade on a pure horizontal move', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const source = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 }
    });
    const dependent = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 70, w: 10, h: 50, r: 0 }
    });
    layer.addEdge({ startNodeId: source.id, startAnchor: 'r4', endNodeId: dependent.id, endAnchor: 'bl' });

    UnitOfWork.execute(diagram, uow => {
      transformElements([source], [new Translation({ x: 25, y: 0 })], uow);
    });

    expect(dependent.bounds).toEqual({ x: 200, y: 70, w: 10, h: 50, r: 0 });
  });

  test('does not cascade across an edge when both linked executions are moved together', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const a = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 } });
    const b = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 200, y: 70, w: 10, h: 50, r: 0 } });
    layer.addEdge({ startNodeId: a.id, startAnchor: 'r4', endNodeId: b.id, endAnchor: 'bl' });

    UnitOfWork.execute(diagram, uow => {
      transformElements([a, b], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(a.bounds).toEqual({ x: 100, y: 110, w: 10, h: 40, r: 0 });
    expect(b.bounds).toEqual({ x: 200, y: 80, w: 10, h: 50, r: 0 });
  });

  test('does not cascade across an edge when both linked executions are resized together', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const a = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 10, y: 10, w: 10, h: 40, r: 0 } });
    const b = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 60, y: 30, w: 10, h: 50, r: 0 } });
    layer.addEdge({ startNodeId: a.id, startAnchor: 'r4', endNodeId: b.id, endAnchor: 'bl' });

    const before = { x: 0, y: 0, w: 100, h: 100, r: 0 };
    const after = { x: 0, y: 0, w: 100, h: 200, r: 0 };

    UnitOfWork.execute(diagram, uow => {
      transformElements([a, b], TransformFactory.fromTo(before, after), uow);
    });

    expect(a.bounds).toEqual({ x: 10, y: 20, w: 10, h: 80, r: 0 });
    expect(b.bounds).toEqual({ x: 60, y: 60, w: 10, h: 100, r: 0 });
  });

  test('stops following a circular dependency once a node has already been adjusted', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const a = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 } });
    const b = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 200, y: 70, w: 10, h: 50, r: 0 } });
    const c = layer.addNode({ type: 'umlLifelineExecution', bounds: { x: 300, y: 45, w: 10, h: 50, r: 0 } });
    const edgeAB = layer.addEdge({ startNodeId: a.id, startAnchor: 'r4', endNodeId: b.id, endAnchor: 'bl' });
    const edgeBC = layer.addEdge({ startNodeId: b.id, startAnchor: 'r4', endNodeId: c.id, endAnchor: 'bl' });
    const edgeCA = layer.addEdge({ startNodeId: c.id, startAnchor: 'r4', endNodeId: a.id, endAnchor: 'bl' });

    UnitOfWork.execute(diagram, uow => {
      transformElements([a], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(a.bounds).toEqual({ x: 100, y: 110, w: 10, h: 40, r: 0 });
    expect(b.bounds).toEqual({ x: 200, y: 70, w: 10, h: 60, r: 0 });
    expect(c.bounds).toEqual({ x: 300, y: 45, w: 10, h: 115, r: 0 });
    expect(edgeAB.start.position.y).toBe(edgeAB.end.position.y);
    expect(edgeBC.start.position.y).not.toBe(edgeBC.end.position.y);
    expect(edgeCA.start.position.y).toBe(edgeCA.end.position.y);
  });

  test('uses a top-side resize when the dependent anchor is tl', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const source = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 }
    });
    const dependent = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 120, w: 10, h: 40, r: 0 }
    });
    layer.addEdge({ startNodeId: source.id, startAnchor: 'r4', endNodeId: dependent.id, endAnchor: 'tl' });

    UnitOfWork.execute(diagram, uow => {
      transformElements([source], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(dependent.bounds).toEqual({ x: 200, y: 130, w: 10, h: 30, r: 0 });
  });

  test('propagates from the changed anchor when opposite links connect the same two executions', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const a = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 60, r: 0 }
    });
    const b = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 120, w: 10, h: 60, r: 0 }
    });

    const edge1 = layer.addEdge({
      startNodeId: a.id,
      startAnchor: 'r3',
      endNodeId: b.id,
      endAnchor: 'tl'
    });
    const edge2 = layer.addEdge({
      startNodeId: b.id,
      startAnchor: 'bl',
      endNodeId: a.id,
      endAnchor: 'r6'
    });

    const before = { x: 200, y: 120, w: 10, h: 60, r: 0 };
    const after = { x: 200, y: 120, w: 10, h: 90, r: 0 };

    UnitOfWork.execute(diagram, uow => {
      transformElements([b], TransformFactory.fromTo(before, after), uow);
    });

    expect(b.bounds).toEqual(after);
    expect(a.bounds).toEqual({ x: 100, y: 100, w: 10, h: 120, r: 0 });
    expect(edge1.start.position.y).toBe(edge1.end.position.y);
    expect(edge2.start.position.y).toBe(edge2.end.position.y);
    expect(edge1.start).toBeInstanceOf(PointInNodeEndpoint);
    expect(edge2.end).toBeInstanceOf(PointInNodeEndpoint);
  });

  test('keeps both opposite links horizontal when moving an execution vertically', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const a = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 60, r: 0 }
    });
    const b = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 120, w: 10, h: 60, r: 0 }
    });

    const edge1 = layer.addEdge({
      startNodeId: a.id,
      startAnchor: 'r3',
      endNodeId: b.id,
      endAnchor: 'tl'
    });
    const edge2 = layer.addEdge({
      startNodeId: b.id,
      startAnchor: 'bl',
      endNodeId: a.id,
      endAnchor: 'r6'
    });

    UnitOfWork.execute(diagram, uow => {
      transformElements([b], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(b.bounds).toEqual({ x: 200, y: 130, w: 10, h: 60, r: 0 });
    expect(a.bounds).toEqual({ x: 100, y: 100, w: 10, h: 100, r: 0 });
    expect(edge1.start.position.y).toBe(edge1.end.position.y);
    expect(edge2.start.position.y).toBe(edge2.end.position.y);
    expect(edge1.start).toBeInstanceOf(PointInNodeEndpoint);
    expect(edge2.end).toBeInstanceOf(PointInNodeEndpoint);
  });

  test('ignores linked edges that do not use anchor endpoints on both executions', async () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    await registerUMLNodes(diagram.document.registry.nodes);

    const source = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 100, y: 100, w: 10, h: 40, r: 0 }
    });
    const dependent = layer.addNode({
      type: 'umlLifelineExecution',
      bounds: { x: 200, y: 70, w: 10, h: 50, r: 0 }
    });

    const freeEdge = ElementFactory.edge({
      id: 'free-edge',
      start: new PointInNodeEndpoint(source, undefined, { x: 1, y: 0.5 }, 'relative'),
      end: new FreeEndpoint({ x: 400, y: 100 }),
      layer
    });

    UnitOfWork.execute(diagram, uow => {
      layer.addElement(freeEdge, uow);
      transformElements([source], [new Translation({ x: 0, y: 10 })], uow);
    });

    expect(dependent.bounds).toEqual({ x: 200, y: 70, w: 10, h: 50, r: 0 });
  });
});
