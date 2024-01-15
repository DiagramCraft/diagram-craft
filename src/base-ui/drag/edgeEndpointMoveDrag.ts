import { AbstractDrag } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { Diagram } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { ConnectedEndpoint, FreeEndpoint, isConnected } from '../../model/endpoint.ts';
import { addHighlight, removeHighlight } from '../../react-canvas-editor/highlight.ts';

export class EdgeEndpointMoveDrag extends AbstractDrag {
  private hoverElement: string | undefined;
  coord: Point | undefined;

  constructor(
    private readonly diagram: Diagram,
    private readonly edge: DiagramEdge,
    private readonly type: 'start' | 'end'
  ) {
    super();
  }

  onDragEnter(id: string): void {
    // Make sure we cannot connect to ourselves
    if (this.type === 'start' && isConnected(this.edge.end) && this.edge.end.node.id === id) return;
    if (this.type === 'end' && isConnected(this.edge.start) && this.edge.start.node.id === id)
      return;

    this.hoverElement = id;

    if (id && this.diagram.nodeLookup.has(id)) {
      const el = this.diagram.nodeLookup.get(id)!;
      el.anchors;
    }

    const el = this.diagram.lookup(id)!;
    addHighlight(el, 'edge-connect');
  }

  onDragLeave(): void {
    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement)!, 'edge-connect');
    }
    this.hoverElement = undefined;
  }

  onDrag(coord: Point) {
    const selection = this.diagram.selectionState;

    selection.guides = [];

    const uow = new UnitOfWork(this.diagram);

    if (this.type === 'start') {
      this.edge.setStart(new FreeEndpoint(coord), uow);
    } else {
      this.edge.setEnd(new FreeEndpoint(coord), uow);
    }

    this.coord = coord;

    // TODO: We should snap to the connection point
    if (this.hoverElement && this.diagram.nodeLookup.has(this.hoverElement)) {
      this.attachToClosestAnchor(coord, uow);
    }

    uow.commit();
  }

  onDragEnd(): void {
    // Using the last known coordinate, attach to the closest anchor
    const uow = new UnitOfWork(this.diagram);
    this.attachToClosestAnchor(this.coord!, uow);

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement)!, 'edge-connect');
    }

    uow.commit();
    // TODO: Create undoable action
  }

  private attachToClosestAnchor(coord: Point, uow: UnitOfWork) {
    if (this.hoverElement && this.diagram.nodeLookup.has(this.hoverElement)) {
      if (this.type === 'start') {
        this.edge.setStart(
          new ConnectedEndpoint(
            this.getClosestAnchor(coord),
            this.diagram.nodeLookup.get(this.hoverElement)!
          ),
          uow
        );
      } else {
        this.edge.setEnd(
          new ConnectedEndpoint(
            this.getClosestAnchor(coord),
            this.diagram.nodeLookup.get(this.hoverElement)!
          ),
          uow
        );
      }
    }
  }

  private getClosestAnchor(coord: Point): number {
    const node = this.diagram.nodeLookup.get(this.hoverElement!)!;
    const anchors = node.anchors.map((a, idx) => {
      return {
        idx,
        x: node.bounds.x + a.point.x * node.bounds.w,
        y: node.bounds.y + a.point.y * node.bounds.h
      };
    });

    let closestAnchor = 0;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    for (const a of anchors) {
      const d = Point.squareDistance(coord, a);
      if (d < closestDistance) {
        closestAnchor = a.idx;
        closestDistance = d;
      }
    }

    return closestAnchor;
  }
}
