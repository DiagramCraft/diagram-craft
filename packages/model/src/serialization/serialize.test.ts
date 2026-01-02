import { describe, expect, it } from 'vitest';
import { TestModel } from '../test-support/testModel';
import { serializeDiagramElement } from './serialize';
import { UOW } from '@diagram-craft/model/uow';

describe('serializeDiagramElement', () => {
  describe('tags', () => {
    it('should serialize node with tags', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const node = diagram.newLayer().addNode();
      const tags = ['tag1', 'tag2', 'important'];
      UOW.execute(diagram, () => node.setTags(tags, UOW.uow()));

      // Act
      const serialized = serializeDiagramElement(node);

      // Verify
      expect(serialized.tags).toEqual(tags);
    });

    it('should serialize edge with tags', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const edge = diagram.newLayer().addEdge();
      const tags = ['connection', 'flow', 'critical'];
      UOW.execute(diagram, () => edge.setTags(tags, UOW.uow()));

      // Act
      const serialized = serializeDiagramElement(edge);

      // Verify
      expect(serialized.tags).toEqual(tags);
    });

    it('should not serialize tags property when element has no tags', () => {
      // Setup
      const layer = TestModel.newDiagram().newLayer();
      const node = layer.addNode();

      // Act
      const serialized = serializeDiagramElement(node);

      // Verify
      expect(serialized.tags).toBeUndefined();
    });

    it('should serialize empty tags as undefined', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const node = diagram.newLayer().addNode();
      UOW.execute(diagram, () => node.setTags([], UOW.uow()));

      // Act
      const serialized = serializeDiagramElement(node);

      // Verify
      expect(serialized.tags).toBeUndefined();
    });
  });
});
