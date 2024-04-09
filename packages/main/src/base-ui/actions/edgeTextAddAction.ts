import { ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { precondition } from '@diagram-craft/utils';
import { DiagramNode } from '../../model/diagramNode.ts';
import { newid } from '@diagram-craft/utils';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { CompoundUndoableAction } from '../../model/undoManager.ts';
import {
  ElementAddUndoableAction,
  SnapshotUndoableAction
} from '../../model/diagramUndoActions.ts';
import { AbstractAction, ActionContext } from '../action.ts';
import { LengthOffsetOnPath } from '@diagram-craft/geometry';

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
      {
        ...projection.point,
        r: 0,
        w: 100,
        h: 10
      },
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

    setTimeout(() => {
      this.diagram.nodeDefinitions.get('text').requestFocus(textNode);
    }, 10);
  }
}
