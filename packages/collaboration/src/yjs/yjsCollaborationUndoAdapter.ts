import { EventEmitter } from '@diagram-craft/utils/event';
import type { CRDTRoot } from '../crdt';
import type {
  CollaborationUndoAdapter,
  CollaborationUndoAdapterEvents
} from '../collaborationUndoAdapter';
import { YJSRoot } from './yjsCrdt';
import * as Y from 'yjs';

const YJS_UNDO_ORIGIN = Symbol('diagram-craft-yjs-undo-origin');

export class YjsCollaborationUndoAdapter
  extends EventEmitter<CollaborationUndoAdapterEvents>
  implements CollaborationUndoAdapter
{
  readonly #undoManager: Y.UndoManager;

  constructor(root: YJSRoot) {
    super();

    this.#undoManager = new Y.UndoManager(root.yData, {
      trackedOrigins: new Set([YJS_UNDO_ORIGIN])
    });

    this.#undoManager.on('stack-item-added', event => {
      this.emit('stackItemAdded', { ...event, tracked: event.origin === YJS_UNDO_ORIGIN });
    });
    this.#undoManager.on('stack-item-updated', event => {
      this.emit('stackItemUpdated', { ...event, tracked: event.origin === YJS_UNDO_ORIGIN });
    });
    this.#undoManager.on('stack-item-popped', event => {
      this.emit('stackItemPopped', { ...event, tracked: event.origin === YJS_UNDO_ORIGIN });
    });
    this.#undoManager.on('stack-cleared', event => {
      this.emit('stackCleared', event);
    });
  }

  release() {
    this.#undoManager.destroy();
  }

  undo() {
    this.#undoManager.undo();
  }

  redo() {
    this.#undoManager.redo();
  }

  canUndo() {
    return this.#undoManager.canUndo();
  }

  canRedo() {
    return this.#undoManager.canRedo();
  }

  getUndoStackSize() {
    return this.#undoManager.undoStack.length;
  }

  getRedoStackSize() {
    return this.#undoManager.redoStack.length;
  }

  stopCapturing() {
    this.#undoManager.stopCapturing();
  }

  runTracked<T>(root: CRDTRoot, callback: () => T): T {
    if (!(root instanceof YJSRoot)) {
      return callback();
    }

    let result!: T;
    root.yDoc.transact(() => {
      result = callback();
    }, YJS_UNDO_ORIGIN);
    return result;
  }
}
