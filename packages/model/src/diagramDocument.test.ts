import { describe, expect, it } from 'vitest';
import { TestDiagramBuilder, TestModel } from './test-support/builder';

describe('DiagramDocument', () => {
  describe('addDiagram', () => {
    it('should add a diagram at the root level', () => {
      const document = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(document);

      document.addDiagram(diagram);

      expect(document.topLevelDiagrams).toContain(diagram);
    });

    it('should add a nested diagram under a parent diagram', () => {
      const document = TestModel.newDocument();
      const parentDiagram = new TestDiagramBuilder(document, 'parent');
      const childDiagram = new TestDiagramBuilder(document, 'child');

      document.addDiagram(parentDiagram);
      document.addDiagram(childDiagram, parentDiagram);

      expect(parentDiagram.diagrams).toContain(childDiagram);
    });
  });

  describe('removeDiagram', () => {
    it('should remove a diagram from the root level', () => {
      const document = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(document);

      document.addDiagram(diagram);
      document.removeDiagram(diagram);

      expect(document.topLevelDiagrams).not.toContain(diagram);
    });

    it('should remove a nested diagram from a parent diagram', () => {
      const document = TestModel.newDocument();
      const parentDiagram = new TestDiagramBuilder(document, 'parent');
      const childDiagram = new TestDiagramBuilder(document, 'child');

      document.addDiagram(parentDiagram);
      document.addDiagram(childDiagram, parentDiagram);
      document.removeDiagram(childDiagram);

      expect(parentDiagram.diagrams).not.toContain(childDiagram);
    });
  });

  describe('toJSON', () => {
    it('should correctly serialize the document to JSON', () => {
      const document = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(document);
      const expected = {
        diagrams: [diagram],
        styles: document.styles,
        props: document.props,
        customPalette: document.customPalette
      };

      document.addDiagram(diagram);

      expect(document.toJSON()).toEqual(expected);
    });
  });

  describe('getById', () => {
    it('should return the diagram with the specified ID', () => {
      const document = TestModel.newDocument();

      const diagram1 = new TestDiagramBuilder(document, 'diagram1');
      const diagram2 = new TestDiagramBuilder(document, 'diagram2');
      document.addDiagram(diagram1);
      document.addDiagram(diagram2);

      const result = document.getById('diagram1');
      expect(result).toBe(diagram1);
    });

    it('should return the diagram with the specified ID for nested diagrams', () => {
      const document = TestModel.newDocument();

      const diagram1 = new TestDiagramBuilder(document, 'diagram1');
      const diagram2 = new TestDiagramBuilder(document, 'diagram2');

      document.addDiagram(diagram1);
      document.addDiagram(diagram2, diagram1);

      const result = document.getById('diagram2');
      expect(result).toBe(diagram2);
    });

    it('should return undefined if no diagram with the specified ID is found', () => {
      const document = TestModel.newDocument();

      const diagram = TestModel.newDiagram();
      document.addDiagram(diagram);

      const result = document.getById('nonExistentId');
      expect(result).toBeUndefined();
    });

    it('should return undefined when no diagrams are present', () => {
      const document = TestModel.newDocument();

      const result = document.getById('anyId');
      expect(result).toBeUndefined();
    });
  });
});
