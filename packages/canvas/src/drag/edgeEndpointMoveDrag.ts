import { AbstractDrag } from '../dragDropManager.ts';
import { DiagramEdge } from '@diagram-craft/model';
import { Diagram } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { ConnectedEndpoint, Endpoint, FreeEndpoint, isConnected } from '@diagram-craft/model';
import { addHighlight, removeHighlight } from '../highlight.ts';
import { commitWithUndo } from '@diagram-craft/model';
import { isNode } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry';

const EDGE_HIGHLIGHT = 'edge-connect';

export class EdgeEndpointMoveDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;
  private hoverElement: string | undefined;
  coord: Point | undefined;

  constructor(
    private readonly diagram: Diagram,
    private readonly edge: DiagramEdge,
    private readonly type: 'start' | 'end'
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);
  }

  onDragEnter(id: string): void {
    const type = this.type;

    // Make sure we cannot connect to ourselves
    if (type === 'start' && isConnected(this.edge.end) && this.edge.end.node.id === id) return;
    if (type === 'end' && isConnected(this.edge.start) && this.edge.start.node.id === id) return;

    this.hoverElement = id;

    const el = this.diagram.lookup(id)!;

    if (isNode(el)) {
      el.anchors; // This looks like a noop, but it will trigger the anchors to be calculated
    }

    addHighlight(el, EDGE_HIGHLIGHT);
  }

  onDragLeave(): void {
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
  }

  private attachToClosestAnchor(coord: Point) {
    if (!this.hoverElement || !this.diagram.nodeLookup.has(this.hoverElement)) return;

    this.setEndpoint(
      new ConnectedEndpoint(
        this.getClosestAnchor(coord),
        this.diagram.nodeLookup.get(this.hoverElement)!
      )
    );
  }

  private setEndpoint(endpoint: Endpoint) {
    if (this.type === 'start') {
      this.edge.setStart(endpoint, this.uow);
    } else {
      this.edge.setEnd(endpoint, this.uow);
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
