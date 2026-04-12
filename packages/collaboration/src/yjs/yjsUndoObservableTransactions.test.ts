import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { YJSRoot } from './yjsCrdt';

describe('Yjs observable undo transactions', () => {
  it('emits map events for local undo and redo transactions', () => {
    const root = new YJSRoot();
    const map = root.getMap<{ key?: string }>('test');
    const undoManager = new Y.UndoManager(root.yData);

    const insertSpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();
    const afterSpy = vi.fn();

    map.on('remoteInsert', insertSpy);
    map.on('remoteUpdate', updateSpy);
    map.on('remoteDelete', deleteSpy);
    map.on('remoteAfterTransaction', afterSpy);

    root.transact(() => {
      map.set('key', 'value');
    });

    insertSpy.mockClear();
    updateSpy.mockClear();
    deleteSpy.mockClear();
    afterSpy.mockClear();

    undoManager.undo();

    expect(deleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'key',
        value: 'value'
      })
    );
    expect(afterSpy).toHaveBeenCalled();

    insertSpy.mockClear();
    deleteSpy.mockClear();
    afterSpy.mockClear();

    undoManager.redo();

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'key',
        value: 'value'
      })
    );
    expect(afterSpy).toHaveBeenCalled();
  });

  it('emits root transaction events for local undo and redo transactions', () => {
    const root = new YJSRoot();
    const map = root.getMap<{ key?: string }>('test');
    const undoManager = new Y.UndoManager(root.yData);

    const beforeSpy = vi.fn();
    const afterSpy = vi.fn();

    root.on('remoteBeforeTransaction', beforeSpy);
    root.on('remoteAfterTransaction', afterSpy);

    root.transact(() => {
      map.set('key', 'value');
    });

    beforeSpy.mockClear();
    afterSpy.mockClear();

    undoManager.undo();

    expect(beforeSpy).toHaveBeenCalled();
    expect(afterSpy).toHaveBeenCalled();

    beforeSpy.mockClear();
    afterSpy.mockClear();

    undoManager.redo();

    expect(beforeSpy).toHaveBeenCalled();
    expect(afterSpy).toHaveBeenCalled();
  });
});
