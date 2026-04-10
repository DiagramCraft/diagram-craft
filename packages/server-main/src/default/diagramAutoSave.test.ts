import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { DiagramAutoSave } from './diagramAutoSave';
import { YJSRoot } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  type Registry
} from '@diagram-craft/model/elementDefinitionRegistry';
import { AbstractEdgeDefinition } from '@diagram-craft/model/edgeDefinition';
import { StencilRegistry } from '@diagram-craft/model/stencilRegistry';
import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

class TestEdgeDefinition extends AbstractEdgeDefinition {
  constructor() {
    super('test-edge', 'test-edge');
  }
}

const makeRegistry = (): Registry => {
  const nodes = new NodeDefinitionRegistry();
  nodes.register(new RectNodeDefinition());
  return {
    nodes,
    edges: new EdgeDefinitionRegistry(new TestEdgeDefinition()),
    stencils: new StencilRegistry()
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('DiagramAutoSave', () => {
  it('does not write autosave files when synced content still has no diagrams', async () => {
    vi.useFakeTimers();

    const yDoc = new Y.Doc();
    const writer = vi.fn<(relPath: string, content: string) => Promise<void>>(async () => {});
    const autoSave = new DiagramAutoSave(yDoc, 'test.json', 'test.temp.json', writer);

    yDoc.transact(() => {
      yDoc.getMap('other').set('value', 1);
    });

    await vi.advanceTimersByTimeAsync(2500);

    expect(writer).not.toHaveBeenCalled();
    autoSave.dispose();
  });

  it('writes autosave files once the shared document has at least one diagram', async () => {
    vi.useFakeTimers();

    const yDoc = new Y.Doc();
    const writer = vi.fn<(relPath: string, content: string) => Promise<void>>(async () => {});
    const autoSave = new DiagramAutoSave(yDoc, 'test.json', 'test.temp.json', writer);

    const root = new YJSRoot(yDoc);
    const doc = new DiagramDocument(makeRegistry(), false, root);
    const diagram = new Diagram('diagram', 'diagram', doc);
    doc.addDiagram(diagram);

    UnitOfWork.execute(diagram, uow => {
      const layer = new RegularLayer('layer', 'Layer', [], diagram);
      diagram.layers.add(layer, uow);
      layer.addElement(ElementFactory.node({ layer, nodeType: 'rect' }), uow);
    });

    await vi.advanceTimersByTimeAsync(2500);

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0]?.[0]).toBe('test.temp.json');
    const content = writer.mock.calls[0]?.[1];
    expect(content).toBeDefined();
    if (content === undefined) {
      throw new Error('Expected autosave writer to receive serialized content');
    }
    expect(JSON.parse(content).diagrams).toHaveLength(1);

    autoSave.dispose();
    doc.release();
  });

  it('flushes the real file path on the periodic save interval when content changed', async () => {
    vi.useFakeTimers();

    const yDoc = new Y.Doc();
    const writer = vi.fn<(relPath: string, content: string) => Promise<void>>(async () => {});
    const autoSave = new DiagramAutoSave(yDoc, 'test.json', 'test.temp.json', writer);

    const root = new YJSRoot(yDoc);
    const doc = new DiagramDocument(makeRegistry(), false, root);
    const diagram = new Diagram('diagram', 'diagram', doc);
    doc.addDiagram(diagram);

    UnitOfWork.execute(diagram, uow => {
      const layer = new RegularLayer('layer', 'Layer', [], diagram);
      diagram.layers.add(layer, uow);
      layer.addElement(ElementFactory.node({ layer, nodeType: 'rect' }), uow);
    });

    await vi.advanceTimersByTimeAsync(2500);

    expect(writer.mock.calls.map(([relPath]) => relPath)).toEqual(['test.temp.json']);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer.mock.calls.map(([relPath]) => relPath)).toEqual(['test.temp.json', 'test.json']);

    autoSave.dispose();
    doc.release();
  });

  it('flushes the real file immediately on room membership events when content changed', async () => {
    vi.useFakeTimers();

    const yDoc = new Y.Doc();
    const writer = vi.fn<(relPath: string, content: string) => Promise<void>>(async () => {});
    const autoSave = new DiagramAutoSave(yDoc, 'test.json', 'test.temp.json', writer);

    const root = new YJSRoot(yDoc);
    const doc = new DiagramDocument(makeRegistry(), false, root);
    const diagram = new Diagram('diagram', 'diagram', doc);
    doc.addDiagram(diagram);

    UnitOfWork.execute(diagram, uow => {
      const layer = new RegularLayer('layer', 'Layer', [], diagram);
      diagram.layers.add(layer, uow);
      layer.addElement(ElementFactory.node({ layer, nodeType: 'rect' }), uow);
    });

    await vi.advanceTimersByTimeAsync(2500);
    await autoSave.flushPrimaryIfDirty('room-enter');

    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer.mock.calls.map(([relPath]) => relPath)).toEqual(['test.temp.json', 'test.json']);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(writer).toHaveBeenCalledTimes(2);

    autoSave.dispose();
    doc.release();
  });
});
