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

export interface UndoManager extends EventEmitter<UndoEvents>, Releasable {
  canUndo(): boolean;
  canRedo(): boolean;
  runUndoable<T>(label: string, callback: () => T): T;
  setMark(markName?: string): void;
  getToMark(markName?: string): UndoableAction[];
  undoToMark(markName?: string): void;
  clearRedo(): void;
  combine(callback: () => void): void;
  add(action: UndoableAction): void;
  addAndExecute(action: UndoableAction): void;
  undo(): void;
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

  runUndoable<T>(_label: string, callback: () => T): T {
    return callback();
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
  #pendingCapture:
    | {
        label: string;
        action?: UndoableAction;
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
        event.stackItem.meta.set(
          COLLABORATION_ACTION_META_KEY,
          this.#pendingCapture.action ??
            makeUndoableAction(this.#pendingCapture.label, {
              undo: () => {},
              redo: () => {}
            })
        );
        this.#undoAdapter.stopCapturing();
        this.#pendingCapture = undefined;
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

  runUndoable<T>(label: string, callback: () => T): T {
    if (this.#captureDepth > 0) {
      return callback();
    }

    this.#captureDepth++;
    this.#pendingCapture = { label };
    try {
      return UnitOfWork.withNativeUndoCapture(this, action => this.registerCapturedAction(label, action), () =>
        this.#undoAdapter.runTracked(this.diagram.document.root, callback)
      );
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
    this.runUndoable('Combined action', callback);
  }

  add(_action: UndoableAction) {}

  addAndExecute(action: UndoableAction) {
    this.runUndoable(action.description, () => {
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
      return;
    }

    if (!action) return;

    if (!this.#pendingCapture.action) {
      this.#pendingCapture.action = action;
      return;
    }

    if (this.#pendingCapture.action instanceof CompoundUndoableAction) {
      this.#pendingCapture.action.add(action);
      return;
    }

    this.#pendingCapture.action = new CompoundUndoableAction(
      [this.#pendingCapture.action, action],
      label
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
