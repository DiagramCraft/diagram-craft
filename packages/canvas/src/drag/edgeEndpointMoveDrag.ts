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
import { findCommonAncestor, isNode } from '@diagram-craft/model/diagramElement';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { getAnchorPosition, getClosestAnchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { assert } from '@diagram-craft/utils/assert';
import { Line } from '@diagram-craft/geometry/line';
import { Context } from '../context';
import { SnapManager, SnapMarkers } from '../snap/snapManager';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import { Vector } from '@diagram-craft/geometry/vector';
import { Path } from '@diagram-craft/geometry/path';

export class EdgeEndpointMoveDrag extends Drag {
  readonly uow: UnitOfWork;
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
    this.uow = UnitOfWork.begin(this.edge.diagram);

    CanvasDomHelper.diagramElement(this.diagram)!.style.cursor = 'move';

    this.context.help.push(
      'EdgeEndpointMoveDrag',
      'Move waypoint. Cmd-drag to attach to any point in node.'
    );

    this.snapManager = SnapManager.create(this.diagram);
  }

  onDragEnter({ id }: DragEvents.DragEnter): void {
    if (id === this.edge.id) return;
    if (!id) return;

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
    SnapMarkers.get(this.diagram).clear();

    this.point = offset;

    this.modifiers = modifiers;

    if (this.hoverElement && this.diagram.nodeLookup.has(this.hoverElement)) {
      if (this.shouldAttachToPoint()) {
        this.attachToPoint(offset);
      } else {
        this.attachToClosestAnchor(offset);
      }
    } else {
      if (!this.modifiers.shiftKey) {
        const res = this.snapManager.snapPoint(this.point);
        this.point = res.adjusted;
      }

      this.setEndpoint(new FreeEndpoint(this.point));
    }

    this.uow.notify();

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    if (this.shouldAttachToPoint()) {
      this.attachToPoint(this.point!);
    } else {
      this.attachToClosestAnchor(this.point!);
    }

    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), Highlights.NODE__EDGE_CONNECT);
    }

    if (
      this.edge.start instanceof ConnectedEndpoint &&
      this.edge.end instanceof ConnectedEndpoint &&
      this.edge.start.node.id === this.edge.end.node.id &&
      this.edge.waypoints.length === 0
    ) {
      this.addLoopEndpoint();
    }

    // Update edge parent based on connected nodes
    this.updateEdgeParent();

    this.uow.commitWithUndo('Move edge endpoint');
    CanvasDomHelper.diagramElement(this.diagram)!.style.cursor = 'unset';

    this.context.help.pop('EdgeEndpointMoveDrag');
    this.emit('dragEnd');
  }

  private addLoopEndpoint() {
    if (!(this.edge.start instanceof ConnectedEndpoint)) return;
    if (!(this.edge.end instanceof ConnectedEndpoint)) return;

    // The idea is to take the midpoint between the two endpoints and create a normal ray and determine
    // all intersections with the boundary path. We then take points along the normal, with a fixed distance
    // to the intersection points. We then keep the points that fall outside the shape, and pick
    // the one closest to the midpoint

    const midpoint = Line.midpoint(Line.of(this.edge.start.position, this.edge.end.position));
    const normal = Vector.normalize(
      Vector.tangentToNormal(Vector.from(midpoint, this.edge.start.position))
    );

    // Extend the normal to be sufficiently long to intersect with all parts of the shape boundary
    const ray = Line.extend(Line.of(midpoint, Point.add(midpoint, normal)), 100000, 100000);

    const node = this.edge.start.node;
    const nodeDef = node.getDefinition();
    const intersections = nodeDef
      .getBoundingPath(node)
      .intersections(new Path(ray.from, [['L', ray.to.x, ray.to.y]]));

    const dimension = Math.min(node.bounds.w, node.bounds.h);

    // For all intersections, we follow the ray in both directions
    let potentialWaypoints: Point[] = [];
    for (const intersection of intersections) {
      const p1 = Point.add(intersection, normal);
      const p2 = Point.subtract(intersection, normal);

      for (const p of [p1, p2]) {
        potentialWaypoints.push(Line.extend(Line.of(intersection, p), 0, dimension / 2).to);
      }
    }

    // Drop all points that are inside the node's bounding box
    potentialWaypoints = potentialWaypoints.filter(p => !Box.contains(node.bounds, p));

    // Find the closest waypoint to the midpoint - however, ensure it is not too close
    const closestWaypoint = potentialWaypoints.reduce((prev, curr) => {
      const d = Point.distance(curr, midpoint);
      return d > dimension / 3 && d < Point.distance(prev, midpoint) ? curr : prev;
    }, potentialWaypoints[0]!);

    this.edge.addWaypoint({ point: closestWaypoint }, this.uow);
  }

  cancel() {
    if (this.hoverElement) {
      removeHighlight(this.diagram.lookup(this.hoverElement), Highlights.NODE__EDGE_CONNECT);
    }

    CanvasDomHelper.diagramElement(this.diagram)!.style.cursor = 'unset';
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
        this.setEndpoint(new AnchorEndpoint(hoverNode, a.anchor.id, offset));
      }
    } else {
      addHighlight(hoverNode, Highlights.NODE__EDGE_CONNECT, 'edge');

      const offset = this.calculateOffset(a.point, hoverNode.bounds, hoverNode.bounds);

      this.setEndpoint(new PointInNodeEndpoint(hoverNode, undefined, offset, 'relative'));
    }
  }

  private shouldAttachToPoint() {
    return this.modifiers?.metaKey;
  }

  private attachToPoint(p: Point) {
    if (!this.hoverElement || !this.diagram.nodeLookup.has(this.hoverElement)) return;

    const hoverNode = this.diagram.nodeLookup.get(this.hoverElement);
    assert.present(hoverNode);

    addHighlight(hoverNode, Highlights.NODE__EDGE_CONNECT, 'point');

    const offset = this.calculateOffset(p, hoverNode.bounds, hoverNode.bounds);

    this.setEndpoint(new PointInNodeEndpoint(hoverNode, undefined, offset, 'relative'));
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

  private updateEdgeParent() {
    const start = this.edge.start instanceof ConnectedEndpoint ? this.edge.start.node : undefined;
    const end = this.edge.end instanceof ConnectedEndpoint ? this.edge.end.node : undefined;
    const connectedCount = (start ? 1 : 0) + (end ? 1 : 0);
    const currentParent = this.edge.parent;

    // Only update parent when both connected or both disconnected
    if (connectedCount === 1) return;

    // Both endpoints connected - find common ancestor
    const targetParent = connectedCount === 2 ? findCommonAncestor(start!, end!) : undefined;

    // Only update if parent actually changed
    if (targetParent === currentParent) return;

    // Remove from current parent if exists
    if (currentParent && isNode(currentParent)) {
      currentParent.removeChild(this.edge, this.uow);

      // If moving to layer level (no targetParent), add back to layer
      if (!targetParent && isRegularLayer(this.edge.layer)) {
        this.edge.layer.addElement(this.edge, this.uow);
      }
    }

    // Add to new parent if specified
    if (targetParent && isNode(targetParent)) {
      // If currently at layer level, remove from layer's elements
      if (!currentParent && isRegularLayer(this.edge.layer)) {
        const elements = this.edge.layer.elements;
        if (elements.includes(this.edge)) {
          this.edge.layer.setElements(
            elements.filter(e => e !== this.edge),
            this.uow
          );
        }
      }

      targetParent.addChild(this.edge, this.uow);
    }
  }
}
