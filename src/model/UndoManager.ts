import { EventEmitter } from './event.ts';

export type UndoableAction = {
  undo: () => void;
  redo: () => void;
};

export class UndoManager extends EventEmitter<{
  undo: { action: UndoableAction };
  redo: { action: UndoableAction };
  execute: { action: UndoableAction };
}> {
  undoableActions: UndoableAction[];
  redoableActions: UndoableAction[];

  // TODO: We should remove this callback and use events instead
  private callback: (() => void) | undefined;

  constructor(callback?: () => void) {
    super();

    this.undoableActions = [];
    this.redoableActions = [];
    this.callback = callback;
  }

  add(action: UndoableAction) {
    this.undoableActions.push(action);
    this.redoableActions = [];
    this.prune();
  }

  execute(action: UndoableAction) {
    this.undoableActions.push(action);
    this.redoableActions = [];
    action.redo();

    this.callback?.();
    this.emit('execute', { action });
    this.prune();
  }

  undo() {
    console.log('undo');

    if (this.undoableActions.length === 0) return;

    const action = this.undoableActions.pop();
    action!.undo();
    this.redoableActions.push(action!);

    this.callback?.();
    this.emit('undo', { action: action! });
    this.prune();
  }

  redo() {
    if (this.redoableActions.length === 0) return;

    const action = this.redoableActions.pop();
    action!.redo();
    this.undoableActions.push(action!);

    this.callback?.();
    this.emit('redo', { action: action! });
    this.prune();
  }

  private prune() {
    this.undoableActions = this.undoableActions.slice(-100);
    this.redoableActions = this.redoableActions.slice(-100);
  }
}
