import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
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

export const groupActions = (context: ActionContext) => ({
  GROUP_GROUP: new GroupAction('group', context),
  GROUP_UNGROUP: new GroupAction('ungroup', context)
});

declare global {
  interface ActionMap extends ReturnType<typeof groupActions> {}
}

class UndoableGroupAction implements UndoableAction {
  #elements: ReadonlyArray<DiagramElement> | undefined = undefined;
  #group: DiagramNode | undefined = undefined;

  constructor(
    private readonly diagram: Diagram,
    private readonly type: 'group' | 'ungroup'
  ) {}

  get description() {
    return this.type === 'group' ? 'Group' : 'Ungroup';
  }

  redo(uow: UnitOfWork): void {
    if (this.type === 'group') {
      this.group(uow);
    } else {
      this.ungroup(uow);
    }
  }

  undo(uow: UnitOfWork): void {
    if (this.type === 'group') {
      this.ungroup(uow);
    } else {
      this.group(uow);
    }
  }

  private group(uow: UnitOfWork) {
    if (this.#elements === undefined) {
      this.#elements = this.diagram.selection.elements.toSorted((a, b) => {
        return this.diagram.layers.isAbove(a, b) ? 1 : -1;
      });
    }

    this.#elements.forEach(e => {
      assertRegularLayer(e.layer);
      e.layer.removeElement(e, uow);
    });

    const layer = this.diagram.activeLayer;
    assertRegularLayer(layer);

    this.#group = ElementFactory.node(
      newid(),
      'group',
      Box.boundingBox(this.#elements.map(e => e.bounds)),
      layer,
      {},
      {}
    );
    this.#group.setChildren([...this.#elements], uow);

    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.activeLayer.addElement(this.#group, uow);

    this.diagram.selection.setElements([this.#group]);
  }

  private ungroup(uow: UnitOfWork) {
    if (this.#group === undefined) {
      this.#group = this.diagram.selection.elements[0] as DiagramNode;
    }

    const children = this.#group.children;

    this.#group.children.forEach(e => {
      assertRegularLayer(e.layer);
      e.layer.removeElement(e, uow);
    });

    assertRegularLayer(this.#group.layer);
    this.#group.layer.removeElement(this.#group, uow);
    this.#elements = this.#group.children;

    children.forEach(e => {
      this.#group?.removeChild(e, uow);
      assertRegularLayer(this.diagram.activeLayer);
      this.diagram.activeLayer.addElement(e, uow);
    });

    this.diagram.selection.setElements(children);
  }
}

export class GroupAction extends AbstractSelectionAction {
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
    this.context.model.activeDiagram.undoManager.addAndExecute(
      new UndoableGroupAction(this.context.model.activeDiagram, this.type)
    );
  }
}
