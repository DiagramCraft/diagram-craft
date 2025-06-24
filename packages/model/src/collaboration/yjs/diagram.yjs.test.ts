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
});
