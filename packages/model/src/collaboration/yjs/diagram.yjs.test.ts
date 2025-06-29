import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { Diagram } from '../../diagram';
import { TestModel } from '../../test-support/builder';

describe('YJS Diagram', () => {
  setupYJS();

  describe('name', () => {
    it('should update the name property correctly', () => {
      const { doc1: c1, doc2: c2 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);
      expect(d1.name).toBe('test-name');

      expect(doc2.topLevelDiagrams.length).toBe(1);

      const d2 = doc2.topLevelDiagrams[0];
      expect(d2.name).toBe('test-name');

      d1.name = 'new-test-name';
      expect(d1.name).toBe('new-test-name');
      expect(d2.name).toBe('new-test-name');
    });
  });

  describe('canvas', () => {
    it('should update the canvas property correctly', () => {
      const { doc1: c1, doc2: c2 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const d2 = doc2.topLevelDiagrams[0];

      const newCanvas = { w: 105, h: 100, x: 25, y: 20 };
      d1.canvas = { ...newCanvas };
      expect(d1.canvas).toEqual(newCanvas);
      expect(d2.canvas).toEqual(newCanvas);
    });
  });

  describe('props', () => {
    it('should update the props correctly', () => {
      const { doc1: c1, doc2: c2 } = createSyncedYJSCRDTs();

      const doc1 = TestModel.newDocument(c1);
      const doc2 = TestModel.newDocument(c2);

      const d1 = new Diagram('test-id', 'test-name', doc1);
      doc1.addDiagram(d1);

      const d2 = doc2.topLevelDiagrams[0];

      // Initial props should be empty
      expect(d1.props).toEqual({});
      expect(d2.props).toEqual({});

      // Update props on d1
      d1.updateProps(props => {
        props.grid ??= {};
        props.grid.enabled = false;
      });

      // Both d1 and d2 should have the updated props
      expect(d1.props).toEqual({ grid: { enabled: false } });
      expect(d2.props).toEqual({ grid: { enabled: false } });

      // Update props on d2
      d2.updateProps(props => {
        props.grid ??= {};
        props.grid.enabled = true;
      });

      // Both d1 and d2 should have both properties
      expect(d1.props).toEqual({ grid: { enabled: true } });
      expect(d2.props).toEqual({ grid: { enabled: true } });
    });
  });
});
