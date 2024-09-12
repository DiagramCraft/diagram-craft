import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { Box } from '@diagram-craft/geometry/box';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { newid } from '@diagram-craft/utils/id';
import { assertRegularLayer, RegularLayer } from '@diagram-craft/model/diagramLayer';

export const groupActions = (state: ActionConstructionParameters) => ({
  GROUP_GROUP: new GroupAction(state.diagram, 'group'),
  GROUP_UNGROUP: new GroupAction(state.diagram, 'ungroup')
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
      this.#elements = this.diagram.selectionState.elements.toSorted((a, b) => {
        return this.diagram.layers.isAbove(a, b) ? 1 : -1;
      });
    }

    this.#elements.forEach(e => {
      assertRegularLayer(e.layer);
      e.layer.removeElement(e, uow);
    });

    this.#group = new DiagramNode(
      newid(),
      'group',
      Box.boundingBox(this.#elements.map(e => e.bounds)),
      this.diagram,
      this.diagram.activeLayer,
      {},
      {}
    );
    this.#group.setChildren([...this.#elements], uow);

    assertRegularLayer(this.diagram.activeLayer);
    this.diagram.activeLayer.addElement(this.#group, uow);

    this.diagram.selectionState.setElements([this.#group]);
  }

  private ungroup(uow: UnitOfWork) {
    if (this.#group === undefined) {
      this.#group = this.diagram.selectionState.elements[0] as DiagramNode;
    }

    const children = this.#group.children;

    this.#group.children.forEach(e => {
      assertRegularLayer(e.layer);
      e.layer.removeElement(e, uow);
    });

    assertRegularLayer(this.#group.layer);
    this.#group.layer.removeElement(this.#group!, uow);
    this.#elements = this.#group.children;

    children.forEach(e => {
      this.#group?.removeChild(e, uow);
      assertRegularLayer(this.diagram.activeLayer);
      this.diagram.activeLayer.addElement(e, uow);
    });

    this.diagram.selectionState.setElements(children);
  }
}

export class GroupAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly type: 'group' | 'ungroup'
  ) {
    super(
      diagram,
      type === 'group' ? MultipleType.MultipleOnly : MultipleType.Both,
      ElementType.Both,
      ['regular']
    );

    this.addCriterion(diagram, 'change', () => this.diagram.activeLayer instanceof RegularLayer);

    if (type === 'ungroup') {
      this.addCriterion(this.diagram.selectionState, 'add', () =>
        this.diagram.selectionState.nodes.some(e => e.nodeType === 'group')
      );
      this.addCriterion(this.diagram.selectionState, 'remove', () =>
        this.diagram.selectionState.nodes.some(e => e.nodeType === 'group')
      );
    }
  }

  execute(): void {
    this.diagram.undoManager.addAndExecute(new UndoableGroupAction(this.diagram, this.type));
  }
}
