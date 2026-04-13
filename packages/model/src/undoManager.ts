import { UnitOfWork } from './unitOfWork';
import type { Diagram } from './diagram';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import type { Releasable } from '@diagram-craft/utils/releasable';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import type { CollaborationUndoAdapter } from '@diagram-craft/collaboration/collaborationUndoAdapter';

export const makeUndoableAction = (
  description: string,
  props: { undo: (uow: UnitOfWork) => void; redo: (uow: UnitOfWork) => void }
): UndoableAction => {
  return {
    description,
    undo: props.undo,
    redo: props.redo
  };
};

export type UndoableAction = {
  undo: (uow: UnitOfWork) => void;
  redo: (uow: UnitOfWork) => void;

  description: string;
  timestamp?: Date;

  merge?: (other: UndoableAction) => boolean;
};

export class CompoundUndoableAction implements UndoableAction {
  private readonly actions: UndoableAction[];

  name: string | undefined;
  readonly #description: string | undefined;

  constructor(actions?: UndoableAction[], description?: string) {
    this.actions = actions ?? [];
    this.#description = description;
  }

  add(action: UndoableAction | undefined) {
    if (!action) {
      console.warn('No undoable action provided');
      return;
    }
    this.actions.push(action);
  }

  get description() {
    return this.#description ?? this.actions.map(a => a.description).join(', ');
  }

  undo(uow: UnitOfWork) {
    for (const action of this.actions.toReversed()) {
      action.undo(uow);
    }
  }

  redo(uow: UnitOfWork) {
    for (const action of this.actions) {
      action.redo(uow);
    }
  }

  hasActions() {
    return this.actions.length > 0;
  }
}

export type UndoEvents = {
  /* Triggered when an action is either executed when added, undone or redone */
  execute: { action: UndoableAction; type: 'undo' | 'redo' };

  /* Triggered when any of the undo or redo stacks change */
  change: Record<string, never>;
};

/**
 * Represents one long-lived undo boundary.
 *
 * A capture owns the {@link UnitOfWork} for the interaction and is responsible
 * for either finalizing it into one undo step or aborting it entirely.
 */
export class UndoCapture implements Releasable {
  #completed = false;

  constructor(
    readonly unitOfWork: UnitOfWork,
    private readonly label: string,
    private readonly session: Releasable,
    private readonly finalize: (action: UndoableAction | undefined) => void
  ) {}

  /**
   * Commits the underlying {@link UnitOfWork} and finalizes the resulting
   * structural undo action for the owning {@link UndoManager}.
   */
  commit() {
    if (this.#completed) return;
    this.#completed = true;
    try {
      if (this.unitOfWork.state === 'pending') {
        this.unitOfWork.commit();
      }
      this.finalize(this.unitOfWork._finishAsUndoableAction(this.label));
    } finally {
      this.session.release();
    }
  }

  /**
   * Aborts the capture without producing an undo step.
   */
  abort() {
    if (this.#completed) return;
    this.#completed = true;
    try {
      if (this.unitOfWork.state === 'pending') {
        this.unitOfWork.abort();
      }
    } finally {
      this.session.release();
    }
  }

  /**
   * Releases the capture.
   *
   * This is equivalent to {@link abort} and is primarily provided so captures
   * can participate in generic releasable lifecycles.
   */
  release() {
    this.abort();
  }
}

/**
 * Public API for creating, grouping and replaying undoable work.
 *
 * Implementations may store history in local process memory or delegate it to a
 * collaboration backend, but callers should interact with them through this
 * abstraction.
 */
export interface UndoManager extends EventEmitter<UndoEvents>, Releasable {
  /**
   * Returns whether an undo operation can currently be performed.
   */
  canUndo(): boolean;

  /**
   * Returns whether a redo operation can currently be performed.
   */
  canRedo(): boolean;

  /**
   * Executes one short-lived undoable operation.
   *
   * The callback receives a {@link UnitOfWork} that should be used for the
   * structural changes belonging to this single undo step.
   */
  execute<T>(label: string, callback: (uow: UnitOfWork) => T): T;

  /**
   * Starts a long-lived undo capture for interactions such as drag operations.
   *
   * The returned capture owns a {@link UnitOfWork} and is responsible for
   * finalizing or aborting the undo step.
   */
  beginCapture(label: string): UndoCapture;

  /**
   * Stores the current undo position under an optional mark name.
   */
  setMark(markName?: string): void;

  /**
   * Returns undo actions from the current position back to the given mark and
   * clears that mark.
   *
   * Stackless implementations may return an empty array.
   */
  getToMark(markName?: string): UndoableAction[];

  /**
   * Undoes actions until the given mark is reached and then clears that mark.
   */
  undoToMark(markName?: string): void;

  /**
   * Clears the redo history if supported by the implementation.
   */
  clearRedo(): void;

  /**
   * Groups undo work produced during the callback into a single visible history
   * step where supported.
   *
   * TODO: See if this can be removed
   */
  combine(callback: () => void): void;

  /**
   * Adds an already constructed undo action to history without executing it.
   */
  add(action: UndoableAction): void;

  /**
   * Adds an already constructed undo action to history and executes its redo
   * behavior.
   */
  addAndExecute(action: UndoableAction): void;

  /**
   * Undoes the most recent undoable step, if one exists.
   */
  undo(): void;

  /**
   * Redoes the most recent redoable step, if one exists.
   */
  redo(): void;
}

export interface StackedUndoManager extends UndoManager {
  readonly undoableActions: readonly UndoableAction[];
  readonly redoableActions: readonly UndoableAction[];
}

export const isStackedUndoManager = (u: UndoManager): u is StackedUndoManager => {
  return 'undoableActions' in u && 'redoableActions' in u;
};

const COLLABORATION_ACTION_META_KEY = 'diagram-craft.undo-action';
const COLLABORATION_FALLBACK_DESCRIPTION = 'Undo';

const MAX_HISTORY = 100;
const MAX_HISTORY_WITH_MARKS = 10_000;
const DEFAULT_MARK = '__default__';

export class DefaultUndoManager
  extends EventEmitter<UndoEvents>
  implements StackedUndoManager, Releasable
{
  undoableActions: UndoableAction[];
  redoableActions: UndoableAction[];
  private readonly marks = new Map<string, UndoableAction | undefined>();

  constructor(private readonly diagram: Diagram) {
    super();

    this.undoableActions = [];
    this.redoableActions = [];
  }

  release() {}

  execute<T>(label: string, callback: (uow: UnitOfWork) => T): T {
    const capture = this.beginCapture(label);
    try {
      return callback(capture.unitOfWork);
    } finally {
      capture.commit();
    }
  }

  beginCapture(label: string): UndoCapture {
    return new UndoCapture(UnitOfWork._begin(this.diagram), label, { release() {} }, action => {
      if (action) {
        this.add(action);
      }
    });
  }

  canUndo() {
    return this.undoableActions.length > 0;
  }

  canRedo() {
    return this.redoableActions.length > 0;
  }

  setMark(markName?: string) {
    this.marks.set(markName ?? DEFAULT_MARK, this.undoableActions.at(-1));
  }

  getToMark(markName?: string) {
    const resolvedMarkName = markName ?? DEFAULT_MARK;
    const mark = this.marks.get(resolvedMarkName);
    const actions: UndoableAction[] = [];
    while (this.undoableActions.at(-1) !== mark) {
      actions.push(this.undoableActions.pop()!);
    }
    actions.reverse();
    this.marks.delete(resolvedMarkName);

    return actions;
  }

  undoToMark(markName?: string) {
    const resolvedMarkName = markName ?? DEFAULT_MARK;
    const mark = this.marks.get(resolvedMarkName);
    while (this.undoableActions.at(-1) !== mark) {
      this.undo();
    }
    this.marks.delete(resolvedMarkName);
  }

  clearRedo() {
    this.redoableActions = [];
  }

  combine(callback: () => void) {
    const top = this.undoableActions.at(-1);
    callback();

    const actions: UndoableAction[] = [];
    while (this.undoableActions.at(-1) !== top) {
      actions.push(this.undoableActions.pop()!);
    }
    actions.reverse();

    if (actions.length === 0) return;
    this.add(new CompoundUndoableAction(actions));
  }

  add(action: UndoableAction) {
    if (this.undoableActions.at(-1)?.merge?.(action)) {
      return;
    }

    if (action instanceof CompoundUndoableAction && !action.hasActions()) {
      VERIFY_NOT_REACHED();
    }

    action.timestamp = new Date();

    this.undoableActions.push(action);
    this.redoableActions = [];
    this.prune();
  }

  addAndExecute(action: UndoableAction) {
    this.add(action);

    UnitOfWork.execute(this.diagram, uow => action.redo(uow));

    this.emit('execute', { action, type: 'redo' });
  }

  undo() {
    if (!this.canUndo()) return;

    const action = this.undoableActions.pop();
    assert.present(action);

    this.redoableActions.push(action);
    this.prune();

    UnitOfWork.execute(this.diagram, uow => action.undo(uow));

    this.emit('execute', { action: action, type: 'undo' });
  }

  redo() {
    if (!this.canRedo()) return;

    const action = this.redoableActions.pop();
    assert.present(action);

    this.undoableActions.push(action);
    this.prune();

    UnitOfWork.execute(this.diagram, uow => action.redo(uow));

    this.emit('execute', { action: action, type: 'undo' });
  }

  private prune() {
    // TODO: Make mark retention more deliberate if multiple long-lived named marks are introduced.
    const maxUndoHistory = this.marks.size > 0 ? MAX_HISTORY_WITH_MARKS : MAX_HISTORY;
    this.undoableActions = this.undoableActions.slice(-maxUndoHistory);
    this.redoableActions = this.redoableActions.slice(-MAX_HISTORY);
    const remainingActions = new Set(this.undoableActions);
    for (const [markName, action] of this.marks) {
      if (action !== undefined && !remainingActions.has(action)) {
        this.marks.delete(markName);
      }
    }
    this.emit('change');
  }
}

export class CollaborationBackendUndoManager
  extends EventEmitter<UndoEvents>
  implements UndoManager, Releasable
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
      return callback(capture.unitOfWork);
    } finally {
      capture.commit();
    }
  }

  beginCapture(label: string): UndoCapture {
    return new UndoCapture(
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

export const createUndoManager = (diagram: Diagram): UndoManager => {
  const collaborationUndoAdapter = CollaborationConfig.Backend.createUndoAdapter?.(
    diagram.document.root
  );
  if (collaborationUndoAdapter) {
    return new CollaborationBackendUndoManager(diagram, collaborationUndoAdapter);
  }

  return new DefaultUndoManager(diagram);
};
