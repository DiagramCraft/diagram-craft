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

    // TODO: Focus the label node
    if (edge.labelNode) return;

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
          w: 20,
          h: 10
        }
      },
      [],
      { text: { text: 'Label' }, labelForEgdeId: edge.id },
      this.diagram,
      this.diagram.layers.active
    );
    edge.layer.addElement(textNode);

    edge.labelNode = {
      timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
      offset: { x: 0, y: 0 },
      id: textNode.id,
      node: textNode
    };

    this.diagram.updateElement(edge);

    /* TODO: Focus the label node */
  }
}
