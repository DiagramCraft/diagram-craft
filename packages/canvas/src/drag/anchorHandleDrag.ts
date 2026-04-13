import { Drag, DragEvents } from '../dragDropManager';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { EdgeEndpointMoveDrag } from './edgeEndpointMoveDrag';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import {
  AnchorEndpoint,
  FreeEndpoint,
  isConnectedEndpoint,
  PointInNodeEndpoint
} from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Direction } from '@diagram-craft/geometry/direction';
import { Context } from '../context';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import {
  createLinkedNode,
  createLinkedNodeFromSource,
  createProvisionalLinkedNode
} from '../linkedNode';
import type { AnchorHandleDragSource } from './anchorHandleDragSource';

const makeEndpoint = (node: DiagramNode, source: AnchorHandleDragSource) => {
  if (source.type === 'anchor') {
    return new AnchorEndpoint(node, source.anchorId);
  } else if (source.type === 'edge-anchor') {
    return new AnchorEndpoint(node, source.anchorId, source.offset);
  } else {
    return new PointInNodeEndpoint(node, undefined, source.offset, 'relative');
  }
};

export class AnchorHandleDrag extends Drag {
  edge: DiagramEdge;
  private delegate: EdgeEndpointMoveDrag;

  constructor(
    private readonly node: DiagramNode,
    private readonly source: AnchorHandleDragSource,
    private readonly point: Point,
    private readonly context: Context
  ) {
    super();

    const diagram = this.node.diagram;
    const layer = diagram.activeLayer;
    assertRegularLayer(layer);

    this.edge = ElementFactory.edge({
      start: makeEndpoint(this.node, this.source),
      end: new FreeEndpoint(diagram.viewBox.toDiagramPoint(this.point)),
      metadata: {
        style: diagram.document.styles.activeEdgeStylesheet.id
      },
      layer
    });

    diagram.undoManager.setMark();

    diagram.undoManager.execute('Add edge', uow => layer.addElement(this.edge, uow));

    diagram.selection.setElements([this.edge]);

    // TODO: This is the wrong this.element to use
    this.delegate = new EdgeEndpointMoveDrag(diagram, this.edge, 'end', this.context);
  }

  onDragEnd() {
    const diagram = this.node.diagram;

    const isShortDrag =
      this.delegate.point === undefined ||
      Point.distance(this.delegate.point, diagram.viewBox.toDiagramPoint(this.point)) < 5;

    // This is in case the drag should be registered as a simple click instead
    // In this case, we want to fall back on createLinkedNode behaviour
    if (isShortDrag) {
      // Undo the "short" edge
      this.delegate.cancel();
      UnitOfWork.execute(this.node.diagram, uow => this.edge.layer.removeElement(this.edge, uow));
      diagram.selection.setElements([]);

      this.createLinkedNodeForShortDrag();

      return;
    }

    this.delegate.onDragEnd();

    let newNodeId: string | undefined;

    // In case we have connected to an existing node, we don't need to show the popup
    if (!isConnectedEndpoint(this.edge.end)) {
      const newNode = createProvisionalLinkedNode(this.node, this.edge, this.edge.end.position);
      newNodeId = newNode.id;
    }

    const previousActions = diagram.undoManager.getToMark();
    const definition = this.node.getDefinition();

    const nodeLinkOptions = definition.getNodeLinkOptions?.(this.node);

    /** @see NodeLinkPopup */
    this.context.ui.showNodeLinkPopup(
      this.edge.end.position,
      newNodeId,
      this.edge.id,
      previousActions,
      nodeLinkOptions
    );
  }

  cancel() {
    this.delegate.cancel();
    UnitOfWork.execute(this.node.diagram, uow => this.edge.layer.removeElement(this.edge, uow));
    this.node.diagram.selection.setElements([]);
  }

  onDrag(event: DragEvents.DragStart): void {
    this.delegate.onDrag(event);
  }

  onDragEnter(event: DragEvents.DragEnter): void {
    this.delegate.onDragEnter(event);
  }

  onDragLeave(event: DragEvents.DragLeave) {
    this.delegate.onDragLeave(event);
  }

  private createLinkedNodeForShortDrag() {
    switch (this.source.type) {
      case 'anchor':
        createLinkedNode(
          this.node,
          this.source.anchorId,
          Direction.fromAngle(
            this.source.normal ?? this.node.getAnchor(this.source.anchorId).normal ?? 0,
            true
          )
        );
        break;

      case 'edge-anchor':
      case 'boundary-point': {
        const endpoint = makeEndpoint(this.node, this.source);

        createLinkedNodeFromSource(
          this.node,
          {
            point: this.source.point ?? endpoint.position,
            endpoint: () => endpoint
          },
          Direction.fromAngle(this.source.normal ?? 0, true)
        );
      }
    }
  }
}
