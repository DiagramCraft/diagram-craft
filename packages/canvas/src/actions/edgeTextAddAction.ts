import { ActionMapFactory, State } from '@diagram-craft/canvas/keyMap';
import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { precondition } from '@diagram-craft/utils/assert';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import {
  ElementAddUndoableAction,
  SnapshotUndoableAction
} from '@diagram-craft/model/diagramUndoActions';

declare global {
  interface ActionMap {
    EDGE_TEXT_ADD: EdgeTextAddAction;
  }
}

export const edgeTextAddActions: ActionMapFactory = (state: State) => ({
  EDGE_TEXT_ADD: new EdgeTextAddAction(state.diagram)
});

export class EdgeTextAddAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.point);

    const edge = this.diagram.edgeLookup.get(context.id!);

    precondition.is.present(edge);

    const path = edge.path();
    const projection = path.projectPoint(context.point);

    const uow = new UnitOfWork(this.diagram, true);

    const textNode = new DiagramNode(
      newid(),
      'text',
      { ...projection.point, r: 0, w: 100, h: 10 },
      this.diagram,
      this.diagram.layers.active,
      {
        text: { text: 'Label', align: 'center' },
        labelForEdgeId: edge.id,
        fill: {
          enabled: true,
          color: '#ffffff'
        }
      }
    );

    // Add text node to any parent group
    if (edge.parent) {
      edge.parent.setChildren([...edge.parent.children, textNode], uow);
    }

    edge.layer.addElement(textNode, uow);

    edge.addLabelNode(
      {
        timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
        offset: { x: 0, y: 0 },
        id: textNode.id,
        node: textNode,
        type: 'horizontal'
      },
      uow
    );

    uow.updateElement(edge);

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new CompoundUndoableAction([
        new ElementAddUndoableAction([textNode], this.diagram),
        new SnapshotUndoableAction(`Add edge text`, this.diagram, snapshots.onlyUpdated())
      ])
    );

    // Setting focus must be done after the element has been successfully rendered
    setTimeout(() => {
      this.diagram.document.nodeDefinitions.get('text').requestFocus(textNode);
    }, 10);
  }
}
