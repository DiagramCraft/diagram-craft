import { expect, test, describe } from 'vitest';
import { UndoManager } from './undoManager.ts';
import { Diagram } from './index.ts';
import { defaultEdgeRegistry, defaultNodeRegistry } from '../../main/src/canvas/defaultRegistry.ts';

describe('UndoManager', () => {
  test('add()', () => {
    const d = new Diagram('id', 'name', defaultNodeRegistry(), defaultEdgeRegistry());
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
    const d = new Diagram('id', 'name', defaultNodeRegistry(), defaultEdgeRegistry());
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
    const d = new Diagram('id', 'name', defaultNodeRegistry(), defaultEdgeRegistry());
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
    const d = new Diagram('id', 'name', defaultNodeRegistry(), defaultEdgeRegistry());
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
