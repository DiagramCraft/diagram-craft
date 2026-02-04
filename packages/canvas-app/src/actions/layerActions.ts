import {
  AbstractAction,
  AbstractToggleAction,
  ToggleActionUndoableAction
} from '@diagram-craft/canvas/action';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Layer, LayerType } from '@diagram-craft/model/diagramLayer';
import { assert, precondition } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { ReferenceLayer } from '@diagram-craft/model/diagramLayerReference';
import { Application } from '../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { ReferenceLayerDialogCommand, StringInputDialogCommand } from '../dialogs';
import { RuleLayer } from '@diagram-craft/model/diagramLayerRule';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ModificationLayer } from '@diagram-craft/model/diagramLayerModification';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

export const layerActions = (application: Application) => ({
  LAYER_DELETE_LAYER: new LayerDeleteAction(application),
  LAYER_TOGGLE_VISIBILITY: new LayerToggleVisibilityAction(application),
  LAYER_TOGGLE_LOCK: new LayerToggleLockedAction(application),
  LAYER_RENAME: new LayerRenameAction(application),
  LAYER_ADD: new LayerAddAction(
    'regular',
    $tStr('action.LAYER_ADD.name', 'New Layer'),
    application
  ),
  LAYER_ADD_REFERENCE: new LayerAddAction(
    'reference',
    $tStr('action.LAYER_ADD_REFERENCE.name', 'New Reference Layer'),
    application
  ),
  LAYER_ADD_RULE: new LayerAddAction(
    'rule',
    $tStr('action.LAYER_ADD_RULE.name', 'New Rule Layer'),
    application
  ),
  LAYER_ADD_MODIFICATION: new LayerAddAction(
    'modification',
    $tStr('action.LAYER_ADD_MODIFICATION.name', 'New Modification Layer'),
    application
  ),
  LAYER_SELECTION_MOVE: new LayerSelectionMoveAction(application),
  LAYER_SELECTION_MOVE_NEW: new LayerSelectionMoveNewAction(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof layerActions> {}
  }
}

type LayerActionArg = { id?: string };

export class LayerDeleteAction extends AbstractAction<LayerActionArg, Application> {
  name = $tStr('action.LAYER_DELETE_LAYER.name', 'Delete Layer');

  isEnabled({ id }: LayerActionArg): boolean {
    return id !== undefined && this.context.model.activeDiagram.layers.byId(id) !== undefined;
  }

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const performDelete = (layer: Layer) => {
      const diagram = this.context.model.activeDiagram;
      UnitOfWork.executeWithUndo(diagram, 'Delete layer', uow => {
        for (const ref of layer.getInboundReferences()) {
          ref.diagram.layers.remove(ref, uow);
        }

        diagram.layers.remove(layer, uow);
      });
      diagram.layers.active = diagram.layers.visible[0]!;
    };

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
          precondition.is.present(id);

          const layer = this.context.model.activeDiagram.layers.byId(id);
          assert.present(layer);

          if (layer.getInboundReferences().length > 0) {
            queueMicrotask(() => {
              this.context.ui.showDialog(
                // TODO: This should be a confirm dialog
                new MessageDialogCommand(
                  {
                    title: 'Delete layer',
                    message:
                      'This layer is referenced by other layers. ' +
                      'Are you sure you want to delete this layer ' +
                      '(all referencing layers will be deleted)?',
                    okLabel: 'Yes',
                    cancelLabel: 'No'
                  },
                  () => {
                    performDelete(layer);
                  }
                )
              );
            });
          } else {
            performDelete(layer);
          }
        }
      )
    );
  }
}

export class LayerToggleVisibilityAction extends AbstractToggleAction<LayerActionArg> {
  name = $tStr('action.LAYER_TOGGLE_VISIBILITY.name', 'Toggle Layer Visibility');

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
  name = $tStr('action.LAYER_TOGGLE_LOCK.name', 'Toggle Layer Locked');

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

    UnitOfWork.executeWithUndo(diagram, 'Toggle layer locked', uow => {
      layer.setLocked(!layer.isLocked(), uow);
    });
  }
}

export class LayerRenameAction extends AbstractAction<LayerActionArg, Application> {
  name = $tStr('action.LAYER_RENAME.name', 'Rename Layer');

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
          UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Rename layer', uow => {
            layer.setName(name, uow);
          });
        }
      )
    );
  }
}

export class LayerAddAction extends AbstractAction<undefined, Application> {
  constructor(
    private readonly type: LayerType,
    public readonly name: TranslatedString,
    context: Application
  ) {
    super(context);
  }

  execute(): void {
    if (this.type === 'reference') {
      this.context.ui.showDialog(
        new ReferenceLayerDialogCommand(async ({ diagramId, layerId, name }) => {
          const diagram = this.context.model.activeDiagram;

          UnitOfWork.executeWithUndo(diagram, 'Add layer', uow => {
            const layer = new ReferenceLayer(
              newid(),
              typeof name === 'string' ? name : 'New Layer',
              diagram,
              { diagramId, layerId }
            );
            diagram.layers.add(layer, uow);
          });
        })
      );
    } else {
      this.context.ui.showDialog(
        new StringInputDialogCommand(
          {
            title:
              this.type === 'rule'
                ? 'New rule layer'
                : this.type === 'modification'
                  ? 'New modification layer'
                  : 'New layer',
            description: 'Enter a new name for the layer.',
            saveButtonLabel: 'Create',
            value: ''
          },
          async name => {
            const diagram = this.context.model.activeDiagram;

            UnitOfWork.executeWithUndo(diagram, 'Add layer', uow => {
              const layer =
                this.type === 'rule'
                  ? new RuleLayer(
                      newid(),
                      typeof name === 'string' ? name : 'New Layer',
                      diagram,
                      []
                    )
                  : this.type === 'modification'
                    ? new ModificationLayer(
                        newid(),
                        typeof name === 'string' ? name : 'New Layer',
                        diagram,
                        []
                      )
                    : new RegularLayer(
                        newid(),
                        typeof name === 'string' ? name : 'New Layer',
                        [],
                        diagram
                      );
              diagram.layers.add(layer, uow);
            });
          }
        )
      );
    }
  }
}

export class LayerSelectionMoveAction extends AbstractAction<LayerActionArg> {
  name = $tStr('action.LAYER_SELECTION_MOVE.name', 'Move to Layer');

  execute({ id }: LayerActionArg): void {
    precondition.is.present(id);

    const diagram = this.context.model.activeDiagram;
    const layer = diagram.layers.byId(id)!;
    assert.present(layer);

    UnitOfWork.executeWithUndo(diagram, `Move to layer ${layer.name}`, uow => {
      diagram.moveElement(diagram.selection.elements, uow, layer);
    });
  }
}

export class LayerSelectionMoveNewAction extends AbstractAction {
  name = $tStr('action.LAYER_SELECTION_MOVE_NEW.name', 'Create new layer');

  execute(): void {
    const diagram = this.context.model.activeDiagram;

    UnitOfWork.executeWithUndo(diagram, 'Move to new layer', uow => {
      const layer = new RegularLayer(newid(), 'New Layer', [], diagram);
      diagram.layers.add(layer, uow);

      diagram.moveElement(diagram.selection.elements, uow, layer);
      uow.select(diagram, diagram.selection.elements);
    });
  }
}
