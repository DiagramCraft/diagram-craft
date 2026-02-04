import { describe, expect, it } from 'vitest';
import { UnitOfWork } from './unitOfWork';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('Layer [%s]', (_name, backend) => {
  describe('setName', () => {
    it('should set the name of a layer', () => {
      const { diagram1, layer1, layer2 } = standardTestModel(backend);

      const originalName = layer1.name;
      const newName = 'New Name';

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Rename', uow => layer1.setName(newName, uow));

      // Verify
      expect(layer1.name).toBe(newName);
      if (layer2) expect(layer2.name).toBe(newName);

      // Act
      diagram1.undoManager.undo();

      // Verify
      expect(layer1.name).toBe(originalName);
      if (layer2) expect(layer2.name).toBe(originalName);

      // Act
      diagram1.undoManager.redo();

      // Verify
      expect(layer1.name).toBe(newName);
      if (layer2) expect(layer2.name).toBe(newName);
    });
  });

  describe('setLocked', () => {
    it('should set the locked state of a layer', () => {
      const { diagram1, layer1 } = standardTestModel(backend);

      const originalLocked = layer1.isLocked();

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Lock', uow => layer1.setLocked(true, uow));

      // Verify
      expect(layer1.isLocked()).toBe(true);

      // Act
      diagram1.undoManager.undo();

      // Verify
      expect(layer1.isLocked()).toBe(originalLocked);

      // Act
      diagram1.undoManager.redo();

      // Verify
      expect(layer1.isLocked()).toBe(true);
    });
  });
});
