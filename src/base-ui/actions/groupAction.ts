import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { UndoableAction } from '../../model/undoManager.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { newid } from '../../utils/id.ts';
import { Box } from '../../geometry/box.ts';
import { DiagramElement } from '../../model/diagramElement.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

declare global {
  interface ActionMap {
    GROUP_GROUP: GroupAction;
    GROUP_UNGROUP: GroupAction;
  }
}

export const groupActions: ActionMapFactory = (state: State) => ({
  GROUP_GROUP: new GroupAction(state.diagram, 'group'),
  GROUP_UNGROUP: new GroupAction(state.diagram, 'ungroup')
});

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

  redo(): void {
    if (this.type === 'group') {
      this.group();
    } else {
      this.ungroup();
    }
  }

  undo(): void {
    if (this.type === 'group') {
      this.ungroup();
    } else {
      this.group();
    }
  }

  private group() {
    if (this.#elements === undefined) {
      this.#elements = this.diagram.selectionState.elements;
    }

    const uow = new UnitOfWork(this.diagram);

    this.#elements.forEach(e => {
      e.layer.removeElement(e, uow);
    });

    this.#group = new DiagramNode(
      newid(),
      'group',
      Box.boundingBox(this.#elements.map(e => e.bounds)),
      this.diagram,
      this.diagram.layers.active
    );
    this.#group.setChildren([...this.#elements], uow);

    this.diagram.layers.active.addElement(this.#group, uow);

    this.diagram.selectionState.setElements([this.#group]);

    uow.commit();
  }

  private ungroup() {
    if (this.#group === undefined) {
      this.#group = this.diagram.selectionState.elements[0] as DiagramNode;
    }

    const uow = new UnitOfWork(this.diagram);
    const children = this.#group.children;

    this.#group.children.forEach(e => {
      e.layer.removeElement(e, uow);
    });

    this.#group.layer.removeElement(this.#group!, uow);
    this.#elements = this.#group.children;

    children.toReversed().forEach(e => {
      this.#group?.removeChild(e, uow);
      this.diagram.layers.active.addElement(e, uow);
    });

    this.diagram.selectionState.setElements(children);
    uow.commit();
  }
}

export class GroupAction extends AbstractSelectionAction {
  constructor(
    protected readonly diagram: Diagram,
    private readonly type: 'group' | 'ungroup'
  ) {
    super(diagram, type === 'group');
    if (type === 'ungroup') {
      diagram.selectionState.on('change', () => {
        this.enabled = diagram.selectionState.nodes.some(e => e.nodeType === 'group');
        this.emit('actionchanged', { action: this });
      });
      this.enabled = diagram.selectionState.nodes.some(e => e.nodeType === 'group');
    }
  }

  execute(): void {
    this.diagram.undoManager.addAndExecute(new UndoableGroupAction(this.diagram, this.type));
  }
}
