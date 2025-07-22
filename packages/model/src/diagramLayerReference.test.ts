import { describe, expect, it } from 'vitest';
import { ReferenceLayer } from './diagramLayerReference';
import { UnitOfWork } from './unitOfWork';
import { RegularLayer } from './diagramLayerRegular';
import { TestModel } from './test-support/builder';

describe('ReferenceLayer', () => {
  describe('constructor', () => {
    it('should initialize correctly with given reference', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const targetLayer = diagram.newLayer('target-layer');

      // Act
      const reference = {
        layerId: targetLayer.id,
        diagramId: diagram.id
      };
      const referenceLayer = new ReferenceLayer('ref-layer', 'Reference Layer', diagram, reference);

      // Verify
      expect(referenceLayer.id).toBe('ref-layer');
      expect(referenceLayer.name).toBe('Reference Layer');
      expect(referenceLayer.type).toBe('reference');
      expect(referenceLayer.reference).toEqual(reference);
      expect(referenceLayer.isLocked()).toBe(true);
    });
  });

  describe('referenceName', () => {
    it('should return a formatted name combining diagram and layer names', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const targetLayer = diagram.newLayer('target-layer');

      const reference = {
        layerId: targetLayer.id,
        diagramId: diagram.id
      };

      const referenceLayer = new ReferenceLayer('ref-layer', 'Reference Layer', diagram, reference);

      // Verify
      expect(referenceLayer.referenceName()).toBe(`${diagram.name} / ${targetLayer.name}`);
    });
  });

  describe('resolve', () => {
    it('should return the referenced layer', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const targetLayer = diagram.newLayer('target-layer');

      const reference = {
        layerId: targetLayer.id,
        diagramId: diagram.id
      };

      const referenceLayer = new ReferenceLayer('ref-layer', 'Reference Layer', diagram, reference);

      // Verify
      const resolvedLayer = referenceLayer.resolve();
      expect(resolvedLayer).toBe(targetLayer);
    });

    it('should return undefined if the referenced layer does not exist', () => {
      // Setup
      const diagram = TestModel.newDiagram();

      const reference = {
        layerId: 'non-existent-layer',
        diagramId: diagram.id
      };

      const referenceLayer = new ReferenceLayer('ref-layer', 'Reference Layer', diagram, reference);

      // Verify
      const resolvedLayer = referenceLayer.resolve();
      expect(resolvedLayer).toBeUndefined();
    });
  });

  describe('snapshot and restore', () => {
    it('should create a snapshot with reference information and restore from it', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const targetLayer = new RegularLayer('target-layer', 'Target Layer', [], diagram);
      diagram.layers.add(targetLayer, UnitOfWork.immediate(diagram));

      const reference = {
        layerId: targetLayer.id,
        diagramId: diagram.id
      };

      const referenceLayer = new ReferenceLayer('ref-layer', 'Reference Layer', diagram, reference);
      diagram.layers.add(referenceLayer, UnitOfWork.immediate(diagram));

      // Act
      const snapshot = referenceLayer.snapshot();

      // Verify
      expect(snapshot.reference).toEqual(reference);
      expect(snapshot._snapshotType).toBe('layer');
      expect(snapshot.name).toBe('Reference Layer');
      expect(snapshot.type).toBe('reference');
    });
  });
});
