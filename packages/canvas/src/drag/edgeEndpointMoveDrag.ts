import { AbstractDrag } from '../dragDropManager';
import { addHighlight, removeHighlight } from '../highlight';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import {
  ConnectedEndpoint,
  Endpoint,
  FixedEndpoint,
  FreeEndpoint,
  isConnectedOrFixed
} from '@diagram-craft/model/endpoint';
import { isNode } from '@diagram-craft/model/diagramElement';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { getClosestAnchor } from '@diagram-craft/model/anchor';

const EDGE_HIGHLIGHT = 'edge-connect';

export class EdgeEndpointMoveDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;
  private hoverElement: string | undefined;
  coord: Point | undefined;

  constructor(
    private readonly diagram: Diagram,
    public readonly edge: DiagramEdge,
    private readonly type: 'start' | 'end',
    private applicationTriggers: ApplicationTriggers
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);

    // TODO: Make a helper for this ... as well as getting edges and nodes from ids
    document.getElementById(`diagram-${this.diagram.id}`)!.style.cursor = 'move';

    this.applicationTriggers.pushHelp?.('EdgeEndpointMoveDrag', 'Move waypoint');
  }

  onDragEnter(id: string): void {
    if (id === this.edge.id) return;

    const type = this.type;

    // Make sure we cannot connect to ourselves
    if (type === 'start' && isConnectedOrFixed(this.edge.end) && this.edge.end.node.id === id)
      return;
    if (type === 'end' && isConnectedOrFixed(this.edge.start) && this.edge.start.node.id === id)
      return;

    this.hoverElement = id;

    const el = this.diagram.lookup(id)!;

    if (isNode(el)) {
      el.anchors; // This looks like a noop, but it will trigger the anchors to be calculated
    }

    addHighlight(el, EDGE_HIGHLIGHT);
  }

  onDragLeave(id?: string): void {
    if (id === this.edge.id) return;

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), EDGE_HIGHLIGHT);
    }
    this.hoverElement = undefined;
  }

  onDrag(coord: Point) {
    const selection = this.diagram.selectionState;
    selection.guides = [];

    this.setEndpoint(new FreeEndpoint(coord));

    this.coord = coord;

    if (this.hoverElement && this.diagram.nodeLookup.has(this.hoverElement)) {
      this.attachToClosestAnchor(coord);
    }

    this.uow.notify();
  }

  onDragEnd(): void {
    this.attachToClosestAnchor(this.coord!);

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), EDGE_HIGHLIGHT);
    }

    commitWithUndo(this.uow, 'Move edge endpoint');
    document.getElementById(`diagram-${this.diagram.id}`)!.style.cursor = 'unset';

    this.applicationTriggers.popHelp?.('EdgeEndpointMoveDrag');
    this.emit('dragEnd');
  }

  private attachToClosestAnchor(coord: Point) {
    if (!this.hoverElement || !this.diagram.nodeLookup.has(this.hoverElement)) return;

    const a = getClosestAnchor(coord, this.diagram.nodeLookup.get(this.hoverElement)!, true);
    if (!a) return;

    if (a.anchor) {
      this.setEndpoint(
        new ConnectedEndpoint(a.anchor.id, this.diagram.nodeLookup.get(this.hoverElement)!)
      );
    } else {
      const bounds = this.diagram.nodeLookup.get(this.hoverElement)!.bounds;
      const relativePoint = Point.subtract(a.point, bounds);
      const offset = Point.rotateAround(
        {
          x: relativePoint.x / bounds.w,
          y: relativePoint.y / bounds.h
        },
        -bounds.r,
        { x: 0.5, y: 0.5 }
      );

      this.setEndpoint(
        new FixedEndpoint(
          undefined,
          offset,
          this.diagram.nodeLookup.get(this.hoverElement)!,
          'relative',
          'boundary'
        )!
      );
    }
  }

  private setEndpoint(endpoint: Endpoint) {
    if (this.type === 'start') {
      this.edge.setStart(endpoint, this.uow);
    } else {
      this.edge.setEnd(endpoint, this.uow);
    }
  }
}
