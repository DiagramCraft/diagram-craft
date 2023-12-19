import { expect, test, describe } from 'vitest';
import { UndoManager } from './undoManager.ts';

describe('UndoManager', () => {
  test('add()', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.add({
      description: '',

      undo: () => {
        x--;
      },
      execute: () => {
        x++;
      }
    });

    expect(x).toBe(0);
    expect(manager.undoableActions.length).toBe(1);
  });

  test('addAndExecute()', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      execute: () => {
        x++;
      }
    });

    expect(x).toBe(1);
  });

  test('undo()', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      execute: () => {
        x++;
      }
    });

    manager.undo();

    expect(x).toBe(0);
  });

  test('redo()', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.addAndExecute({
      description: '',

      undo: () => {
        x--;
      },
      execute: () => {
        x++;
      }
    });

    manager.undo();
    manager.redo();

    expect(x).toBe(1);
  });
});
