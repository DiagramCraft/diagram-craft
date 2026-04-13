import { UnitOfWork } from './unitOfWork';
import type { Diagram } from './diagram';
import { EventEmitter } from '@diagram-craft/utils/event';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import {
  CompoundUndoableAction,
  type StackedUndoManager,
  type UndoCapture,
  UndoEvents,
  UndoCapture as UndoCaptureImpl,
  type UndoableAction
} from './undoManager';

const MAX_HISTORY = 100;
const MAX_HISTORY_WITH_MARKS = 10_000;
const DEFAULT_MARK = '__default__';

export class DefaultUndoManager
  extends EventEmitter<UndoEvents>
  implements StackedUndoManager
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
      return callback(capture.uow);
    } finally {
      capture.commit();
    }
  }

  beginCapture(label: string): UndoCapture {
    return new UndoCaptureImpl(UnitOfWork._begin(this.diagram), label, { release() {} }, action => {
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

    this.emit('execute', { action, type: 'undo' });
  }

  redo() {
    if (!this.canRedo()) return;

    const action = this.redoableActions.pop();
    assert.present(action);

    this.undoableActions.push(action);
    this.prune();

    UnitOfWork.execute(this.diagram, uow => action.redo(uow));

    this.emit('execute', { action, type: 'undo' });
  }

  private prune() {
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
