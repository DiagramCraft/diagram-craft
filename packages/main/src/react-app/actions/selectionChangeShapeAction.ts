import { Application } from '../../application';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { assert, mustExist, VerifyNotReached } from '@diagram-craft/utils/assert';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deepClone, getTypedKeys } from '@diagram-craft/utils/object';
import { isNode } from '@diagram-craft/model/diagramElement';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { $tStr } from '@diagram-craft/utils/localize';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { Box } from '@diagram-craft/geometry/box';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import {
  addStencilStylesToDocument,
  type StencilElements
} from '@diagram-craft/model/stencilRegistry';

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

          const stencilElements = stencil.forCanvas(diagram.document.registry);
          assert.true(stencilElements.elements.length > 0);

          UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
            addStencilStylesToDocument(stencil, diagram.document, uow);

            for (const e of diagram.selection.elements) {
              if (isNode(e)) {
                if (stencilElements.elements.length === 1) {
                  this.changeNodeToSingleElementStencil(
                    e,
                    diagram.activeLayer as RegularLayer,
                    stencilElements,
                    uow
                  );
                } else {
                  this.changeNodeToGroupStencil(
                    e,
                    diagram.activeLayer as RegularLayer,
                    stencilElements,
                    uow
                  );
                }

                /**
                 * Rendering logic assumes all node types remains as-is, when
                 * changing a node type, we need to force redraw the diagram.
                 */
                uow.on('after', 'undo', 'forceRedraw', () => {
                  diagram.emit('diagramChange');
                });
                uow.on('after', 'redo', 'forceRedraw', () => {
                  diagram.emit('diagramChange');
                });
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

  private changeNodeToSingleElementStencil(
    node: DiagramNode,
    layer: RegularLayer,
    stencilElements: StencilElements,
    uow: UnitOfWork
  ) {
    const source = stencilElements.elements[0]!;
    if (!isNode(source)) throw new VerifyNotReached();

    node.changeNodeType(source.nodeType, uow);

    node.updateProps(props => {
      for (const k of getTypedKeys(props)) {
        delete props[k];
      }
      const storedProps = deepClone(source.storedProps);
      for (const k of getTypedKeys(storedProps)) {
        // @ts-expect-error
        props[k] = storedProps[k];
      }
    }, uow);

    const children = cloneElements(source.children, layer);
    node.setChildren(children, uow);
  }

  private changeNodeToGroupStencil(
    node: DiagramNode,
    layer: RegularLayer,
    stencilElements: StencilElements,
    uow: UnitOfWork
  ) {
    const targetBounds = node.bounds;

    node.changeNodeType('group', uow);
    node.updateProps(props => {
      for (const k of getTypedKeys(props)) {
        delete props[k];
      }
    }, uow);

    const children = cloneElements(stencilElements.elements, layer);
    node.setChildren(children, uow);

    const sourceBounds = Box.boundingBox(children.map(e => e.bounds));
    assignNewBounds(
      children,
      { x: targetBounds.x, y: targetBounds.y },
      {
        x: targetBounds.w / (sourceBounds.w === 0 ? 1 : sourceBounds.w),
        y: targetBounds.h / (sourceBounds.h === 0 ? 1 : sourceBounds.h)
      },
      uow
    );
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
