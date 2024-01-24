import { Diagram } from '../../model/diagram.ts';
import { State } from '../keyMap.ts';
import { assert } from '../../utils/assert.ts';
import {
  AbstractAction,
  AbstractToggleAction,
  ActionContext,
  ToggleActionUndoableAction
} from '../action.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { CompoundUndoableAction, UndoableAction } from '../../model/undoManager.ts';
import { Layer } from '../../model/diagramLayer.ts';
import {
  commitWithUndo,
  ElementDeleteUndoableAction,
  SnapshotUndoableAction
} from '../../model/diagramUndoActions.ts';
import { newid } from '../../utils/id.ts';

export const layerActions = (state: State) => ({
  LAYER_DELETE_LAYER: new LayerDeleteAction(state.diagram),
  LAYER_TOGGLE_VISIBILITY: new LayerToggleVisibilityAction(state.diagram),
  LAYER_TOGGLE_LOCK: new LayerToggleLockedAction(state.diagram),
  LAYER_RENAME: new LayerRenameAction(state.diagram),
  LAYER_ADD: new LayerAddAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof layerActions> {}
}

export class LayerDeleteAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined && this.diagram.layers.byId(context.id) !== undefined;
  }

  execute(context: ActionContext): void {
    const uow = new UnitOfWork(this.diagram, true);

    assert.present(context.id);
    const layer = this.diagram.layers.byId(context.id);

    assert.present(layer);
    this.diagram.layers.remove(layer, uow);

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new CompoundUndoableAction([
        new SnapshotUndoableAction('Delete layer', this.diagram, snapshots.onlyUpdated()),
        new ElementDeleteUndoableAction(this.diagram, layer.elements),
        new LayerDeleteUndoableAction(this.diagram, layer)
      ])
    );
  }
}

class LayerDeleteUndoableAction implements UndoableAction {
  description = 'Delete layer';

  constructor(
    private readonly diagram: Diagram,
    private readonly layer: Layer
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.layers.add(this.layer, uow);
  }

  redo(uow: UnitOfWork) {
    this.diagram.layers.remove(this.layer, uow);
  }
}

export class LayerToggleVisibilityAction extends AbstractToggleAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined && this.diagram.layers.byId(context.id) !== undefined;
  }

  getState(context: ActionContext): boolean {
    if (!context.id) return false;
    const layer = this.diagram.layers.byId(context.id);
    assert.present(layer);
    return this.diagram.layers.visible.includes(layer);
  }

  execute(context: ActionContext): void {
    assert.present(context.id);
    const layer = this.diagram.layers.byId(context.id);

    assert.present(layer);
    this.diagram.layers.toggleVisibility(layer);
    this.diagram.undoManager.add(
      new ToggleActionUndoableAction('Toggle layer visibility', this, context)
    );
  }
}

export class LayerToggleLockedAction extends AbstractToggleAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined && this.diagram.layers.byId(context.id) !== undefined;
  }

  getState(context: ActionContext): boolean {
    if (!context.id) return false;
    const layer = this.diagram.layers.byId(context.id);
    assert.present(layer);
    return layer.isLocked();
  }

  execute(context: ActionContext): void {
    assert.present(context.id);
    const layer = this.diagram.layers.byId(context.id);

    assert.present(layer);
    layer.locked = !layer.isLocked();
    this.diagram.undoManager.add(
      new ToggleActionUndoableAction('Toggle layer locked', this, context)
    );
  }
}

export class LayerRenameAction extends AbstractAction<string> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined && this.diagram.layers.byId(context.id) !== undefined;
  }

  execute(context: ActionContext, name: string): void {
    assert.present(context.id);
    const layer = this.diagram.layers.byId(context.id);

    assert.present(layer);

    const uow = new UnitOfWork(this.diagram, true);
    layer.setName(typeof name === 'string' ? name : 'New name', uow);
    commitWithUndo(uow, `Rename layer`);
  }
}

export class LayerAddAction extends AbstractAction<string | undefined> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  execute(_context: ActionContext, name: string | undefined): void {
    const uow = new UnitOfWork(this.diagram, true);
    const layer = new Layer(
      newid(),
      typeof name === 'string' ? name : 'New Layer',
      [],
      this.diagram
    );
    this.diagram.layers.add(layer, uow);

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new CompoundUndoableAction([
        new LayerAddUndoableAction(this.diagram, layer),
        new SnapshotUndoableAction('Add layer', this.diagram, snapshots)
      ])
    );
  }
}

class LayerAddUndoableAction implements UndoableAction {
  description = 'Add layer';

  constructor(
    private readonly diagram: Diagram,
    private readonly layer: Layer
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.layers.remove(this.layer, uow);
  }

  redo(uow: UnitOfWork) {
    this.diagram.layers.add(this.layer, uow);
  }
}
