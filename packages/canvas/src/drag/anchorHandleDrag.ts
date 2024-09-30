import { AbstractDrag, Modifiers } from '../dragDropManager';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { EdgeEndpointMoveDrag } from './edgeEndpointMoveDrag';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { newid } from '@diagram-craft/utils/id';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { Direction } from '@diagram-craft/geometry/direction';
import { createLinkedNode } from '@diagram-craft/canvas-app/actions/linkedNodeAction';
import { Context } from '../ApplicationTriggers';
import { assertRegularLayer, RegularLayer } from '@diagram-craft/model/diagramLayer';

export class AnchorHandleDrag extends AbstractDrag {
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
    assertRegularLayer(diagram.activeLayer);

    this.edge = new DiagramEdge(
      newid(),
      new AnchorEndpoint(this.node, this.anchorId),
      new FreeEndpoint(diagram.viewBox.toDiagramPoint(this.point)),
      {},
      {
        style: diagram.document.styles.activeEdgeStylesheet.id
      },
      [],
      diagram,
      diagram.activeLayer
    );

    diagram.undoManager.setMark();

    const uow = new UnitOfWork(diagram);
    diagram.activeLayer.addElement(this.edge, uow);

    uow.updateElement(this.node);
    uow.commit();

    diagram.selectionState.setElements([this.edge]);

    // TODO: This is the wrong this.element to use
    this.delegate = new EdgeEndpointMoveDrag(diagram, this.edge, 'end', this.context);
  }

  onDragEnd() {
    const diagram = this.node.diagram;

    const isShortDrag =
      this.delegate.point === undefined ||
      Point.distance(this.delegate.point!, diagram.viewBox.toDiagramPoint(this.point)) < 5;

    if (isShortDrag) {
      // Undo work to drag new edge
      this.delegate.cancel();
      UnitOfWork.execute(this.node.diagram, uow => {
        if (this.edge.layer instanceof RegularLayer) {
          this.edge.layer.removeElement(this.edge, uow);
        }
        this.edge.detach(uow);
      });
      diagram.selectionState.setElements([]);

      createLinkedNode(
        this.node,
        this.anchorId,
        Direction.fromAngle(this.node.getAnchor(this.anchorId).normal ?? 0, true)
      );

      return;
    }

    assertRegularLayer(this.node.diagram.activeLayer);
    this.node.diagram.undoManager.add(
      new ElementAddUndoableAction([this.edge], this.node.diagram, this.node.diagram.activeLayer)
    );

    // TODO: Need to prevent undoable action from being added twice
    this.delegate.onDragEnd();

    // In case we have connected to an existing node, we don't need to show the popup
    if (this.edge.end.isConnected) return;

    this.context.ui.showNodeLinkPopup?.(this.edge.end.position, this.node!.id, this.edge.id);
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    this.delegate.onDrag(coord, _modifiers);
  }

  onDragEnter(id: string) {
    this.delegate.onDragEnter(id);
  }

  onDragLeave() {
    this.delegate.onDragLeave();
  }
}
