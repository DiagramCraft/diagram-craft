import { describe, expect, test } from 'vitest';
import { UndoManager } from './undoManager';
import { TestModel } from './test-support/builder';

describe('UndoManager', () => {
  test('add()', () => {
    const d = TestModel.newDiagram();
    const manager = new UndoManager(d);
    let x = 0;

    manager.add({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    expect(x).toBe(0);
    expect(manager.undoableActions.length).toBe(1);
  });

  test('addAndExecute()', () => {
    const d = TestModel.newDiagram();
    const manager = new UndoManager(d);
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    expect(x).toBe(1);
  });

  test('undo()', () => {
    const d = TestModel.newDiagram();
    const manager = new UndoManager(d);
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    manager.undo();

    expect(x).toBe(0);
  });

  test('redo()', () => {
    const d = TestModel.newDiagram();
    const manager = new UndoManager(d);
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      redo: () => {
        x++;
      }
    });

    manager.undo();
    manager.redo();

    expect(x).toBe(1);
  });
});
