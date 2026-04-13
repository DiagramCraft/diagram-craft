import { UnitOfWork } from './unitOfWork';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { Releasable } from '@diagram-craft/utils/releasable';

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
    readonly uow: UnitOfWork,
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
      if (this.uow.state === 'pending') {
        this.uow.commit();
      }
      this.finalize(this.uow.asUndoableAction(this.label));
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
      if (this.uow.state === 'pending') {
        this.uow.abort();
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
