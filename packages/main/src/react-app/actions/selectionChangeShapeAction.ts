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
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { SerializedElement } from '@diagram-craft/model/serialization/serializedTypes';

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
          excludeMultiElementStencils: true,
          tabs: ['recent', 'search']
        },
        onOk: ({ id, type }: { id: string; type: 'stencil' | 'icon' }) => {
          assert.false(type === 'stencil');

          const stencil = document.registry.stencils.getStencil(id);

          assert.present(stencil);
          assertRegularLayer(diagram.activeLayer);

          const { elements } = stencil.forPicker(diagram.document.registry);
          assert.arrayWithExactlyOneElement(elements);
          const source = elements[0]!;
          if (!isNode(source)) throw new VerifyNotReached();

          UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
            for (const e of diagram.selection.elements) {
              if (isNode(e)) {
                e.changeNodeType(source.nodeType, uow);

                e.updateProps(props => {
                  for (const k of getTypedKeys(props)) {
                    delete props[k];
                  }
                  const storedProps = deepClone(source.storedProps);
                  for (const k of getTypedKeys(storedProps)) {
                    // @ts-expect-error
                    props[k] = storedProps[k];
                  }
                }, uow);

                // Add any source children
                const serialized: Array<SerializedElement> = [];
                source.children.forEach(c => {
                  serialized.push(serializeDiagramElement(c));
                });

                deserializeDiagramElements(
                  serialized,
                  e.diagram.activeLayer as RegularLayer,
                  uow,
                  e,
                  new ElementLookup<DiagramNode>(),
                  new ElementLookup<DiagramEdge>()
                );

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
