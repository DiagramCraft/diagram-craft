import { UnitOfWork } from './unitOfWork';
import type { Diagram } from './diagram';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { Releasable } from '@diagram-craft/utils/releasable';
import type { CollaborationUndoAdapter } from '@diagram-craft/collaboration/collaborationUndoAdapter';
import {
  CompoundUndoableAction,
  makeUndoableAction,
  type UndoCapture,
  UndoCapture as UndoCaptureImpl,
  UndoEvents,
  type UndoManager,
  type UndoableAction
} from './undoManager';

const COLLABORATION_ACTION_META_KEY = 'diagram-craft.undo-action';
const COLLABORATION_FALLBACK_DESCRIPTION = 'Undo';
const DEFAULT_MARK = '__default__';

/**
 * Undo manager backed by a collaboration backend's native undo support.
 *
 * Instead of storing local undo stacks directly, this implementation delegates
 * history storage and replay to a {@link CollaborationUndoAdapter}. The model
 * still builds structural {@link UndoableAction} objects, but those are attached
 * as metadata to backend-native stack items so UI and events can refer to a
 * higher-level action description.
 *
 * Key differences from {@link DefaultUndoManager}:
 * - mutations that should be undoable must execute inside a backend-tracked
 *   boundary
 * - remote replicated changes are intentionally excluded from the local undo
 *   stack
 * - stack-surgery helpers such as {@link getToMark} and {@link add} only support
 *   the small safe subset needed by current callers
 * - {@link combine} groups work by running inside one tracked backend boundary
 *   rather than by rewriting a local stack after the fact
 */
export class CollaborationBackendUndoManager
  extends EventEmitter<UndoEvents>
  implements UndoManager
{
  readonly #undoAdapter: CollaborationUndoAdapter;
  readonly #marks = new Map<string, number>();
  #captureDepth = 0;
  #sessionDepth = 0;
  #pendingCapture:
    | {
        label: string;
        action?: UndoableAction;
        stackItem?: { meta: Map<unknown, unknown> };
      }
    | undefined;

  constructor(
    private readonly diagram: Diagram,
    undoAdapter: CollaborationUndoAdapter
  ) {
    super();

    this.#undoAdapter = undoAdapter;
    this.#undoAdapter.on('stackItemAdded', event => {
      if (event.type === 'undo' && event.tracked && this.#pendingCapture) {
        this.#pendingCapture.stackItem = event.stackItem;
        this.syncPendingCaptureMetadata();
        if (this.#sessionDepth === 0) {
          this.#undoAdapter.stopCapturing();
          this.#pendingCapture = undefined;
        }
      }
      this.emit('change');
    });
    this.#undoAdapter.on('stackItemUpdated', () => {
      this.emit('change');
    });
    this.#undoAdapter.on('stackItemPopped', event => {
      const action =
        (event.stackItem.meta.get(COLLABORATION_ACTION_META_KEY) as UndoableAction | undefined) ??
        makeUndoableAction(COLLABORATION_FALLBACK_DESCRIPTION, {
          undo: () => {},
          redo: () => {}
        });
      this.emit('execute', { action, type: event.type });
      this.emit('change');
    });
    this.#undoAdapter.on('stackCleared', () => {
      this.emit('change');
    });
  }

  release() {
    this.#undoAdapter.release();
  }

  canUndo() {
    return this.#undoAdapter.canUndo();
  }

  canRedo() {
    return this.#undoAdapter.canRedo();
  }

  execute<T>(label: string, callback: (uow: UnitOfWork) => T): T {
    const capture = this.beginCapture(label);
    try {
      return callback(capture.uow);
    } finally {
      capture.commit();
    }
  }

  beginCapture(label: string): UndoCapture {
    return new UndoCaptureImpl(
      UnitOfWork._begin(this.diagram),
      label,
      this.beginTrackedSession(label),
      action => this.registerCapturedAction(label, action)
    );
  }

  private beginTrackedSession(label: string): Releasable {
    this.#captureDepth++;
    this.#sessionDepth++;
    this.#pendingCapture ??= { label };

    const trackedSession = this.#undoAdapter.openTrackedSession(this.diagram.document.root);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;

        trackedSession.release();

        this.#sessionDepth--;
        this.#captureDepth--;

        if (this.#sessionDepth === 0) {
          this.#undoAdapter.stopCapturing();
          this.#pendingCapture = undefined;
        }
      }
    };
  }

  private runTracked<T>(label: string, callback: () => T): T {
    if (this.#captureDepth > 0) {
      return callback();
    }

    this.#captureDepth++;
    this.#pendingCapture = { label };
    try {
      return this.#undoAdapter.runTracked(this.diagram.document.root, callback);
    } finally {
      this.#captureDepth--;
      if (this.#captureDepth === 0 && this.#pendingCapture?.label === label) {
        this.#pendingCapture = undefined;
      }
    }
  }

  setMark(markName?: string) {
    this.#marks.set(markName ?? DEFAULT_MARK, this.getUndoDepth());
  }

  getToMark(_markName?: string) {
    return [];
  }

  undoToMark(markName?: string) {
    const resolvedMarkName = markName ?? DEFAULT_MARK;
    const targetDepth = this.#marks.get(resolvedMarkName) ?? 0;
    while (this.getUndoDepth() > targetDepth && this.canUndo()) {
      this.undo();
    }
    this.#marks.delete(resolvedMarkName);
  }

  clearRedo() {}

  /**
   * Groups work by executing the callback inside one tracked collaboration
   * boundary.
   */
  combine(callback: () => void) {
    this.runTracked('Combined action', callback);
  }

  add(_action: UndoableAction) {}

  addAndExecute(action: UndoableAction) {
    this.runTracked(action.description, () => {
      this.#pendingCapture = { label: action.description, action };
      UnitOfWork.execute(this.diagram, uow => action.redo(uow));
    });
  }

  undo() {
    if (!this.canUndo()) return;
    this.#undoAdapter.undo();
  }

  redo() {
    if (!this.canRedo()) return;
    this.#undoAdapter.redo();
  }

  private getUndoDepth() {
    return this.#undoAdapter.getUndoStackSize();
  }

  private registerCapturedAction(label: string, action: UndoableAction | undefined) {
    if (!this.#pendingCapture) {
      this.#pendingCapture = { label, action };
      this.syncPendingCaptureMetadata();
      return;
    }

    if (!action) return;

    if (!this.#pendingCapture.action) {
      this.#pendingCapture.action = action;
      this.syncPendingCaptureMetadata();
      return;
    }

    if (this.#pendingCapture.action instanceof CompoundUndoableAction) {
      this.#pendingCapture.action.add(action);
      this.syncPendingCaptureMetadata();
      return;
    }

    this.#pendingCapture.action = new CompoundUndoableAction(
      [this.#pendingCapture.action, action],
      label
    );
    this.syncPendingCaptureMetadata();
  }

  private syncPendingCaptureMetadata() {
    if (!this.#pendingCapture?.stackItem) return;

    this.#pendingCapture.stackItem.meta.set(
      COLLABORATION_ACTION_META_KEY,
      this.#pendingCapture.action ??
        makeUndoableAction(this.#pendingCapture.label, {
          undo: () => {},
          redo: () => {}
        })
    );
  }
}
