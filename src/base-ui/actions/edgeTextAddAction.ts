import { Action, ActionContext, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { precondition } from '../../utils/assert.ts';
import { LengthOffsetOnPath } from '../../geometry/pathPosition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { newid } from '../../utils/id.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

declare global {
  interface ActionMap {
    EDGE_TEXT_ADD: EdgeTextAddAction;
  }
}

export const edgeTextAddActions: ActionMapFactory = (state: State) => ({
  EDGE_TEXT_ADD: new EdgeTextAddAction(state.diagram)
});

export class EdgeTextAddAction extends EventEmitter<ActionEvents> implements Action {
  enabled = true;

  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    precondition.is.present(context.point);

    const edge = this.diagram.edgeLookup.get(context.id!);

    precondition.is.present(edge);

    const path = edge.path();
    const projection = path.projectPoint(context.point);

    const uow = new UnitOfWork(this.diagram);

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
      edge.parent.children = [...edge.parent.children, textNode];
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
    uow.commit();

    setTimeout(() => {
      this.diagram.nodeDefinitions.get('text')?.requestFocus(textNode);
    }, 10);
  }
}
