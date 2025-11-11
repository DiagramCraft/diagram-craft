import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { precondition } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { makeUndoableAction } from '@diagram-craft/model/undoManager';
import { Point } from '@diagram-craft/geometry/point';
import { ResolvedLabelNode } from '@diagram-craft/model/diagramEdge';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof edgeTextAddActions> {}
  }
}

export const edgeTextAddActions = (context: ActionContext) => ({
  EDGE_TEXT_ADD: new EdgeTextAddAction(context)
});

type EdgeTextAddActionArg = {
  point?: Point;
  id?: string;
};

export class EdgeTextAddAction extends AbstractAction<EdgeTextAddActionArg> {
  getCriteria(context: ActionContext) {
    return ActionCriteria.EventTriggered(
      context.model.activeDiagram,
      'diagramChange',
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

    const textNode = ElementFactory.node(
      newid(),
      'text',
      { ...projection.point, r: 0, w: 100, h: 0 },
      this.context.model.activeDiagram.activeLayer,
      {
        text: { align: 'center' },
        fill: {
          enabled: true,
          color: '#ffffff'
        }
      },
      {},
      { text: 'Label' }
    );

    const labelNode: ResolvedLabelNode = {
      timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
      offset: { x: 0, y: 0 },
      id: textNode.id,
      node: () => textNode,
      type: 'horizontal'
    };

    this.context.model.activeDiagram.undoManager.addAndExecute(
      makeUndoableAction('Add label', {
        redo: uow => edge.addLabelNode(labelNode, uow),
        undo: uow => edge.removeLabelNode(labelNode, uow)
      })
    );

    // Setting focus must be done after the element has been successfully rendered
    setTimeout(() => {
      this.context.model.activeDiagram.document.nodeDefinitions.get('text').requestFocus(textNode);
    }, 10);
  }
}
