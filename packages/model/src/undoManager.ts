import { UnitOfWork } from './unitOfWork';
import type { Diagram } from './diagram';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
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

export interface UndoManager extends EventEmitter<UndoEvents>, Releasable {
  canUndo(): boolean;
  canRedo(): boolean;
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
