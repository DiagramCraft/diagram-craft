import { describe, expect, test } from 'vitest';
import {
  CreateGuideUndoableAction,
  DeleteGuideUndoableAction,
  EditGuideUndoableAction,
  MoveGuideUndoableAction
} from './guides';
import { TestModel } from './test-support/testModel';
import { Guide, GuideType } from './types';

describe('Guide Undoable Actions', () => {
  const createTestGuide = (
    type: GuideType = 'horizontal',
    position: number = 100,
    color: string = '#3b82f6',
    id?: string
  ): Guide => ({
    id: id ?? `test-guide-${type}-${position}`,
    type,
    position,
    color
  });

  describe('CreateGuideUndoableAction', () => {
    test('should add guide on redo and remove on undo', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide();
      const action = new CreateGuideUndoableAction(diagram, guide);

      // Verify initial state
      expect(diagram.guides).toHaveLength(0);

      // Act & Verify: Redo should add the guide
      action.redo();
      expect(diagram.guides).toHaveLength(1);
      expect(diagram.guides[0]).toEqual(guide);

      // Act & Verify: Undo should remove the guide
      action.undo();
      expect(diagram.guides).toHaveLength(0);

      // Act & Verify: Redo again should add it back
      action.redo();
      expect(diagram.guides).toHaveLength(1);
      expect(diagram.guides[0]).toEqual(guide);
    });

    test('should work with different guide types', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const horizontalGuide = createTestGuide('horizontal', 50, '#ff0000');
      const verticalGuide = createTestGuide('vertical', 75, '#00ff00');
      const action1 = new CreateGuideUndoableAction(diagram, horizontalGuide);
      const action2 = new CreateGuideUndoableAction(diagram, verticalGuide);

      // Act
      action1.redo();
      action2.redo();

      // Verify
      expect(diagram.guides).toHaveLength(2);
      expect(diagram.guides.find(g => g.type === 'horizontal')).toEqual(horizontalGuide);
      expect(diagram.guides.find(g => g.type === 'vertical')).toEqual(verticalGuide);
    });
  });

  describe('DeleteGuideUndoableAction', () => {
    test('should remove guide on redo and restore on undo', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide();
      diagram.addGuide(guide);
      const action = new DeleteGuideUndoableAction(diagram, guide);

      // Verify initial state
      expect(diagram.guides).toHaveLength(1);

      // Act & Verify: Redo should remove the guide
      action.redo();
      expect(diagram.guides).toHaveLength(0);

      // Act & Verify: Undo should restore the guide
      action.undo();
      expect(diagram.guides).toHaveLength(1);
      expect(diagram.guides[0]).toEqual(guide);

      // Act & Verify: Redo again should remove it
      action.redo();
      expect(diagram.guides).toHaveLength(0);
    });

    test('should preserve guide properties when restoring', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('vertical', 150, '#purple');
      diagram.addGuide(guide);
      const action = new DeleteGuideUndoableAction(diagram, guide);

      // Act
      action.redo(); // Delete
      action.undo(); // Restore

      // Verify
      const restoredGuide = diagram.guides[0]!;
      expect(restoredGuide.id).toBe(guide.id);
      expect(restoredGuide.type).toBe('vertical');
      expect(restoredGuide.position).toBe(150);
      expect(restoredGuide.color).toBe('#purple');
    });
  });

  describe('MoveGuideUndoableAction', () => {
    test('should update guide position on redo and restore on undo', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 100);
      diagram.addGuide(guide);
      const action = new MoveGuideUndoableAction(diagram, guide, 100, 200);

      // Act & Verify: Redo should move to new position
      action.redo();
      const movedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(movedGuide?.position).toBe(200);

      // Act & Verify: Undo should restore original position
      action.undo();
      const restoredGuide = diagram.guides.find(g => g.id === guide.id);
      expect(restoredGuide?.position).toBe(100);

      // Act & Verify: Redo again should move to new position
      action.redo();
      const finalGuide = diagram.guides.find(g => g.id === guide.id);
      expect(finalGuide?.position).toBe(200);
    });

    test('should only affect position, not other properties', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('vertical', 50, '#green');
      diagram.addGuide(guide);
      const action = new MoveGuideUndoableAction(diagram, guide, 50, 150);

      // Act
      action.redo();

      // Verify
      const updatedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(updatedGuide?.id).toBe(guide.id);
      expect(updatedGuide?.type).toBe('vertical');
      expect(updatedGuide?.position).toBe(150);
      expect(updatedGuide?.color).toBe('#green');
    });

    test('should handle multiple position changes correctly', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 10);
      diagram.addGuide(guide);
      const action1 = new MoveGuideUndoableAction(diagram, guide, 10, 20);
      const action2 = new MoveGuideUndoableAction(diagram, guide, 20, 30);

      // Act & Verify: Sequential moves
      action1.redo(); // 10 -> 20
      expect(diagram.guides.find(g => g.id === guide.id)?.position).toBe(20);

      action2.redo(); // 20 -> 30
      expect(diagram.guides.find(g => g.id === guide.id)?.position).toBe(30);

      // Act & Verify: Sequential undos
      action2.undo(); // 30 -> 20
      expect(diagram.guides.find(g => g.id === guide.id)?.position).toBe(20);

      action1.undo(); // 20 -> 10
      expect(diagram.guides.find(g => g.id === guide.id)?.position).toBe(10);
    });
  });

  describe('EditGuideUndoableAction', () => {
    test('should update guide properties on redo and restore on undo', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 100, '#blue');
      diagram.addGuide(guide);
      const action = new EditGuideUndoableAction(
        diagram,
        guide,
        { color: '#blue' },
        { color: '#red' }
      );

      // Act & Verify: Redo should update color
      action.redo();
      const updatedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(updatedGuide?.color).toBe('#red');

      // Act & Verify: Undo should restore original color
      action.undo();
      const restoredGuide = diagram.guides.find(g => g.id === guide.id);
      expect(restoredGuide?.color).toBe('#blue');
    });

    test('should handle type changes', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 100);
      diagram.addGuide(guide);
      const action = new EditGuideUndoableAction(
        diagram,
        guide,
        { type: 'horizontal' },
        { type: 'vertical' }
      );

      // Act & Verify: Redo should change type
      action.redo();
      const updatedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(updatedGuide?.type).toBe('vertical');

      // Act & Verify: Undo should restore original type
      action.undo();
      const restoredGuide = diagram.guides.find(g => g.id === guide.id);
      expect(restoredGuide?.type).toBe('horizontal');
    });

    test('should handle multiple property changes', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 100, '#blue');
      diagram.addGuide(guide);
      const action = new EditGuideUndoableAction(
        diagram,
        guide,
        { type: 'horizontal', color: '#blue' },
        { type: 'vertical', color: '#red' }
      );

      // Act
      action.redo();

      // Verify: Both properties should be updated
      const updatedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(updatedGuide?.type).toBe('vertical');
      expect(updatedGuide?.color).toBe('#red');

      // Act
      action.undo();

      // Verify: Both properties should be restored
      const restoredGuide = diagram.guides.find(g => g.id === guide.id);
      expect(restoredGuide?.type).toBe('horizontal');
      expect(restoredGuide?.color).toBe('#blue');
    });

    test('should not affect unspecified properties', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 100, '#blue');
      diagram.addGuide(guide);
      const action = new EditGuideUndoableAction(
        diagram,
        guide,
        { color: '#blue' },
        { color: '#green' }
      );

      // Act
      action.redo();

      // Verify: Only specified property should change
      const updatedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(updatedGuide?.type).toBe('horizontal'); // unchanged
      expect(updatedGuide?.position).toBe(100); // unchanged
      expect(updatedGuide?.color).toBe('#green'); // changed
    });
  });

  describe('Integration with UndoManager', () => {
    test('should work correctly with undo manager add()', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide();
      const action = new CreateGuideUndoableAction(diagram, guide);

      // Act
      diagram.undoManager.add(action);

      // Verify
      expect(diagram.guides).toHaveLength(0);
      expect(diagram.undoManager.undoableActions).toHaveLength(1);
    });

    test('should work correctly with undo manager addAndExecute()', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide();
      const action = new CreateGuideUndoableAction(diagram, guide);

      // Act
      diagram.undoManager.addAndExecute(action);

      // Verify
      expect(diagram.guides).toHaveLength(1);
      expect(diagram.guides[0]).toEqual(guide);
      expect(diagram.undoManager.undoableActions).toHaveLength(1);
    });

    test('should work correctly with undo manager undo/redo', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide();
      const action = new CreateGuideUndoableAction(diagram, guide);

      // Act & Verify: Execute action
      diagram.undoManager.addAndExecute(action);
      expect(diagram.guides).toHaveLength(1);

      // Act & Verify: Undo action
      diagram.undoManager.undo();
      expect(diagram.guides).toHaveLength(0);

      // Act & Verify: Redo action
      diagram.undoManager.redo();
      expect(diagram.guides).toHaveLength(1);
    });

    test('should handle complex sequence of guide operations', () => {
      // Setup
      const diagram = TestModel.newDiagram();
      const guide = createTestGuide('horizontal', 50, '#blue');

      // Act: Create a guide
      const createAction = new CreateGuideUndoableAction(diagram, guide);
      diagram.undoManager.addAndExecute(createAction);

      // Act: Move the guide
      const moveAction = new MoveGuideUndoableAction(diagram, guide, 50, 100);
      diagram.undoManager.addAndExecute(moveAction);

      // Act: Change guide color
      const editAction = new EditGuideUndoableAction(
        diagram,
        guide,
        { color: '#blue' },
        { color: '#red' }
      );
      diagram.undoManager.addAndExecute(editAction);

      // Act: Delete the guide (get current state before deletion)
      const currentGuide = diagram.guides.find(g => g.id === guide.id)!;
      const deleteAction = new DeleteGuideUndoableAction(diagram, currentGuide);
      diagram.undoManager.addAndExecute(deleteAction);

      // Verify: All operations completed
      expect(diagram.guides).toHaveLength(0);

      // Act & Verify: Undo all operations in reverse order
      diagram.undoManager.undo(); // Restore guide
      expect(diagram.guides).toHaveLength(1);
      const restoredGuide = diagram.guides.find(g => g.id === guide.id)!;
      expect(restoredGuide.color).toBe('#red');

      diagram.undoManager.undo(); // Undo color change
      expect(diagram.guides[0]!.color).toBe('#blue');

      diagram.undoManager.undo(); // Undo move
      expect(diagram.guides[0]!.position).toBe(50);

      diagram.undoManager.undo(); // Undo create
      expect(diagram.guides).toHaveLength(0);

      // Act & Verify: Redo all operations
      diagram.undoManager.redo(); // Create
      expect(diagram.guides).toHaveLength(1);

      diagram.undoManager.redo(); // Move
      expect(diagram.guides[0]!.position).toBe(100);

      diagram.undoManager.redo(); // Edit color
      expect(diagram.guides[0]!.color).toBe('#red');

      diagram.undoManager.redo(); // Delete
      expect(diagram.guides).toHaveLength(0);
    });
  });
});
