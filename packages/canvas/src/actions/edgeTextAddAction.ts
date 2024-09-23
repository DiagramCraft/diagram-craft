import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { precondition } from '@diagram-craft/utils/assert';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import {
  ElementAddUndoableAction,
  SnapshotUndoableAction
} from '@diagram-craft/model/diagramUndoActions';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';
import { Point } from '@diagram-craft/geometry/point';

declare global {
  interface ActionMap extends ReturnType<typeof edgeTextAddActions> {}
}

export const edgeTextAddActions = (context: ActionContext) => ({
  EDGE_TEXT_ADD: new EdgeTextAddAction(context)
});

type EdgeTextAddActionArg = {
  point?: Point;
  id?: string;
};

export class EdgeTextAddAction extends AbstractAction<EdgeTextAddActionArg> {
  constructor(context: ActionContext) {
    super(context);
  }

  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram,
      'change',
      () => context.model.activeDiagram.activeLayer.type === 'regular'
    );
  }

  execute(context: EdgeTextAddActionArg): void {
    precondition.is.present(context.point);

    const edge = this.context.model.activeDiagram.edgeLookup.get(context.id!);

    precondition.is.present(edge);
    assertRegularLayer(edge.layer);
    assertRegularLayer(this.context.model.activeDiagram.activeLayer);

    const path = edge.path();
    const projection = path.projectPoint(context.point);

    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    const textNode = new DiagramNode(
      newid(),
      'text',
      { ...projection.point, r: 0, w: 100, h: 10 },
      this.context.model.activeDiagram,
      this.context.model.activeDiagram.activeLayer,
      {
        text: { align: 'center' },
        labelForEdgeId: edge.id,
        fill: {
          enabled: true,
          color: '#ffffff'
        }
      },
      {},
      { text: 'Label' }
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
    this.context.model.activeDiagram.undoManager.add(
      new CompoundUndoableAction([
        new ElementAddUndoableAction(
          [textNode],
          this.context.model.activeDiagram,
          this.context.model.activeDiagram.activeLayer
        ),
        new SnapshotUndoableAction(
          `Add edge text`,
          this.context.model.activeDiagram,
          snapshots.onlyUpdated()
        )
      ])
    );

    // Setting focus must be done after the element has been successfully rendered
    setTimeout(() => {
      this.context.model.activeDiagram.document.nodeDefinitions.get('text').requestFocus(textNode);
    }, 10);
  }
}
