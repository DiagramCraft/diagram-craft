import { describe, expect, it } from 'vitest';
import { TestDiagramBuilder, TestModel } from './test-support/testModel';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('DiagramDocument [%s]', (_name, backend) => {
  describe('addDiagram', () => {
    it('should add a diagram at the root level', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      // Act
      const diagram = new TestDiagramBuilder(doc1);
      doc1.addDiagram(diagram);

      // Verify
      expect(doc1.diagrams).toHaveLength(1);
      expect(doc1.diagrams).toContain(diagram);
      if (doc2) expect(doc2.diagrams).toHaveLength(1);
    });

    it('should add a nested diagram under a parent diagram', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const parentDiagram = new TestDiagramBuilder(doc1, 'parent');
      doc1.addDiagram(parentDiagram);

      // Act
      const childDiagram = new TestDiagramBuilder(doc1, 'child');
      doc1.addDiagram(childDiagram, parentDiagram);

      // Verify
      expect(parentDiagram.diagrams).toContain(childDiagram);
      if (doc2) expect(doc2.diagrams[0]!.diagrams).toHaveLength(1);
    });
  });

  describe('removeDiagram', () => {
    it('should remove a diagram from the root level', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const diagram = new TestDiagramBuilder(doc1);
      doc1.addDiagram(diagram);

      // Act
      doc1.removeDiagram(diagram);

      // Verify
      expect(doc1.diagrams).toHaveLength(0);
      expect(doc1.diagrams).not.toContain(diagram);
      if (doc2) expect(doc2.diagrams).toHaveLength(0);
    });

    it('should remove a nested diagram from a parent diagram', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const doc1 = TestModel.newDocument(root1);
      const doc2 = root2 ? TestModel.newDocument(root2) : undefined;

      const parentDiagram = new TestDiagramBuilder(doc1, 'parent');
      doc1.addDiagram(parentDiagram);

      const childDiagram = new TestDiagramBuilder(doc1, 'child');

      // Act
      doc1.removeDiagram(childDiagram);

      expect(parentDiagram.diagrams).not.toContain(childDiagram);
      if (doc2) expect(doc2.diagrams[0]!.diagrams).toHaveLength(0);
    });
  });

  describe('byId', () => {
    it('should return the diagram with the specified ID', () => {
      const document = TestModel.newDocument();

      const diagram1 = new TestDiagramBuilder(document, 'diagram1');
      const diagram2 = new TestDiagramBuilder(document, 'diagram2');
      document.addDiagram(diagram1);
      document.addDiagram(diagram2);

      const result = document.byId('diagram1');
      expect(result).toBe(diagram1);
    });

    it('should return the diagram with the specified ID for nested diagrams', () => {
      const document = TestModel.newDocument();

      const diagram1 = new TestDiagramBuilder(document, 'diagram1');
      const diagram2 = new TestDiagramBuilder(document, 'diagram2');

      document.addDiagram(diagram1);
      document.addDiagram(diagram2, diagram1);

      const result = document.byId('diagram2');
      expect(result).toBe(diagram2);
    });

    it('should return undefined if no diagram with the specified ID is found', () => {
      const document = TestModel.newDocument();

      const diagram = TestModel.newDiagram();
      document.addDiagram(diagram);

      const result = document.byId('nonExistentId');
      expect(result).toBeUndefined();
    });

    it('should return undefined when no diagrams are present', () => {
      const document = TestModel.newDocument();

      const result = document.byId('anyId');
      expect(result).toBeUndefined();
    });
  });

  describe('getDiagramPath', () => {
    it('should return a path containing only the diagram for a root-level diagram', () => {
      // Setup
      const document = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(document, 'diagram');
      document.addDiagram(diagram);

      // Act
      const path = document.getDiagramPath(diagram);

      // Verify
      expect(path).toHaveLength(1);
      expect(path[0]).toBe(diagram);
    });

    it('should return a path from root to a nested diagram', () => {
      // Setup
      const document = TestModel.newDocument();
      const rootDiagram = new TestDiagramBuilder(document, 'root');
      const midDiagram = new TestDiagramBuilder(document, 'mid');
      const leafDiagram = new TestDiagramBuilder(document, 'leaf');

      document.addDiagram(rootDiagram);
      document.addDiagram(midDiagram, rootDiagram);
      document.addDiagram(leafDiagram, midDiagram);

      // Act
      const path = document.getDiagramPath(leafDiagram);

      // Verify
      expect(path).toHaveLength(3);
      expect(path[0]).toBe(rootDiagram);
      expect(path[1]).toBe(midDiagram);
      expect(path[2]).toBe(leafDiagram);
    });

    it('should return an empty array if the diagram is not found', () => {
      // Setup
      const document = TestModel.newDocument();
      const diagram1 = new TestDiagramBuilder(document, 'diagram1');
      document.addDiagram(diagram1);

      const unaddedDiagram = new TestDiagramBuilder(document, 'unadded');

      // Act
      const path = document.getDiagramPath(unaddedDiagram);

      // Verify
      expect(path).toHaveLength(0);
    });

    it('should find a path starting from a specific diagram', () => {
      // Setup
      const document = TestModel.newDocument();
      const rootDiagram = new TestDiagramBuilder(document, 'root');
      const branch1 = new TestDiagramBuilder(document, 'branch1');
      const branch2 = new TestDiagramBuilder(document, 'branch2');
      const leafDiagram = new TestDiagramBuilder(document, 'leaf');

      document.addDiagram(rootDiagram);
      document.addDiagram(branch1, rootDiagram);
      document.addDiagram(branch2, rootDiagram);
      document.addDiagram(leafDiagram, branch2);

      // Act
      const path = document.getDiagramPath(leafDiagram, branch2);

      // Verify
      expect(path).toHaveLength(1);
      expect(path[0]).toBe(leafDiagram);
    });
  });

  describe('moveDiagram', () => {
    it('should reorder root-level diagrams (before/after) and emit diagramChanged for the moved diagram', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const doc = TestModel.newDocument(root1);

      const a = new TestDiagramBuilder(doc, 'a');
      const b = new TestDiagramBuilder(doc, 'b');
      const c = new TestDiagramBuilder(doc, 'c');

      doc.addDiagram(a);
      doc.addDiagram(b);
      doc.addDiagram(c);

      const changed: string[] = [];
      doc.on('diagramChanged', e => changed.push(e.diagram.id));

      // Act: move c before a => [c, a, b]
      doc.moveDiagram(c, { diagram: a, relation: 'before' });

      // Verify
      expect(doc.diagrams.map(d => d.id)).toEqual(['c', 'a', 'b']);
      expect(changed).toEqual(['c']);

      // Act: move a after b => [c, b, a]
      doc.moveDiagram(a, { diagram: b, relation: 'after' });

      // Verify
      expect(doc.diagrams.map(d => d.id)).toEqual(['c', 'b', 'a']);
      expect(changed).toEqual(['c', 'a']);
    });

    it('should reorder nested diagrams only within their parent', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const doc = TestModel.newDocument(root1);

      const parent = new TestDiagramBuilder(doc, 'parent');
      doc.addDiagram(parent);

      const c1 = new TestDiagramBuilder(doc, 'c1');
      const c2 = new TestDiagramBuilder(doc, 'c2');
      const c3 = new TestDiagramBuilder(doc, 'c3');

      doc.addDiagram(c1, parent);
      doc.addDiagram(c2, parent);
      doc.addDiagram(c3, parent);

      // Sanity
      expect(parent.diagrams.map(d => d.id)).toEqual(['c1', 'c2', 'c3']);

      // Act: move c1 after c3 => [c2, c3, c1]
      doc.moveDiagram(c1, { diagram: c3, relation: 'after' });

      // Verify
      expect(parent.diagrams.map(d => d.id)).toEqual(['c2', 'c3', 'c1']);
    });

    it('should not change the root diagram ordering when reordering children under a parent', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const doc = TestModel.newDocument(root1);

      const r1 = new TestDiagramBuilder(doc, 'r1');
      const parent = new TestDiagramBuilder(doc, 'parent');
      const r2 = new TestDiagramBuilder(doc, 'r2');

      doc.addDiagram(r1);
      doc.addDiagram(parent);
      doc.addDiagram(r2);

      const c1 = new TestDiagramBuilder(doc, 'c1');
      const c2 = new TestDiagramBuilder(doc, 'c2');
      doc.addDiagram(c1, parent);
      doc.addDiagram(c2, parent);

      // Act: reorder children
      doc.moveDiagram(c2, { diagram: c1, relation: 'before' });

      // Verify: root order unchanged
      expect(doc.diagrams.map(d => d.id)).toEqual(['r1', 'parent', 'r2']);
      expect(parent.diagrams.map(d => d.id)).toEqual(['c2', 'c1']);
    });
  });
});
