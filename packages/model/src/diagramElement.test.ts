import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestModel } from './test-support/testModel';
import { RegularLayer } from './diagramLayerRegular';
import { UnitOfWork } from './unitOfWork';
import { ElementFactory } from './elementFactory';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { transformElements, findCommonAncestor } from './diagramElement';
import { assertRegularLayer } from './diagramLayerUtils';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

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

  describe('findCommonAncestor', () => {
    it('should return direct parent when both elements share same parent', () => {
      const [root1] = backend.syncedDocs();
      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const parent = ElementFactory.emptyNode('parent', layer1);
      const child1 = ElementFactory.emptyNode('child1', layer1);
      const child2 = ElementFactory.emptyNode('child2', layer1);

      UnitOfWork.execute(d1, uow => {
        layer1.addElement(parent, uow);
        parent.addChild(child1, uow);
        parent.addChild(child2, uow);
      });

      const lca = findCommonAncestor(child1, child2);
      expect(lca).toBe(parent);
    });

    it('should return grandparent when elements have different parents', () => {
      const [root1] = backend.syncedDocs();
      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const grandparent = ElementFactory.emptyNode('grandparent', layer1);
      const parent1 = ElementFactory.emptyNode('parent1', layer1);
      const parent2 = ElementFactory.emptyNode('parent2', layer1);
      const child1 = ElementFactory.emptyNode('child1', layer1);
      const child2 = ElementFactory.emptyNode('child2', layer1);

      UnitOfWork.execute(d1, uow => {
        layer1.addElement(grandparent, uow);
        grandparent.addChild(parent1, uow);
        grandparent.addChild(parent2, uow);
        parent1.addChild(child1, uow);
        parent2.addChild(child2, uow);
      });

      const lca = findCommonAncestor(child1, child2);
      expect(lca).toBe(grandparent);
    });

    it('should return undefined when no common ancestor exists', () => {
      const [root1] = backend.syncedDocs();
      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const parent1 = ElementFactory.emptyNode('parent1', layer1);
      const parent2 = ElementFactory.emptyNode('parent2', layer1);
      const child1 = ElementFactory.emptyNode('child1', layer1);
      const child2 = ElementFactory.emptyNode('child2', layer1);

      UnitOfWork.execute(d1, uow => {
        layer1.addElement(parent1, uow);
        layer1.addElement(parent2, uow);
        parent1.addChild(child1, uow);
        parent2.addChild(child2, uow);
      });

      const lca = findCommonAncestor(child1, child2);
      expect(lca).toBeUndefined();
    });

    it('should return undefined when one element is ancestor of another', () => {
      const [root1] = backend.syncedDocs();
      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const parent = ElementFactory.emptyNode('parent', layer1);
      const child = ElementFactory.emptyNode('child', layer1);
      const grandchild = ElementFactory.emptyNode('grandchild', layer1);

      UnitOfWork.execute(d1, uow => {
        layer1.addElement(parent, uow);
        parent.addChild(child, uow);
        child.addChild(grandchild, uow);
      });

      const lca = findCommonAncestor(parent, grandchild);
      expect(lca).toBeUndefined();
    });

    it('should return undefined when both elements are at layer level', () => {
      const [root1] = backend.syncedDocs();
      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const node1 = ElementFactory.emptyNode('node1', layer1);
      const node2 = ElementFactory.emptyNode('node2', layer1);

      UnitOfWork.execute(d1, uow => {
        layer1.addElement(node1, uow);
        layer1.addElement(node2, uow);
      });

      const lca = findCommonAncestor(node1, node2);
      expect(lca).toBeUndefined();
    });

    it('should find common ancestor in deep nesting', () => {
      const [root1] = backend.syncedDocs();
      const { diagram: d1, layer: layer1 } = TestModel.newDiagramWithLayer({ root: root1 });

      const root = ElementFactory.emptyNode('root', layer1);
      const a = ElementFactory.emptyNode('a', layer1);
      const b = ElementFactory.emptyNode('b', layer1);
      const c = ElementFactory.emptyNode('c', layer1);
      const node1 = ElementFactory.emptyNode('node1', layer1);
      const node2 = ElementFactory.emptyNode('node2', layer1);

      UnitOfWork.execute(d1, uow => {
        layer1.addElement(root, uow);
        root.addChild(a, uow);
        a.addChild(b, uow);
        b.addChild(node1, uow);
        root.addChild(c, uow);
        c.addChild(node2, uow);
      });

      const lca = findCommonAncestor(node1, node2);
      expect(lca).toBe(root);
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
