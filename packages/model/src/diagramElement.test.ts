import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestModel } from './test-support/builder';
import { RegularLayer } from './diagramLayerRegular';
import { UnitOfWork } from './unitOfWork';
import { Backends } from './collaboration/collaborationTestUtils';
import { ElementFactory } from './elementFactory';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { transformElements } from './diagramElement';
import { assertRegularLayer } from './diagramLayerUtils';

describe.for(Backends.all())('DiagramElement [%s]', ([_name, backend]) => {
  beforeEach(backend.beforeEach);
  afterEach(backend.afterEach);

  describe('id', () => {
    it('should get the right id', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      expect(element.id).toBe('id1');
      if (doc2) expect(layer1_2!.elements[0]!.id).toBe('id1');
    });
  });

  describe('type', () => {
    it('should get the right type', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      expect(element.type).toBe('node');
      if (doc2) expect(layer1_2!.elements[0]!.type).toBe('node');
    });
  });

  /*  describe('setHighlights', () => {
    it('should set highlights', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const d1 = TestModel.newDiagramWithLayer(root1);
      const layer1 = d1.layers.all[0] as RegularLayer;
      const layer1_2 = doc2?.diagrams[0].layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.highlights = ['h1', 'h2'];
      expect(element.highlights).toStrictEqual(['h1', 'h2']);
      if (doc2) expect(layer1_2!.elements[0].highlights).toStrictEqual(['h1', 'h2']);

      element.highlights = ['h3'];
      expect(element.highlights).toStrictEqual(['h3']);
      if (doc2) expect(layer1_2!.elements[0].highlights).toStrictEqual(['h3']);
    });

    it('should emit elementHighlighted event', async () => {
      const [root1, root2] = backend.syncedDocs();

      const d1 = TestModel.newDiagramWithLayer(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const layer1 = d1.layers.all[0] as RegularLayer;

      const highlightedEvent1 = vi.fn();
      const highlightedEvent2 = vi.fn();

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      d1.on('elementHighlighted', highlightedEvent1);
      doc2?.diagrams[0].on('elementHighlighted', highlightedEvent2);

      element.highlights = ['h1', 'h2'];
      await sleep(20);

      expect(highlightedEvent1).toBeCalledTimes(1);
      if (doc2) expect(highlightedEvent2).toBeCalledTimes(1);
    });
  });*/

  describe('updateMetadata', () => {
    it('should update metadata', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.updateMetadata(m => (m.style = 'lorem'), UnitOfWork.immediate(d1));

      expect(element.metadata.style).toBe('lorem');
      if (doc2) expect(layer1_2!.elements[0]!.metadata.style).toStrictEqual('lorem');
    });

    it('should emit elementChanged event', async () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const changeEvent1 = vi.fn();
      const changeEvent2 = vi.fn();

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      d1.on('elementChange', changeEvent1);
      doc2?.diagrams[0]!.on('elementChange', changeEvent2);

      UnitOfWork.execute(d1, uow => element.updateMetadata(m => (m.style = 'lorem'), uow));

      expect(changeEvent1).toBeCalledTimes(1);
      if (doc2) expect(changeEvent2).toBeCalledTimes(1);
    });
  });

  describe('tags', () => {
    it('should initialize with empty tags', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      expect(element.tags).toEqual([]);
      if (doc2) expect(layer1_2!.elements[0]!.tags).toEqual([]);
    });

    it('should get the current tags', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['important', 'draft'], UnitOfWork.immediate(d1));

      expect(element.tags).toEqual(['important', 'draft']);
      if (doc2) expect(layer1_2!.elements[0]!.tags).toEqual(['important', 'draft']);
    });
  });

  describe('setTags', () => {
    it('should set tags on element', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['tag1', 'tag2'], UnitOfWork.immediate(d1));

      expect(element.tags).toEqual(['tag1', 'tag2']);
      if (doc2) expect(layer1_2!.elements[0]!.tags).toEqual(['tag1', 'tag2']);
    });

    it('should replace existing tags', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });
      const layer1_2 = doc2?.diagrams[0]!.layers.all[0] as RegularLayer;

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['old1', 'old2'], UnitOfWork.immediate(d1));
      element.setTags(['new1', 'new2'], UnitOfWork.immediate(d1));

      expect(element.tags).toEqual(['new1', 'new2']);
      expect(element.tags).not.toContain('old1');
      expect(element.tags).not.toContain('old2');

      if (doc2) {
        expect(layer1_2!.elements[0]!.tags).toEqual(['new1', 'new2']);
        expect(layer1_2!.elements[0]!.tags).not.toContain('old1');
        expect(layer1_2!.elements[0]!.tags).not.toContain('old2');
      }
    });

    it('should trim whitespace from tags', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['  tag1  ', '\ttag2\n', 'tag3'], UnitOfWork.immediate(d1));

      expect(element.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter out empty or whitespace-only tags', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['tag1', '', '   ', 'tag2', '\t\n'], UnitOfWork.immediate(d1));

      expect(element.tags).toEqual(['tag1', 'tag2']);
    });

    it('should remove duplicates from tags', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['tag1', 'tag2', 'tag1', 'tag3'], UnitOfWork.immediate(d1));

      expect(element.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should add element tags to document tags collection', () => {
      const [root1, root2] = backend.syncedDocs();

      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      element.setTags(['element-tag1', 'element-tag2'], UnitOfWork.immediate(d1));

      expect(d1.document.tags.has('element-tag1')).toBe(true);
      expect(d1.document.tags.has('element-tag2')).toBe(true);
      expect(d1.document.tags.tags).toContain('element-tag1');
      expect(d1.document.tags.tags).toContain('element-tag2');

      if (doc2) {
        expect(doc2.diagrams[0]!.document.tags.has('element-tag1')).toBe(true);
        expect(doc2.diagrams[0]!.document.tags.has('element-tag2')).toBe(true);
        expect(doc2.diagrams[0]!.document.tags.tags).toContain('element-tag1');
        expect(doc2.diagrams[0]!.document.tags.tags).toContain('element-tag2');
      }
    });

    it('should update cache when tags are changed', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      // Put something in cache
      element.cache.set('name', 'test-value');
      expect(element.cache.get('name')).toBe('test-value');

      // Setting tags should clear the cache
      element.setTags(['test-tag'], UnitOfWork.immediate(d1));

      expect(element.cache.get('name')).toBeUndefined();
    });

    it('should handle setting empty tags array', () => {
      const [root1] = backend.syncedDocs();

      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const element = ElementFactory.emptyNode('id1', layer1);
      layer1.addElement(element, UnitOfWork.immediate(d1));

      // First set some tags
      element.setTags(['tag1', 'tag2'], UnitOfWork.immediate(d1));
      expect(element.tags).toEqual(['tag1', 'tag2']);

      // Then clear them
      element.setTags([], UnitOfWork.immediate(d1));
      expect(element.tags).toEqual([]);
    });
  });
});

describe('transformElements', () => {
  it('transform rotate', () => {
    const testBounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

    const diagram = TestModel.newDiagram();
    diagram.newLayer();

    const uow = new UnitOfWork(diagram);

    const layer = diagram.activeLayer;
    assertRegularLayer(layer);

    const node1 = ElementFactory.node('1', 'rect', testBounds, layer, {}, {});
    layer.addElement(node1, uow);

    const node2 = ElementFactory.node(
      '2',
      'rect',
      {
        x: 100,
        y: 100,
        w: 100,
        h: 100,
        r: 0
      },
      layer,
      {},
      {}
    );
    layer.addElement(node2, uow);

    const nodes = [node1, node2];

    const before = { x: 0, y: 0, w: 200, h: 200, r: 0 };
    const after = { x: 0, y: 0, w: 200, h: 200, r: Math.PI / 2 };

    transformElements(nodes, TransformFactory.fromTo(before, after), uow);
    uow.commit();

    expect(node1.bounds).toStrictEqual({ x: 100, y: 0, w: 100, h: 100, r: Math.PI / 2 });
    expect(node2.bounds).toStrictEqual({ x: 0, y: 100, w: 100, h: 100, r: Math.PI / 2 });
  });
});
