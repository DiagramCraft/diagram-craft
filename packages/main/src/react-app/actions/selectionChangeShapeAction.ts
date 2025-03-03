import { Application } from '../../application';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { assert } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { deepClone, objectKeys } from '@diagram-craft/utils/object';
import { isNode } from '@diagram-craft/model/diagramElement';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';

declare global {
  interface ActionMap extends ReturnType<typeof selectionChangeShapeActions> {}
}

export const selectionChangeShapeActions = (context: Application) => ({
  SELECTION_CHANGE_SHAPE: new SelectionChangeShapeAction(context)
});

export class SelectionChangeShapeAction extends AbstractSelectionAction<Application> {
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
          title: 'Change shape'
        },
        onOk: (stencilId: string) => {
          const stencil = document.nodeDefinitions.stencilRegistry.getStencil(stencilId);

          assert.present(stencil);
          assertRegularLayer(diagram.activeLayer);

          const node = stencil.node(diagram);

          const uow = new UnitOfWork(diagram, true);

          for (const e of diagram.selectionState.elements) {
            if (isNode(e)) {
              e.changeNodeType(node.nodeType, uow);

              e.updateProps(props => {
                for (const k of objectKeys(props)) {
                  delete props[k];
                }
                for (const k of objectKeys(node.storedProps)) {
                  // @ts-ignore
                  props[k] = deepClone(node.storedProps[k]);
                }
              }, uow);

              // Add any source children
              node.children.forEach(c => e.addChild(c.duplicate(), uow));
            }
          }

          commitWithUndo(uow, 'Change shape');
        }
      });
    };

    if (diagram.selectionState.elements.some(e => isNode(e) && e.children.length > 0)) {
      this.context.ui.showDialog(
        new MessageDialogCommand(
          {
            title: "Can't change shape",
            message: 'Changing the shape of a node with children.',
            okLabel: 'Ok',
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
