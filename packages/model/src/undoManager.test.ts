import { describe, expect, test } from 'vitest';
import {
  CollaborationBackendUndoManager,
  DefaultUndoManager,
  type UndoManager,
  createUndoManager
} from './undoManager';
import { TestDiagramBuilder, TestModel } from './test-support/testModel';
import { YJSRoot } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { createSyncedYJSCRDTs } from '@diagram-craft/collaboration/test-support/yjsTestUtils';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { YJSWebSocketCollaborationBackend } from '@diagram-craft/collaboration/yjs/yjsWebsocketCollaborationBackend';

const makeCounterAction = (state: { x: number }) => ({
  description: '',
  undo: () => {
    state.x--;
  },
  redo: () => {
    state.x++;
  }
});

const withYjsBackend = <T>(callback: () => T): T => {
  const backend = CollaborationConfig.Backend;
  try {
    CollaborationConfig.Backend = new YJSWebSocketCollaborationBackend('ws://localhost');
    return callback();
  } finally {
    CollaborationConfig.Backend = backend;
  }
};

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

  test('execute() records structural work as one undo step', () => {
    const d = TestModel.newDiagram();
    const manager = d.undoManager;
    const state = { x: 0 };

    manager.execute('Increment', uow => {
      uow.add({
        description: 'increment',
        undo: () => {
          state.x--;
        },
        redo: () => {
          state.x++;
        }
      });

      state.x++;
    });

    expect(state.x).toBe(1);
    expect(manager.canUndo()).toBe(true);

    manager.undo();
    expect(state.x).toBe(0);
  });

  test('beginCapture() exposes a UnitOfWork-backed capture session', () => {
    const d = TestModel.newDiagram();
    const manager = d.undoManager;
    const state = { x: 0 };
    const capture = manager.beginCapture('Increment');

    capture.uow.add({
      description: 'increment',
      undo: () => {
        state.x--;
      },
      redo: () => {
        state.x++;
      }
    });

    state.x++;
    capture.commit();

    expect(state.x).toBe(1);
    expect(manager.canUndo()).toBe(true);

    manager.undo();
    expect(state.x).toBe(0);
  });
});

describe('CollaborationBackendUndoManager', () => {
  test('execute() captures tracked local transactions for undo and redo', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ value?: number }>('undo-test');

      manager.execute('Set value', () => {
        map.set('value', 1);
      });

      expect(map.get('value')).toBe(1);
      expect(manager.canUndo()).toBe(true);

      manager.undo();
      expect(map.get('value')).toBeUndefined();
      expect(manager.canRedo()).toBe(true);

      manager.redo();
      expect(map.get('value')).toBe(1);
    });
  });

  test('beginCapture() captures long-lived tracked transactions', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ value?: number }>('undo-test');
      const capture = manager.beginCapture('Set value');

      capture.uow.add({
        description: 'set value',
        undo: () => {
          map.delete('value');
        },
        redo: () => {
          map.set('value', 1);
        }
      });
      map.set('value', 1);
      capture.commit();

      expect(map.get('value')).toBe(1);
      expect(manager.canUndo()).toBe(true);

      manager.undo();
      expect(map.get('value')).toBeUndefined();
    });
  });

  test('stopCapturing() keeps successive undoable actions separate', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ first?: number; second?: number }>('undo-test');

      manager.execute('Set first', () => {
        map.set('first', 1);
      });
      manager.execute('Set second', () => {
        map.set('second', 2);
      });

      manager.undo();
      expect(map.get('first')).toBe(1);
      expect(map.get('second')).toBeUndefined();

      manager.undo();
      expect(map.get('first')).toBeUndefined();
    });
  });

  test('untracked local transactions do not become undoable', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ value?: number }>('undo-test');

      root.transact(() => {
        map.set('value', 1);
      });

      expect(map.get('value')).toBe(1);
      expect(manager.canUndo()).toBe(false);
    });
  });

  test('addAndExecute() applies the action and records it in collaboration-backed history', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ value?: number }>('undo-test');

      manager.addAndExecute({
        description: 'Set value',
        undo: () => {},
        redo: () => {
          map.set('value', 1);
        }
      });

      expect(map.get('value')).toBe(1);

      manager.undo();
      expect(map.get('value')).toBeUndefined();

      manager.redo();
      expect(map.get('value')).toBe(1);
    });
  });

  test('setMark()/undoToMark() restores the undo depth', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ first?: number; second?: number; third?: number }>('undo-test');

      manager.execute('Set first', () => {
        map.set('first', 1);
      });
      manager.setMark('preview');
      manager.execute('Set second', () => {
        map.set('second', 2);
      });
      manager.execute('Set third', () => {
        map.set('third', 3);
      });

      manager.undoToMark('preview');

      expect(map.get('first')).toBe(1);
      expect(map.get('second')).toBeUndefined();
      expect(map.get('third')).toBeUndefined();
    });
  });

  test('beginCapture() captures long-lived UnitOfWork changes', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);
      const manager = new CollaborationBackendUndoManager(
        diagram,
        CollaborationConfig.Backend.createUndoAdapter!(root)!
      );
      const map = root.getMap<{ value?: number }>('undo-test');

      const capture = manager.beginCapture('Drag move');
      map.set('value', 1);
      capture.commit();

      expect(map.get('value')).toBe(1);
      expect(manager.canUndo()).toBe(true);

      manager.undo();
      expect(map.get('value')).toBeUndefined();
    });
  });

  test('remote replicated updates do not enter the local undo stack', () => {
    withYjsBackend(() => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();
      const document1 = TestModel.newDocument(doc1);
      const document2 = TestModel.newDocument(doc2);
      const diagram1 = new TestDiagramBuilder(document1, 'diagram-1');
      const diagram2 = new TestDiagramBuilder(document2, 'diagram-2');
      document1.addDiagram(diagram1);
      document2.addDiagram(diagram2);
      const manager1 = new CollaborationBackendUndoManager(
        diagram1,
        CollaborationConfig.Backend.createUndoAdapter!(doc1)!
      );
      const manager2 = new CollaborationBackendUndoManager(
        diagram2,
        CollaborationConfig.Backend.createUndoAdapter!(doc2)!
      );
      const map1 = doc1.getMap<{ value?: number }>('undo-test');
      const map2 = doc2.getMap<{ value?: number }>('undo-test');

      manager1.execute('Set value', () => {
        map1.set('value', 1);
      });

      expect(map2.get('value')).toBe(1);
      expect(manager2.canUndo()).toBe(false);

      manager1.undo();
      expect(map1.get('value')).toBeUndefined();
      expect(map2.get('value')).toBeUndefined();
    });
  });

  test('createUndoManager() selects the collaboration-backed implementation when available', () => {
    withYjsBackend(() => {
      const root = new YJSRoot();
      const diagram = TestModel.newDiagram(root);

      expect(createUndoManager(diagram)).toBeInstanceOf(CollaborationBackendUndoManager);
    });
  });
});
