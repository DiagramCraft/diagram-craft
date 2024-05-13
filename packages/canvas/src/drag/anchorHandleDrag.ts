import { AbstractDrag, Modifiers } from '../dragDropManager';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { EdgeEndpointMoveDrag } from './edgeEndpointMoveDrag';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { newid } from '@diagram-craft/utils/id';
import { ConnectedEndpoint, FreeEndpoint, isConnectedOrFixed } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { VerifyNotReached } from '@diagram-craft/utils/assert';

export class AnchorHandleDrag extends AbstractDrag {
  edge: DiagramEdge;
  private delegate: EdgeEndpointMoveDrag;

  constructor(
    private readonly node: DiagramNode,
    private readonly anchorIndex: number,
    private readonly point: Point,
    private readonly applicationTriggers: ApplicationTriggers
  ) {
    super();

    const diagram = this.node.diagram;

    this.edge = new DiagramEdge(
      newid(),
      new ConnectedEndpoint(this.anchorIndex, this.node),
      new FreeEndpoint(diagram.viewBox.toDiagramPoint(this.point)),
      {},
      [],
      diagram,
      diagram.layers.active
    );

    const uow = new UnitOfWork(diagram);
    diagram.layers.active.addElement(this.edge, uow);

    uow.updateElement(this.node);
    uow.commit();

    diagram.selectionState.setElements([this.edge]);

    // TODO: This is the wrong this.element to use
    this.delegate = new EdgeEndpointMoveDrag(diagram, this.edge, 'end', applicationTriggers);
  }

  onDragEnd() {
    const diagram = this.node.diagram;

    if (
      this.delegate.coord === undefined ||
      Point.distance(this.delegate.coord!, diagram.viewBox.toDiagramPoint(this.point)) < 5
    ) {
      UnitOfWork.execute(this.node.diagram, uow => {
        this.edge.layer.removeElement(this.edge, uow);
        this.edge.detach(uow);
      });
      diagram.selectionState.setElements([]);
      return;
    }

    this.node.diagram.undoManager.add(new ElementAddUndoableAction([this.edge], this.node.diagram));

    // TODO: Need to prevent undoable action from being added twice
    this.delegate.onDragEnd();

    // In case we have connected to an existing node, we don't need to show the popup
    if (isConnectedOrFixed(this.edge.end)) {
      return;
    }

    const startNode = this.edge.start;
    if (!isConnectedOrFixed(startNode)) throw new VerifyNotReached();
    this.applicationTriggers.showNodeLinkPopup?.(
      this.edge.end.position,
      startNode.node!.id,
      this.edge.id
    );
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    this.delegate.onDrag(coord);
  }

  onDragEnter(id: string) {
    this.delegate.onDragEnter(id);
  }

  onDragLeave() {
    this.delegate.onDragLeave();
  }
}
