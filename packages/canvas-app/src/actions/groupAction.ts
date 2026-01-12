import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { newid } from '@diagram-craft/utils/id';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

export const groupActions = (context: ActionContext) => ({
  GROUP_GROUP: new GroupAction('group', context),
  GROUP_UNGROUP: new GroupAction('ungroup', context)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof groupActions> {}
  }
}

const NAME_MAP: Record<'group' | 'ungroup', TranslatedString> = {
  group: $tStr('action.GROUP_GROUP.name', 'Group'),
  ungroup: $tStr('action.GROUP_UNGROUP.name', 'Ungroup')
};

export class GroupAction extends AbstractSelectionAction {
  name: TranslatedString;

  constructor(
    private readonly type: 'group' | 'ungroup',
    context: ActionContext
  ) {
    super(
      context,
      type === 'group' ? MultipleType.MultipleOnly : MultipleType.Both,
      ElementType.Both,
      ['regular']
    );
    this.name = NAME_MAP[type];
  }

  getCriteria(context: ActionContext) {
    const dest: ActionCriteria[] = [...super.getCriteria(context)];
    dest.push(
      ActionCriteria.EventTriggered(
        context.model.activeDiagram,
        'diagramChange',
        () => context.model.activeDiagram.activeLayer instanceof RegularLayer
      )
    );

    if (this.type === 'ungroup') {
      dest.push(
        ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', () =>
          context.model.activeDiagram.selection.nodes.some(e => e.nodeType === 'group')
        )
      );
      dest.push(
        ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', () =>
          context.model.activeDiagram.selection.nodes.some(e => e.nodeType === 'group')
        )
      );
    }

    return dest;
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;

    const activeLayer = diagram.activeLayer;
    assertRegularLayer(activeLayer);

    if (this.type === 'ungroup') {
      UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Ungroup', uow => {
        const group = diagram.selection.elements[0] as DiagramNode;
        assertRegularLayer(group.layer);

        const children = group.children;

        children.forEach(e => {
          e.parent?.removeChild(e, uow);
          activeLayer.addElement(e, uow);
        });
        group.layer.removeElement(group, uow);

        uow.select(
          diagram,
          children.map(e => e.id)
        );
      });
    } else {
      UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Group', uow => {
        const elements = diagram.selection.elements.toSorted((a, b) => {
          return diagram.layers.isAbove(a, b) ? 1 : -1;
        });

        const group = ElementFactory.node(
          newid(),
          'group',
          Box.boundingBox(elements.map(e => e.bounds)),
          activeLayer,
          {},
          {}
        );
        activeLayer.addElement(group, uow);

        elements.forEach(e => {
          assertRegularLayer(e.layer);
          if (e.layer.elements.includes(e)) e.layer.removeElement(e, uow);
        });

        group.setChildren([...elements], uow);

        uow.select(diagram, [group.id]);
      });
    }
  }
}
