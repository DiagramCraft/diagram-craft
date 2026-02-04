import { beforeEach, describe, expect, test } from 'vitest';
import { TextPasteHandler } from './clipboardPasteHandlers';
import {
  TestDiagramBuilder,
  TestLayerBuilder,
  TestModel
} from '@diagram-craft/model/test-support/testModel';
import { BaseActionArgs } from '@diagram-craft/canvas/action';
import { isNode } from '@diagram-craft/model/diagramElement';

describe('TextPasteHandler', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;
  let handler: TextPasteHandler;

  const createMockContext = (point = { x: 100, y: 100 }): BaseActionArgs =>
    ({
      point,
      source: 'mouse'
    }) as BaseActionArgs;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    handler = new TextPasteHandler();
  });

  test('should create a text node with the pasted text content', async () => {
    const textContent = 'Hello, World!';
    const blob = new Blob([textContent], { type: 'text/plain' });
    const pastePoint = { x: 50, y: 75 };
    const context = createMockContext(pastePoint);

    await handler.paste(blob, diagram, layer, context);

    const nodes = layer.elements.filter(isNode);
    expect(nodes).toHaveLength(1);

    const textNode = nodes[0]!;
    expect(textNode.nodeType).toBe('text');
    expect(textNode.getText()).toBe(textContent);

    expect(textNode.bounds.x).toBe(pastePoint.x);
    expect(textNode.bounds.y).toBe(pastePoint.y);
  });

  describe('undo/redo functionality', () => {
    test('should support undo', async () => {
      const textContent = 'Undo test';
      const blob = new Blob([textContent], { type: 'text/plain' });
      const context = createMockContext();

      await handler.paste(blob, diagram, layer, context);

      expect(layer.elements.filter(isNode)).toHaveLength(1);

      diagram.undoManager.undo();

      expect(layer.elements.filter(isNode)).toHaveLength(0);
    });

    test('should support redo', async () => {
      const textContent = 'Redo test';
      const blob = new Blob([textContent], { type: 'text/plain' });
      const context = createMockContext();

      await handler.paste(blob, diagram, layer, context);
      diagram.undoManager.undo();
      diagram.undoManager.redo();

      const nodes = layer.elements.filter(isNode);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.getText()).toBe(textContent);
    });

    test('should restore text content and position after undo/redo', async () => {
      const textContent = 'Test content';
      const blob = new Blob([textContent], { type: 'text/plain' });
      const pastePoint = { x: 150, y: 250 };
      const context = createMockContext(pastePoint);

      await handler.paste(blob, diagram, layer, context);
      const originalNode = layer.elements.filter(isNode)[0]!;
      const originalId = originalNode.id;

      diagram.undoManager.undo();
      diagram.undoManager.redo();

      const restoredNode = layer.elements.filter(isNode)[0]!;
      expect(restoredNode.id).toBe(originalId);
      expect(restoredNode.getText()).toBe(textContent);
      expect(restoredNode.bounds.x).toBe(pastePoint.x);
      expect(restoredNode.bounds.y).toBe(pastePoint.y);
    });

    test('should clear paste point after undo', async () => {
      const textContent = 'Clear test';
      const blob = new Blob([textContent], { type: 'text/plain' });
      const context = createMockContext({ x: 100, y: 100 });

      await handler.paste(blob, diagram, layer, context);
      diagram.undoManager.undo();

      await handler.paste(blob, diagram, layer, context);
      const nodes = layer.elements.filter(isNode);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.bounds.x).toBe(100);
      expect(nodes[0]!.bounds.y).toBe(100);
    });
  });

  test('should offset pasted text when pasting same content repeatedly', async () => {
    const textContent = 'Repeated paste';
    const blob = new Blob([textContent], { type: 'text/plain' });
    const initialPoint = { x: 100, y: 100 };
    const context = createMockContext(initialPoint);

    await handler.paste(blob, diagram, layer, context);
    const firstNode = layer.elements.filter(isNode)[0]!;
    expect(firstNode.bounds.x).toBe(100);
    expect(firstNode.bounds.y).toBe(100);

    await handler.paste(blob, diagram, layer, context);
    const secondNode = layer.elements.filter(isNode)[1]!;
    expect(secondNode.bounds.x).toBe(110);
    expect(secondNode.bounds.y).toBe(110);

    await handler.paste(blob, diagram, layer, context);
    const thirdNode = layer.elements.filter(isNode)[2]!;
    expect(thirdNode.bounds.x).toBe(120);
    expect(thirdNode.bounds.y).toBe(120);
  });

  test('should reset offset when pasting different content', async () => {
    const firstContent = 'First text';
    const secondContent = 'Different text';
    const firstBlob = new Blob([firstContent], { type: 'text/plain' });
    const secondBlob = new Blob([secondContent], { type: 'text/plain' });
    const initialPoint = { x: 100, y: 100 };
    const context = createMockContext(initialPoint);

    await handler.paste(firstBlob, diagram, layer, context);
    const firstNode = layer.elements.filter(isNode)[0]!;
    expect(firstNode.bounds.x).toBe(100);
    expect(firstNode.bounds.y).toBe(100);

    await handler.paste(secondBlob, diagram, layer, context);
    const secondNode = layer.elements.filter(isNode)[1]!;
    expect(secondNode.bounds.x).toBe(100);
    expect(secondNode.bounds.y).toBe(100);
  });
});
