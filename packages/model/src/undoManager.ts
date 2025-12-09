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

  constructor(actions?: UndoableAction[]) {
    this.actions = actions ?? [];
  }

  addAction(action: UndoableAction | undefined) {
    if (!action) {
      console.warn('No undoable action provided');
      return;
    }
    this.actions.push(action);
  }

  get description() {
    return this.actions.map(a => a.description).join(', ');
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

const MAX_HISTORY = 100;

export class UndoManager extends EventEmitter<UndoEvents> implements Releasable {
  undoableActions: UndoableAction[];
  redoableActions: UndoableAction[];
  mark: UndoableAction | undefined = undefined;

  constructor(private readonly diagram: Diagram) {
    super();

    this.undoableActions = [];
    this.redoableActions = [];
  }

  release() {}

  setMark() {
    this.mark = this.undoableActions.at(-1);
  }

  getToMark() {
    const actions: UndoableAction[] = [];
    while (this.undoableActions.at(-1) !== this.mark) {
      actions.push(this.undoableActions.pop()!);
    }
    actions.reverse();

    return actions;
  }

  undoToMark() {
    while (this.undoableActions.at(-1) !== this.mark) {
      this.undo();
    }
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

    const uow = new UnitOfWork(this.diagram);
    action.redo(uow);
    uow.commit();

    this.emit('execute', { action, type: 'redo' });
  }

  undo() {
    if (this.undoableActions.length === 0) return;

    const action = this.undoableActions.pop();
    assert.present(action);

    this.redoableActions.push(action);
    this.prune();

    const uow = new UnitOfWork(this.diagram);
    action.undo(uow);
    uow.commit();

    this.emit('execute', { action: action, type: 'undo' });
  }

  redo() {
    if (this.redoableActions.length === 0) return;

    const action = this.redoableActions.pop();
    assert.present(action);

    this.undoableActions.push(action);
    this.prune();

    const uow = new UnitOfWork(this.diagram);
    action.redo(uow);
    uow.commit();

    this.emit('execute', { action: action, type: 'undo' });
  }

  private prune() {
    this.undoableActions = this.undoableActions.slice(-MAX_HISTORY);
    this.redoableActions = this.redoableActions.slice(-MAX_HISTORY);
    this.emit('change');
  }
}
