import { State } from '@diagram-craft/canvas/keyMap';
import {
  AbstractAction,
  AbstractToggleAction,
  ActionContext,
  ToggleActionUndoableAction
} from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { CompoundUndoableAction, UndoableAction } from '@diagram-craft/model/undoManager';
import {
  commitWithUndo,
  ElementDeleteUndoableAction,
  SnapshotUndoableAction
} from '@diagram-craft/model/diagramUndoActions';
import { Layer, LayerType, RegularLayer } from '@diagram-craft/model/diagramLayer';
import { precondition, assert } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';

export const layerActions = (state: State) => ({
  LAYER_DELETE_LAYER: new LayerDeleteAction(state.diagram),
  LAYER_TOGGLE_VISIBILITY: new LayerToggleVisibilityAction(state.diagram),
  LAYER_TOGGLE_LOCK: new LayerToggleLockedAction(state.diagram),
  LAYER_RENAME: new LayerRenameAction(state.diagram),
  LAYER_ADD: new LayerAddAction(state.diagram, 'regular'),
  LAYER_ADD_ADJUSTMENT: new LayerAddAction(state.diagram, 'adjustment'),
  LAYER_ADD_REFERENCE: new LayerAddAction(state.diagram, 'reference'),
  LAYER_SELECTION_MOVE: new LayerSelectionMoveAction(state.diagram),
  LAYER_SELECTION_MOVE_NEW: new LayerSelectionMoveNewAction(state.diagram)
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
    precondition.is.present(context.id);

    const uow = new UnitOfWork(this.diagram, true);

    const layer = this.diagram.layers.byId(context.id);
    assert.present(layer);

    this.diagram.layers.remove(layer, uow);

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new CompoundUndoableAction([
        new SnapshotUndoableAction('Delete layer', this.diagram, snapshots.onlyUpdated()),
        ...(layer instanceof RegularLayer
          ? [new ElementDeleteUndoableAction(this.diagram, layer, layer.elements, false)]
          : []),
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
    precondition.is.present(context.id);

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
    return (
      context.id !== undefined &&
      this.diagram.layers.byId(context.id) !== undefined &&
      this.diagram.layers.byId(context.id)?.type !== 'reference' &&
      this.diagram.layers.byId(context.id)?.type !== 'rule'
    );
  }

  getState(context: ActionContext): boolean {
    if (!context.id) return false;
    const layer = this.diagram.layers.byId(context.id);
    assert.present(layer);
    return layer.isLocked();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.id);

    const layer = this.diagram.layers.byId(context.id);
    assert.present(layer);

    layer.locked = !layer.isLocked();
    this.diagram.undoManager.add(
      new ToggleActionUndoableAction('Toggle layer locked', this, context)
    );
  }
}

export class LayerRenameAction extends AbstractAction<string | undefined> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined && this.diagram.layers.byId(context.id) !== undefined;
  }

  execute(context: ActionContext, name: string | undefined): void {
    precondition.is.present(context.id);

    const layer = this.diagram.layers.byId(context.id);
    assert.present(layer);

    if (typeof name === 'string') {
      const uow = new UnitOfWork(this.diagram, true);
      layer.setName(typeof name === 'string' ? name : 'New name', uow);
      commitWithUndo(uow, `Rename layer`);
    } else {
      context.applicationTriggers?.showDialog?.({
        name: 'stringInput',
        props: {
          title: 'Rename layer',
          description: 'Enter a new name for the layer.',
          saveButtonLabel: 'Rename',
          value: layer.name
        },
        onOk: async name => {
          const uow = new UnitOfWork(this.diagram, true);
          layer.setName(name, uow);
          commitWithUndo(uow, `Rename layer`);
        },
        onCancel: () => {}
      });
    }
  }
}

export class LayerAddAction extends AbstractAction<string | undefined> {
  constructor(
    protected readonly diagram: Diagram,
    private readonly type: LayerType
  ) {
    super();
  }

  execute(context: ActionContext, name: string | undefined): void {
    if (typeof name === 'string') {
      const uow = new UnitOfWork(this.diagram, true);

      const layer = new RegularLayer(newid(), name, [], this.diagram);
      this.diagram.layers.add(layer, uow);

      const snapshots = uow.commit();
      this.diagram.undoManager.add(
        new CompoundUndoableAction([
          new LayerAddUndoableAction(this.diagram, layer),
          new SnapshotUndoableAction('Add layer', this.diagram, snapshots)
        ])
      );
    } else if (this.type === 'reference') {
      context.applicationTriggers?.showDialog?.({
        name: 'newReferenceLayer',
        props: {},
        onOk: async ({ diagramId, layerId, name }) => {
          const uow = new UnitOfWork(this.diagram, true);

          const layer = new ReferenceLayer(
            newid(),
            typeof name === 'string' ? name : 'New Layer',
            this.diagram,
            { diagramId, layerId }
          );
          this.diagram.layers.add(layer, uow);

          const snapshots = uow.commit();
          this.diagram.undoManager.add(
            new CompoundUndoableAction([
              new LayerAddUndoableAction(this.diagram, layer),
              new SnapshotUndoableAction('Add layer', this.diagram, snapshots)
            ])
          );
        },
        onCancel: () => {}
      });
    } else {
      context.applicationTriggers?.showDialog?.({
        name: 'stringInput',
        props: {
          title: 'New adjustment layer',
          description: 'Enter a new name for the adjustment layer.',
          saveButtonLabel: 'Create',
          value: ''
        },
        onOk: async name => {
          const uow = new UnitOfWork(this.diagram, true);

          const layer = new RegularLayer(
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
        },
        onCancel: () => {}
      });
    }
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

export class LayerSelectionMoveAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.id);

    const uow = new UnitOfWork(this.diagram, true);

    const layer = this.diagram.layers.byId(context.id!)!;
    assert.present(layer);

    this.diagram.moveElement(this.diagram.selectionState.elements, uow, layer!);
    commitWithUndo(uow, `Move to layer ${layer.name}`);
  }
}

export class LayerSelectionMoveNewAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);

    const layer = new RegularLayer(newid(), 'New Layer', [], this.diagram);
    this.diagram.layers.add(layer, uow);

    this.diagram.moveElement(this.diagram.selectionState.elements, uow, layer!);

    const snapshots = uow.commit();
    uow.diagram.undoManager.add(
      new CompoundUndoableAction([
        new LayerAddUndoableAction(uow.diagram, layer!),
        new SnapshotUndoableAction('Move to new layer', uow.diagram, snapshots)
      ])
    );
  }
}
