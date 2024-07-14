import { AbstractDrag, Modifiers } from '../dragDropManager';
import { addHighlight, Highlights, removeHighlight } from '../highlight';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import {
  AnchorEndpoint,
  ConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  PointInNodeEndpoint
} from '@diagram-craft/model/endpoint';
import { isNode } from '@diagram-craft/model/diagramElement';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { getClosestAnchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { assert } from '@diagram-craft/utils/assert';

export class EdgeEndpointMoveDrag extends AbstractDrag {
  private readonly uow: UnitOfWork;
  private hoverElement: string | undefined;
  private modifiers: Modifiers | undefined;

  point: Point | undefined;

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

    this.applicationTriggers.pushHelp?.(
      'EdgeEndpointMoveDrag',
      'Move waypoint. Shift-drag to attach to any point in node.'
    );
  }

  onDragEnter(id: string): void {
    if (id === this.edge.id) return;

    const type = this.type;

    // Make sure we cannot connect to ourselves
    if (
      type === 'start' &&
      this.edge.end instanceof ConnectedEndpoint &&
      this.edge.end.node.id === id
    )
      return;
    if (
      type === 'end' &&
      this.edge.start instanceof ConnectedEndpoint &&
      this.edge.start.node.id === id
    )
      return;

    this.hoverElement = id;

    const el = this.diagram.lookup(id)!;

    if (isNode(el)) {
      el.anchors; // This looks like a noop, but it will trigger the anchors to be calculated
    }

    addHighlight(el, Highlights.NODE__EDGE_CONNECT);
  }

  onDragLeave(id?: string): void {
    if (id === this.edge.id) return;

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), Highlights.NODE__EDGE_CONNECT);
    }
    this.hoverElement = undefined;
  }

  onDrag(p: Point, modifiers: Modifiers) {
    const selection = this.diagram.selectionState;
    selection.guides = [];

    this.setEndpoint(new FreeEndpoint(p));

    this.point = p;

    this.modifiers = modifiers;

    if (this.hoverElement && this.diagram.nodeLookup.has(this.hoverElement)) {
      if (modifiers.shiftKey) {
        this.attachToPoint(p);
      } else {
        this.attachToClosestAnchor(p);
      }
    }

    this.uow.notify();
  }

  onDragEnd(): void {
    if (this.modifiers?.shiftKey) {
      this.attachToPoint(this.point!);
    } else {
      this.attachToClosestAnchor(this.point!);
    }

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), Highlights.NODE__EDGE_CONNECT);
    }

    commitWithUndo(this.uow, 'Move edge endpoint');
    document.getElementById(`diagram-${this.diagram.id}`)!.style.cursor = 'unset';

    this.applicationTriggers.popHelp?.('EdgeEndpointMoveDrag');
    this.emit('dragEnd');
  }

  private attachToClosestAnchor(p: Point) {
    if (!this.hoverElement || !this.diagram.nodeLookup.has(this.hoverElement)) return;

    const hoverNode = this.diagram.nodeLookup.get(this.hoverElement);
    assert.present(hoverNode);

    const a = getClosestAnchor(p, hoverNode, true);
    if (!a) return;

    if (a.anchor) {
      if (a.anchor.type !== 'edge') {
        this.setEndpoint(new AnchorEndpoint(hoverNode, a.anchor.id));
        addHighlight(hoverNode, Highlights.NODE__EDGE_CONNECT, 'anchor');
      } else {
        const ref = Box.fromOffset(hoverNode.bounds, a.anchor.start);
        const offset = this.calculateOffset(p, ref, hoverNode.bounds);
        addHighlight(hoverNode, Highlights.NODE__EDGE_CONNECT, 'anchor-edge');

        this.setEndpoint(new AnchorEndpoint(hoverNode, a.anchor.id, offset)!);
      }
    } else {
      addHighlight(hoverNode, Highlights.NODE__EDGE_CONNECT, 'edge');

      const offset = this.calculateOffset(a.point, hoverNode.bounds, hoverNode.bounds);

      this.setEndpoint(new PointInNodeEndpoint(hoverNode, undefined, offset, 'relative')!);
    }
  }

  private attachToPoint(p: Point) {
    if (!this.hoverElement || !this.diagram.nodeLookup.has(this.hoverElement)) return;

    const hoverNode = this.diagram.nodeLookup.get(this.hoverElement);
    assert.present(hoverNode);

    addHighlight(hoverNode, Highlights.NODE__EDGE_CONNECT, 'point');

    const offset = this.calculateOffset(p, hoverNode.bounds, hoverNode.bounds);

    this.setEndpoint(new PointInNodeEndpoint(hoverNode, undefined, offset, 'relative')!);
  }

  private calculateOffset(p: Point, ref: Point, bounds: Box) {
    const relativePoint = Point.subtract(p, ref);
    const offset = Point.rotateAround(
      {
        x: relativePoint.x / bounds.w,
        y: relativePoint.y / bounds.h
      },
      -bounds.r,
      { x: 0.5, y: 0.5 }
    );
    return offset;
  }

  private setEndpoint(endpoint: Endpoint) {
    if (this.type === 'start') {
      this.edge.setStart(endpoint, this.uow);
    } else {
      this.edge.setEnd(endpoint, this.uow);
    }
  }
}
