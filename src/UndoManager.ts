export type UndoableAction = {
  undo: () => void;
  redo: () => void;
};

export class UndoManager {
  undoableActions: UndoableAction[];
  redoableActions: UndoableAction[];

  private callback: (() => void) | undefined;

  constructor(callback?: () => void) {
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
    this.prune();
  }

  undo() {
    if (this.undoableActions.length === 0) return;

    const action = this.undoableActions.pop();
    action!.undo();
    this.redoableActions.push(action!);

    this.callback?.();
    this.prune();
  }

  redo() {
    if (this.redoableActions.length === 0) return;

    const action = this.redoableActions.pop();
    action!.redo();
    this.undoableActions.push(action!);

    this.callback?.();
    this.prune();
  }

  private prune() {
    this.undoableActions = this.undoableActions.slice(-100);
    this.redoableActions = this.redoableActions.slice(-100);
  }
}
