import { EventEmitter } from '../utils/event.ts';

export type UndoableAction = {
  undo: () => void;
  redo: () => void;
};

export type UndoEvents = {
  undo: { action: UndoableAction };
  redo: { action: UndoableAction };
  execute: { action: UndoableAction };
  add: { action: UndoableAction };
};

export class UndoManager extends EventEmitter<UndoEvents> {
  undoableActions: UndoableAction[];
  redoableActions: UndoableAction[];

  constructor() {
    super();

    this.undoableActions = [];
    this.redoableActions = [];
  }

  add(action: UndoableAction) {
    this.clearPending();

    this.undoableActions.push(action);
    this.redoableActions = [];

    this.emit('add', { action });
    this.prune();
  }

  execute(action: UndoableAction) {
    this.add(action);

    action.redo();

    this.emit('execute', { action });
  }

  undo() {
    if (this.undoableActions.length === 0) return;

    const action = this.undoableActions.pop();
    action!.undo();
    this.redoableActions.push(action!);

    this.emit('undo', { action: action! });
    this.prune();
  }

  redo() {
    if (this.redoableActions.length === 0) return;

    const action = this.redoableActions.pop();
    action!.redo();
    this.undoableActions.push(action!);

    this.emit('redo', { action: action! });
    this.prune();
  }

  private prune() {
    this.undoableActions = this.undoableActions.slice(-100);
    this.redoableActions = this.redoableActions.slice(-100);
  }

  clearPending() {
    // TODO: To be implemented
  }
}
