import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import {
  AbstractAction,
  AbstractToggleAction,
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
import { assert, precondition } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';
import { application } from '../application';

export const layerActions = (state: ActionConstructionParameters) => ({
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

type LayerActionArg = { id?: string };

export class LayerDeleteAction extends AbstractAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.diagram.layers.byId(id) !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    // TODO: This should be a confirm dialog
    application.ui.showMessageDialog?.(
      'Delete layer',
      'Are you sure you want to delete this layer?',
      'Yes',
      'No',
      () => {
        const uow = new UnitOfWork(this.diagram, true);

        precondition.is.present(id);

        const layer = this.diagram.layers.byId(id);
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

export class LayerToggleVisibilityAction extends AbstractToggleAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.diagram.layers.byId(id) !== undefined;
  }

  getState({ id }: LayerActionArg): boolean {
    if (!id) return false;
    const layer = this.diagram.layers.byId(id);
    assert.present(layer);
    return this.diagram.layers.visible.includes(layer);
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const layer = this.diagram.layers.byId(id);
    assert.present(layer);

    this.diagram.layers.toggleVisibility(layer);
    this.diagram.undoManager.add(
      new ToggleActionUndoableAction('Toggle layer visibility', this, { id })
    );
  }
}

export class LayerToggleLockedAction extends AbstractToggleAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return (
      id !== undefined &&
      this.diagram.layers.byId(id) !== undefined &&
      this.diagram.layers.byId(id)?.type !== 'reference' &&
      this.diagram.layers.byId(id)?.type !== 'rule'
    );
  }

  getState({ id }: LayerActionArg): boolean {
    if (!id) return false;
    const layer = this.diagram.layers.byId(id);
    assert.present(layer);
    return layer.isLocked();
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const layer = this.diagram.layers.byId(id);
    assert.present(layer);

    layer.locked = !layer.isLocked();
    this.diagram.undoManager.add(
      new ToggleActionUndoableAction('Toggle layer locked', this, { id })
    );
  }
}

export class LayerRenameAction extends AbstractAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.diagram.layers.byId(id) !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const layer = this.diagram.layers.byId(id);
    assert.present(layer);

    application.ui.showDialog?.({
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

export class LayerAddAction extends AbstractAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly type: LayerType
  ) {
    super();
  }

  execute(): void {
    if (this.type === 'reference') {
      application.ui.showDialog?.({
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
      application.ui.showDialog?.({
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

export class LayerSelectionMoveAction extends AbstractAction<LayerActionArg> {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const uow = new UnitOfWork(this.diagram, true);

    const layer = this.diagram.layers.byId(id!)!;
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
