import { Drag, DragEvents } from '../dragDropManager';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { EdgeEndpointMoveDrag } from './edgeEndpointMoveDrag';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { newid } from '@diagram-craft/utils/id';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Direction } from '@diagram-craft/geometry/direction';
import { Context } from '../context';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { createLinkedNode } from '../linkedNode';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';

export class AnchorHandleDrag extends Drag {
  edge: DiagramEdge;
  private delegate: EdgeEndpointMoveDrag;

  constructor(
    private readonly node: DiagramNode,
    private readonly anchorId: string,
    private readonly point: Point,
    private readonly context: Context
  ) {
    super();

    const diagram = this.node.diagram;
    const layer = diagram.activeLayer;
    assertRegularLayer(layer);

    this.edge = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(this.node, this.anchorId),
      new FreeEndpoint(diagram.viewBox.toDiagramPoint(this.point)),
      {},
      {
        style: diagram.document.styles.activeEdgeStylesheet.id
      },
      [],
      layer
    );

    diagram.undoManager.setMark();

    UnitOfWork.executeWithUndo(diagram, 'Add edge', uow => {
      layer.addElement(this.edge, uow);
    });

    diagram.selection.setElements([this.edge]);

    // TODO: This is the wrong this.element to use
    this.delegate = new EdgeEndpointMoveDrag(diagram, this.edge, 'end', this.context);
  }

  onDragEnd() {
    const diagram = this.node.diagram;

    const isShortDrag =
      this.delegate.point === undefined ||
      Point.distance(this.delegate.point, diagram.viewBox.toDiagramPoint(this.point)) < 5;

    if (isShortDrag) {
      // Undo work to drag new edge
      this.delegate.cancel();
      UnitOfWork.execute(this.node.diagram, uow => {
        this.edge.layer.removeElement(this.edge, uow);
        this.edge.detach(uow);
      });
      diagram.selection.setElements([]);

      createLinkedNode(
        this.node,
        this.anchorId,
        Direction.fromAngle(this.node.getAnchor(this.anchorId).normal ?? 0, true)
      );

      return;
    }

    this.delegate.onDragEnd();

    const previousActions = diagram.undoManager.getToMark();
    diagram.undoManager.setMark();
    diagram.undoManager.add(new CompoundUndoableAction(previousActions));

    // In case we have connected to an existing node, we don't need to show the popup
    if (this.edge.end.isConnected) return;

    this.context.ui.showNodeLinkPopup(this.edge.end.position, this.node.id, this.edge.id);
  }

  cancel() {
    this.delegate.cancel();
    UnitOfWork.execute(this.node.diagram, uow => {
      this.edge.layer.removeElement(this.edge, uow);
      this.edge.detach(uow);
    });
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
}
