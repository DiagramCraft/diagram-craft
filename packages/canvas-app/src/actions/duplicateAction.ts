import { AbstractSelectionAction } from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Translation } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import {
  AnchorEndpoint,
  ConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  PointInNodeEndpoint
} from '@diagram-craft/model/endpoint';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { deepClone } from '@diagram-craft/utils/object';
import { $tStr } from '@diagram-craft/utils/localize';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof duplicateActions> {}
  }
}

export const duplicateActions = (application: ActionContext) => ({
  DUPLICATE: new DuplicateAction(application)
});

const OFFSET = 10;

const reconnectEndpoint = (
  originalEndpoint: Endpoint,
  nodeMapping: Map<string, DiagramNode>
): Endpoint => {
  if (!(originalEndpoint instanceof ConnectedEndpoint)) {
    return originalEndpoint;
  }

  const duplicatedNode = nodeMapping.get(originalEndpoint.node.id);

  if (duplicatedNode) {
    // Reconnect to duplicated node
    if (originalEndpoint instanceof AnchorEndpoint) {
      return new AnchorEndpoint(duplicatedNode, originalEndpoint.anchorId, originalEndpoint.offset);
    } else if (originalEndpoint instanceof PointInNodeEndpoint) {
      return new PointInNodeEndpoint(
        duplicatedNode,
        originalEndpoint.ref,
        originalEndpoint.offset,
        originalEndpoint.offsetType
      );
    }
  }

  // Disconnect - convert to free endpoint
  return new FreeEndpoint(originalEndpoint.position);
};

export class DuplicateAction extends AbstractSelectionAction {
  name = $tStr('action.DUPLICATE.name', 'Duplicate');

  constructor(context: ActionContext) {
    super(context, 'both');
  }

  getCriteria(context: ActionContext): ActionCriteria[] {
    return [
      ...super.getCriteria(context),
      ActionCriteria.EventTriggered(
        context.model.activeDiagram,
        'diagramChange',
        () => context.model.activeDiagram.activeLayer.type === 'regular'
      )
    ];
  }

  execute() {
    const diagram = this.context.model.activeDiagram;

    UnitOfWork.executeWithUndo(diagram, 'Duplicate selection', uow => {
      // Check if all selected elements have the same parent
      const selection = [...diagram.selection.elements];
      const commonParent =
        selection.length > 0 && selection.every(e => e.parent === selection[0]?.parent)
          ? selection[0]?.parent
          : undefined;

      // Create mapping of original nodes to duplicated nodes
      const nodeMapping = new Map<string, DiagramNode>();
      const newElements: DiagramElement[] = [];

      const activeLayer = diagram.activeLayer;
      assertRegularLayer(activeLayer);

      // Duplicate selected nodes
      for (const node of diagram.selection.nodes) {
        const newNode = node.duplicate();
        this.add(newNode, activeLayer, commonParent, uow);
        newNode.transform([new Translation({ x: OFFSET, y: OFFSET })], uow);

        nodeMapping.set(node.id, newNode);
        newElements.push(newNode);
      }

      // Duplicate edges with proper reconnection logic
      for (const originalEdge of diagram.selection.edges) {
        const newStart = reconnectEndpoint(originalEdge.start, nodeMapping);
        const newEnd = reconnectEndpoint(originalEdge.end, nodeMapping);

        const newEdge = ElementFactory.edge(
          newid(),
          newStart,
          newEnd,
          deepClone(originalEdge.storedProps),
          originalEdge.metadata,
          [...originalEdge.waypoints],
          originalEdge.layer
        );
        this.add(newEdge, activeLayer, commonParent, uow);

        newEdge.transform([new Translation({ x: OFFSET, y: OFFSET })], uow);
        newElements.push(newEdge);
      }

      uow.select(
        diagram,
        newElements.map(e => e.id)
      );
    });

    this.emit('actionTriggered', {});
  }

  add(e: DiagramElement, layer: RegularLayer, parent: DiagramElement | undefined, uow: UnitOfWork) {
    if (parent) parent.addChild(e, uow);
    else layer.addElement(e, uow);
  }
}
