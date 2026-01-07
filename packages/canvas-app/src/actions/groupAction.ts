import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Box } from '@diagram-craft/geometry/box';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
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

// TODO: Would be nice if we can do all of this with UOW instead
class SelectionStateUndoableAction implements UndoableAction {
  private oldSelection: string[];
  private newSelection: string[];

  description = 'Selection change';

  constructor(
    readonly diagram: Diagram,
    selection: ReadonlyArray<DiagramElement>
  ) {
    this.oldSelection = diagram.selection.elements.map(e => e.id);
    this.newSelection = selection.map(e => e.id);
  }

  undo() {
    this.diagram.selection.setElements(
      this.oldSelection.map(id => this.diagram.lookup(id)).filter(e => !!e)
    );
  }

  redo() {
    this.diagram.selection.setElements(
      this.newSelection.map(id => this.diagram.lookup(id)).filter(e => !!e)
    );
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
        uow.addAndExecute(new SelectionStateUndoableAction(diagram, children), 'first');

        children.forEach(e => {
          e.parent?.removeChild(e, uow);
          activeLayer.addElement(e, uow);
        });

        group.layer.removeElement(group, uow);
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
          e.layer.removeElement(e, uow);
        });

        group.setChildren([...elements], uow);

        uow.addAndExecute(new SelectionStateUndoableAction(diagram, [group]), 'last');
      });
    }
  }
}
