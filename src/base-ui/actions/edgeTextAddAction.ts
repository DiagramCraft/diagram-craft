import { Action, ActionContext, ActionEvents, ActionMapFactory, State } from '../keyMap.ts';
import { Diagram } from '../../model/diagram.ts';
import { EventEmitter } from '../../utils/event.ts';
import { precondition } from '../../utils/assert.ts';
import { LengthOffsetOnPath } from '../../geometry/pathPosition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { newid } from '../../utils/id.ts';

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

    const edge = this.diagram.edgeLookup[context.id!];

    precondition.is.present(edge);

    const path = edge.path();
    const projection = path.projectPoint(context.point);

    const textNode = new DiagramNode(
      newid(),
      'text',
      {
        pos: projection.point,
        rotation: 0,
        size: {
          w: 100,
          h: 10
        }
      },
      this.diagram,
      this.diagram.layers.active,
      {
        text: { text: 'Label', align: 'center' },
        labelForEgdeId: edge.id,
        fill: {
          enabled: true,
          color: '#ffffff'
        }
      }
    );

    if (edge.parent) {
      edge.parent.children = [...edge.parent.children, textNode];
    }
    edge.layer.addElement(textNode);

    edge.labelNodes ??= [];
    edge.labelNodes.push({
      timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
      offset: { x: 0, y: 0 },
      id: textNode.id,
      node: textNode,
      type: 'horizontal'
    });

    this.diagram.updateElement(edge);

    setTimeout(() => {
      this.diagram.nodeDefinitions.get('text')?.requestFocus(textNode);
    }, 10);
  }
}
