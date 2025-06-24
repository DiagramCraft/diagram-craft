import { describe, expect, it } from 'vitest';
import { Diagram, DiagramCRDT } from './diagram';
import { TestModel } from './test-support/builder';
import { NoOpCRDTMap } from './collaboration/noopCrdt';

describe('Diagram', () => {
  describe('constructor', () => {
    it('should initialize correctly using the constructor', () => {
      const doc = TestModel.newDocument();
      const diagram = new Diagram('test-id', 'test-name', doc, new NoOpCRDTMap<DiagramCRDT>());
      expect(diagram.id).toBe('test-id');
      expect(diagram.name).toBe('test-name');
      expect(diagram.document).toBe(doc);
    });
  });

  describe('name', () => {
    it('should update the name property correctly', () => {
      const doc = TestModel.newDocument();
      const diagram = new Diagram('test-id', 'test-name', doc, new NoOpCRDTMap<DiagramCRDT>());
      expect(diagram.name).toBe('test-name');

      diagram.name = 'new-test-name';
      expect(diagram.name).toBe('new-test-name');
    });
  });

  describe('toJSON', () => {
    it('should correctly serialize to JSON', () => {
      const doc = TestModel.newDocument();
      const diagram = new Diagram('test-id', 'test-name', doc, new NoOpCRDTMap<DiagramCRDT>());
      const json = diagram.toJSON();

      expect(json).toEqual({
        diagrams: diagram.diagrams,
        props: diagram.props,
        selectionState: diagram.selectionState,
        id: diagram.id,
        name: diagram.name,
        layers: diagram.layers
      });
    });
  });
});
