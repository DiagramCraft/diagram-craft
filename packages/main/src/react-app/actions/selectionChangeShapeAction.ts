import { Application } from '../../application';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isNode } from '@diagram-craft/model/diagramElement';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr, $t } from '@diagram-craft/utils/localize';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { applyStencilToNode } from '@diagram-craft/model/stencilUtils';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof selectionChangeShapeActions> {}
  }
}

export const selectionChangeShapeActions = (context: Application) => ({
  SELECTION_CHANGE_SHAPE: new SelectionChangeShapeAction(context),
  SELECTION_CHANGE_TO_CONTAINER: new SelectionChangeToContainerAction(context)
});

export class SelectionChangeShapeAction extends AbstractSelectionAction<Application> {
  name = $tStr('action.SELECTION_CHANGE_SHAPE.name', 'Change Shape...');

  constructor(context: Application) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    const document = this.context.model.activeDocument;

    const performChangeShape = () => {
      this.context.ui.showDialog({
        id: 'shapeSelect',
        props: {
          title: 'Change shape',
          tabs: ['recent', 'search']
        },
        onOk: ({ id, type }: { id: string; type: 'stencil' | 'icon' }) => {
          assert.true(type === 'stencil');

          const stencil = document.registry.stencils.getStencil(id);

          assert.present(stencil);
          assertRegularLayer(diagram.activeLayer);
          const layer = diagram.activeLayer;

          UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
            for (const e of diagram.selection.elements) {
              if (isNode(e)) {
                applyStencilToNode(diagram, e, layer, stencil, uow);
              }
            }
          });
        }
      });
    };

    if (diagram.selection.elements.some(e => isNode(e) && e.children.length > 0)) {
      this.context.ui.showDialog(
        new MessageDialogCommand(
          {
            title: $t('dialog.shape.cannot_change_title', "Can't change shape"),
            message: $t(
              'dialog.shape.cannot_change_message',
              'Changing the shape of a node with children is not supported.'
            ),
            okLabel: $t('common.ok', 'Ok'),
            cancelLabel: undefined
          },
          () => {}
        )
      );
    } else {
      performChangeShape();
    }
  }
}

export class SelectionChangeToContainerAction extends AbstractSelectionAction<Application> {
  name = $tStr('action.SELECTION_CHANGE_TO_CONTAINER.name', 'Make container');

  constructor(context: Application) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Application): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.nodes.length !== 1) return false;

      const node = $s.nodes[0];
      if (!node) return false;

      const definition = node.getDefinition();
      return definition.hasFlag(NodeFlags.ChildrenCanConvertToContainer);
    };

    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', cb)
    ];
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    assertRegularLayer(diagram.activeLayer);

    UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
      const node = mustExist(diagram.selection.nodes[0]);
      const originalShape = node.nodeType;

      node.changeNodeType('container', uow);
      node.updateProps(props => {
        props.custom ??= {};
        props.custom.container ??= {};
        props.custom.container.shape = originalShape;
      }, uow);
    });
  }
}
