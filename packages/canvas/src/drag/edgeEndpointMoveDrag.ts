import { Drag, DragEvents, Modifiers } from '../dragDropManager';
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
import { getAnchorPosition, getClosestAnchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { assert } from '@diagram-craft/utils/assert';
import { Line } from '@diagram-craft/geometry/line';
import { Context } from '../context';
import { SnapManager } from '@diagram-craft/model/snap/snapManager';

export class EdgeEndpointMoveDrag extends Drag {
  private readonly uow: UnitOfWork;
  protected hoverElement: string | undefined;
  protected modifiers: Modifiers | undefined;

  point: Point | undefined;
  private snapManager: SnapManager;

  constructor(
    private readonly diagram: Diagram,
    public readonly edge: DiagramEdge,
    private readonly type: 'start' | 'end',
    protected context: Context
  ) {
    super();
    this.uow = new UnitOfWork(this.edge.diagram, true);

    // TODO: Make a helper for this ... as well as getting edges and nodes from ids
    document.getElementById(`diagram-${this.diagram.id}`)!.style.cursor = 'move';

    this.context.help.push(
      'EdgeEndpointMoveDrag',
      'Move waypoint. Cmd-drag to attach to any point in node.'
    );

    this.snapManager = this.diagram.createSnapManager();
  }

  onDragEnter({ id }: DragEvents.DragEnter): void {
    if (id === this.edge.id) return;
    if (!id) return;

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

  onDragLeave({ id }: DragEvents.DragLeave): void {
    if (id === this.edge.id) return;

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), Highlights.NODE__EDGE_CONNECT);
    }
    this.hoverElement = undefined;
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart) {
    const selection = this.diagram.selectionState;
    selection.highlights = [];

    this.point = offset;

    this.modifiers = modifiers;

    if (this.hoverElement && this.diagram.nodeLookup.has(this.hoverElement)) {
      if (modifiers.metaKey) {
        this.attachToPoint(offset);
      } else {
        this.attachToClosestAnchor(offset);
      }
    } else {
      if (!this.modifiers.shiftKey) {
        const res = this.snapManager.snapPoint(this.point!);
        this.point = res.adjusted;
      }

      this.setEndpoint(new FreeEndpoint(this.point));
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

    this.context.help.pop('EdgeEndpointMoveDrag');
    this.emit('dragEnd');
  }

  cancel() {
    this.uow.abort();
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

        const pp = Line.projectPoint(
          Line.of(
            getAnchorPosition(hoverNode, a.anchor, 'start'),
            getAnchorPosition(hoverNode, a.anchor, 'end')
          ),
          p
        );

        if (Point.distance(pp, p) > 10) return;

        const offset = this.calculateOffset(pp, ref, hoverNode.bounds);
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
    return Point.rotateAround(
      {
        x: relativePoint.x / bounds.w,
        y: relativePoint.y / bounds.h
      },
      -bounds.r,
      { x: 0.5, y: 0.5 }
    );
  }

  private setEndpoint(endpoint: Endpoint) {
    if (this.type === 'start') {
      this.edge.setStart(endpoint, this.uow);
    } else {
      this.edge.setEnd(endpoint, this.uow);
    }
  }
}
