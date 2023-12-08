import { expect, test, describe } from 'vitest';
import { UndoManager } from './undoManager.ts';

describe('UndoManager', () => {
  test('executes action', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.execute({
      canUndo: true,
      canRedo: true,
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

  test('undo action', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.execute({
      canUndo: true,
      canRedo: true,
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

  test('redo action', () => {
    const manager = new UndoManager();
    let x = 0;

    manager.execute({
      canUndo: true,
      canRedo: true,
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
