import { describe, expect, test } from 'vitest';
import { DefaultUndoManager, type UndoManager } from './undoManager';
import { TestModel } from './test-support/testModel';

const makeCounterAction = (state: { x: number }) => ({
  description: '',
  undo: () => {
    state.x--;
  },
  redo: () => {
    state.x++;
  }
});

describe('DefaultUndoManager', () => {
  test('add()', () => {
    const d = TestModel.newDiagram();
    const manager = new DefaultUndoManager(d);
    const state = { x: 0 };

    manager.add(makeCounterAction(state));

    expect(state.x).toBe(0);
    expect(manager.undoableActions.length).toBe(1);
  });

  test('addAndExecute()', () => {
    const d = TestModel.newDiagram();
    const manager = new DefaultUndoManager(d);
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
    const manager = new DefaultUndoManager(d);
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
    const manager = new DefaultUndoManager(d);
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

  test('getToMark() supports named marks and clears them after use', () => {
    const d = TestModel.newDiagram();
    const manager = new DefaultUndoManager(d);
    const state = { x: 0 };

    manager.setMark('popup');
    manager.addAndExecute(makeCounterAction(state));
    manager.addAndExecute(makeCounterAction(state));

    const actions = manager.getToMark('popup');

    expect(actions).toHaveLength(2);
    expect(manager.undoableActions).toHaveLength(0);

    manager.addAndExecute(makeCounterAction(state));
    expect(manager.getToMark('popup')).toHaveLength(1);
  });

  test('undoToMark() supports named marks and clears them after use', () => {
    const d = TestModel.newDiagram();
    const manager = new DefaultUndoManager(d);
    const state = { x: 0 };

    manager.setMark('popup');
    manager.addAndExecute(makeCounterAction(state));
    manager.addAndExecute(makeCounterAction(state));

    expect(state.x).toBe(2);

    manager.undoToMark('popup');

    expect(state.x).toBe(0);
    expect(manager.undoableActions).toHaveLength(0);

    manager.addAndExecute(makeCounterAction(state));
    manager.undoToMark('popup');

    expect(state.x).toBe(0);
  });

  test('can be used through the UndoManager interface', () => {
    const d = TestModel.newDiagram();
    const manager: UndoManager = new DefaultUndoManager(d);
    const state = { x: 0 };

    manager.addAndExecute(makeCounterAction(state));
    manager.undo();
    manager.redo();

    expect(state.x).toBe(1);
  });

  test('canUndo() and canRedo() reflect available history through the interface', () => {
    const d = TestModel.newDiagram();
    const manager: UndoManager = new DefaultUndoManager(d);

    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    manager.addAndExecute(makeCounterAction({ x: 0 }));
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    manager.undo();
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
  });
});
