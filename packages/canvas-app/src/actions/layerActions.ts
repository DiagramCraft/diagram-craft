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
import { assert, precondition } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';
import { Application } from '../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { ReferenceLayerDialogCommand, StringInputDialogCommand } from '../dialogs';

export const layerActions = (application: Application) => ({
  LAYER_DELETE_LAYER: new LayerDeleteAction(application),
  LAYER_TOGGLE_VISIBILITY: new LayerToggleVisibilityAction(application),
  LAYER_TOGGLE_LOCK: new LayerToggleLockedAction(application),
  LAYER_RENAME: new LayerRenameAction(application),
  LAYER_ADD: new LayerAddAction('regular', application),
  LAYER_ADD_ADJUSTMENT: new LayerAddAction('adjustment', application),
  LAYER_ADD_REFERENCE: new LayerAddAction('reference', application),
  LAYER_SELECTION_MOVE: new LayerSelectionMoveAction(application),
  LAYER_SELECTION_MOVE_NEW: new LayerSelectionMoveNewAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof layerActions> {}
}

type LayerActionArg = { id?: string };

export class LayerDeleteAction extends AbstractAction<LayerActionArg, Application> {
  constructor(application: Application) {
    super(application);
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.context.model.activeDiagram.layers.byId(id) !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    // TODO: This should be a confirm dialog
    this.context.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete layer',
          message: 'Are you sure you want to delete this layer?',
          okLabel: 'Yes',
          cancelLabel: 'No'
        },
        () => {
          const uow = new UnitOfWork(this.context.model.activeDiagram, true);

          precondition.is.present(id);

          const layer = this.context.model.activeDiagram.layers.byId(id);
          assert.present(layer);

          this.context.model.activeDiagram.layers.remove(layer, uow);

          const snapshots = uow.commit();
          this.context.model.activeDiagram.undoManager.add(
            new CompoundUndoableAction([
              new SnapshotUndoableAction(
                'Delete layer',
                this.context.model.activeDiagram,
                snapshots.onlyUpdated()
              ),
              ...(layer instanceof RegularLayer
                ? [
                    new ElementDeleteUndoableAction(
                      this.context.model.activeDiagram,
                      layer,
                      layer.elements,
                      false
                    )
                  ]
                : []),
              new LayerDeleteUndoableAction(this.context.model.activeDiagram, layer)
            ])
          );
        }
      )
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
  constructor(context: ActionContext) {
    super(context);
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.context.model.activeDiagram.layers.byId(id) !== undefined;
  }

  getState({ id }: LayerActionArg): boolean {
    if (!id) return false;

    const diagram = this.context.model.activeDiagram;
    const layer = diagram.layers.byId(id);
    assert.present(layer);

    return diagram.layers.visible.includes(layer);
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const diagram = this.context.model.activeDiagram;
    const layer = diagram.layers.byId(id);
    assert.present(layer);

    diagram.layers.toggleVisibility(layer);
    diagram.undoManager.add(
      new ToggleActionUndoableAction('Toggle layer visibility', this, { id })
    );
  }
}

export class LayerToggleLockedAction extends AbstractToggleAction<LayerActionArg> {
  constructor(context: ActionContext) {
    super(context);
  }

  isEnabled({ id }: LayerActionArg): boolean {
    const diagram = this.context.model.activeDiagram;
    return (
      id !== undefined &&
      diagram.layers.byId(id) !== undefined &&
      diagram.layers.byId(id)?.type !== 'reference' &&
      diagram.layers.byId(id)?.type !== 'rule'
    );
  }

  getState({ id }: LayerActionArg): boolean {
    if (!id) return false;
    const layer = this.context.model.activeDiagram.layers.byId(id);
    assert.present(layer);
    return layer.isLocked();
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const diagram = this.context.model.activeDiagram;
    const layer = diagram.layers.byId(id);
    assert.present(layer);

    layer.locked = !layer.isLocked();
    diagram.undoManager.add(new ToggleActionUndoableAction('Toggle layer locked', this, { id }));
  }
}

export class LayerRenameAction extends AbstractAction<LayerActionArg, Application> {
  constructor(context: Application) {
    super(context);
  }

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.context.model.activeDiagram.layers.byId(id) !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const layer = this.context.model.activeDiagram.layers.byId(id);
    assert.present(layer);

    this.context.ui.showDialog(
      new StringInputDialogCommand(
        {
          title: 'Rename layer',
          description: 'Enter a new name for the layer.',
          saveButtonLabel: 'Rename',
          value: layer.name
        },
        async name => {
          const uow = new UnitOfWork(this.context.model.activeDiagram, true);
          layer.setName(name, uow);
          commitWithUndo(uow, `Rename layer`);
        }
      )
    );
  }
}

export class LayerAddAction extends AbstractAction<undefined, Application> {
  constructor(
    private readonly type: LayerType,
    context: Application
  ) {
    super(context);
  }

  execute(): void {
    if (this.type === 'reference') {
      this.context.ui.showDialog(
        new ReferenceLayerDialogCommand(async ({ diagramId, layerId, name }) => {
          const diagram = this.context.model.activeDiagram;
          const uow = new UnitOfWork(diagram, true);

          const layer = new ReferenceLayer(
            newid(),
            typeof name === 'string' ? name : 'New Layer',
            diagram,
            { diagramId, layerId }
          );
          diagram.layers.add(layer, uow);

          const snapshots = uow.commit();
          diagram.undoManager.add(
            new CompoundUndoableAction([
              new LayerAddUndoableAction(diagram, layer),
              new SnapshotUndoableAction('Add layer', diagram, snapshots)
            ])
          );
        })
      );
    } else {
      this.context.ui.showDialog(
        new StringInputDialogCommand(
          {
            title: 'New adjustment layer',
            description: 'Enter a new name for the adjustment layer.',
            saveButtonLabel: 'Create',
            value: ''
          },
          async name => {
            const diagram = this.context.model.activeDiagram;
            const uow = new UnitOfWork(diagram, true);

            const layer = new RegularLayer(
              newid(),
              typeof name === 'string' ? name : 'New Layer',
              [],
              diagram
            );
            diagram.layers.add(layer, uow);

            const snapshots = uow.commit();
            diagram.undoManager.add(
              new CompoundUndoableAction([
                new LayerAddUndoableAction(diagram, layer),
                new SnapshotUndoableAction('Add layer', diagram, snapshots)
              ])
            );
          }
        )
      );
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
  constructor(context: ActionContext) {
    super(context);
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const diagram = this.context.model.activeDiagram;
    const uow = new UnitOfWork(diagram, true);

    const layer = diagram.layers.byId(id!)!;
    assert.present(layer);

    diagram.moveElement(diagram.selectionState.elements, uow, layer!);
    commitWithUndo(uow, `Move to layer ${layer.name}`);
  }
}

export class LayerSelectionMoveNewAction extends AbstractAction {
  constructor(context: ActionContext) {
    super(context);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const uow = new UnitOfWork(diagram, true);

    const layer = new RegularLayer(newid(), 'New Layer', [], diagram);
    diagram.layers.add(layer, uow);

    diagram.moveElement(diagram.selectionState.elements, uow, layer!);

    const snapshots = uow.commit();
    uow.diagram.undoManager.add(
      new CompoundUndoableAction([
        new LayerAddUndoableAction(uow.diagram, layer!),
        new SnapshotUndoableAction('Move to new layer', uow.diagram, snapshots)
      ])
    );
  }
}
