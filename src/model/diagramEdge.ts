import { Box } from '../geometry/box.ts';
import { Transform } from '../geometry/transform.ts';
import { Diagram } from './diagram.ts';
import { Point } from '../geometry/point.ts';
import { DiagramNode, DuplicationContext } from './diagramNode.ts';
import { AbstractEdge, LabelNode, Waypoint } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { buildEdgePath } from './edgePathBuilder.ts';
import { PointOnPath, TimeOffsetOnPath } from '../geometry/pathPosition.ts';
import { Vector } from '../geometry/vector.ts';
import { newid } from '../utils/id.ts';
import { deepClone } from '../utils/clone.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement, isEdge } from './diagramElement.ts';
import { isDifferent } from '../utils/math.ts';
import { isHorizontal, isParallel, isPerpendicular, isReadable, isVertical } from './labelNode.ts';
import { BaseEdgeDefinition } from '../base-ui/baseEdgeDefinition.ts';
import { SerializedEdge } from './serialization/types.ts';
import { Endpoint, FreeEndpoint, isConnected } from './endpoint.ts';
import { DeepReadonly, DeepWriteable } from '../utils/types.ts';
import { CubicSegment, LineSegment } from '../geometry/pathSegment.ts';

export type DiagramEdgeSnapshot = SerializedEdge;

export type ResolvedLabelNode = LabelNode & {
  node: DiagramNode;
};

export type Intersection = {
  point: Point;
  type: 'above' | 'below';
};

const intersectionListIsSame = (a: Intersection[], b: Intersection[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Point.isEqual(a[i].point, b[i].point)) return false;
    if (a[i].type !== b[i].type) return false;
  }
  return true;
};

export class DiagramEdge implements AbstractEdge, DiagramElement {
  readonly type = 'edge';

  readonly id: string;

  #diagram: Diagram;
  #layer: Layer;
  #parent?: DiagramNode;

  #props: EdgeProps = {};

  #intersections: Intersection[] = [];
  #waypoints: ReadonlyArray<Waypoint> = [];

  #start: Endpoint;
  #end: Endpoint;
  #labelNodes?: ReadonlyArray<ResolvedLabelNode>;

  constructor(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: DeepReadonly<EdgeProps>,
    midpoints: ReadonlyArray<Waypoint>,
    diagram: Diagram,
    layer: Layer
  ) {
    this.id = id;
    this.#start = start;
    this.#end = end;
    this.#props = props as EdgeProps;
    this.#waypoints = midpoints;
    this.#diagram = diagram;
    this.#layer = layer;

    if (isConnected(start)) start.node._addEdge(start.anchor, this);
    if (isConnected(end)) end.node._addEdge(end.anchor, this);
  }

  // TODO: This should use the EdgeDefinitionRegistry
  getDefinition() {
    return new BaseEdgeDefinition(this.id, 'Edge', 'edge');
  }

  /* Props *************************************************************************************************** */

  get props(): DeepReadonly<EdgeProps> {
    return this.#props;
  }

  updateProps(callback: (props: EdgeProps) => void, uow: UnitOfWork) {
    uow.snapshot(this);
    callback(this.#props);
    uow.updateElement(this);
  }

  /* Diagram/layer ******************************************************************************************* */

  get diagram() {
    return this.#diagram;
  }

  get layer() {
    return this.#layer;
  }

  _setLayer(layer: Layer, diagram: Diagram) {
    this.#layer = layer;
    this.#diagram = diagram;
  }

  /* Parent ************************************************************************************************** */

  get parent() {
    return this.#parent;
  }

  _setParent(parent: DiagramNode | undefined) {
    this.#parent = parent;
  }

  /* Bounds ************************************************************************************************* */

  // TODO: This is probably not a sufficient way to calculate the bounding box
  get bounds() {
    return Box.fromCorners(this.#start.position, this.#end.position);
  }

  setBounds(b: Box, uow: UnitOfWork) {
    uow.snapshot(this);
    if (!isConnected(this.start)) {
      this.#start = new FreeEndpoint({ x: b.x, y: b.y });
      uow.updateElement(this);
    }
    if (!isConnected(this.end)) {
      this.#end = new FreeEndpoint({ x: b.x + b.w, y: b.y + b.h });
      uow.updateElement(this);
    }
  }

  /* Endpoints ********************************************************************************************** */

  setStart(start: Endpoint, uow: UnitOfWork) {
    uow.snapshot(this);

    if (isConnected(this.#start)) {
      uow.snapshot(this.#start.node);

      this.#start.node._removeEdge(this.#start.anchor, this);
      uow.updateElement(this.#start.node);
    }

    if (isConnected(start)) {
      uow.snapshot(start.node);

      start.node._addEdge(start.anchor, this);
      uow.updateElement(start.node);
    }

    this.#start = start;

    uow.updateElement(this);
  }

  get start() {
    return this.#start;
  }

  setEnd(end: Endpoint, uow: UnitOfWork) {
    uow.snapshot(this);

    if (isConnected(this.#end)) {
      uow.snapshot(this.#end.node);

      this.#end.node._removeEdge(this.#end.anchor, this);
      uow.updateElement(this.#end.node);
    }

    if (isConnected(end)) {
      uow.snapshot(end.node);

      end.node._addEdge(end.anchor, this);
      uow.updateElement(end.node);
    }

    this.#end = end;

    uow.updateElement(this);
  }

  get end() {
    return this.#end;
  }

  isConnected() {
    return isConnected(this.start) || isConnected(this.end);
  }

  /* Label Nodes ******************************************************************************************** */

  get labelNodes() {
    return this.#labelNodes;
  }

  setLabelNodes(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined, uow: UnitOfWork) {
    uow.snapshot(this);

    this.#labelNodes = labelNodes;
    this.#labelNodes?.forEach(ln => {
      ln.node.updateProps(p => (p.labelForEdgeId = this.id), uow);
    });
    uow.updateElement(this);
  }

  addLabelNode(labelNode: ResolvedLabelNode, uow: UnitOfWork) {
    uow.snapshot(this);

    this.setLabelNodes([...(this.labelNodes ?? []), labelNode], uow);
  }

  removeLabelNode(labelNode: ResolvedLabelNode, uow: UnitOfWork) {
    uow.snapshot(this);

    this.setLabelNodes(
      this.labelNodes?.filter(ln => ln !== labelNode),
      uow
    );
  }

  /* Waypoints ********************************************************************************************** */

  get waypoints(): ReadonlyArray<Waypoint> {
    return this.#waypoints;
  }

  addWaypoint(waypoint: Waypoint, uow: UnitOfWork) {
    uow.snapshot(this);

    const path = this.path();
    const projection = path.projectPoint(waypoint.point);

    if (this.props.type === 'bezier' && !waypoint.controlPoints) {
      const offset = PointOnPath.toTimeOffset({ point: waypoint.point }, path);
      const [p1, p2] = path.split(offset);

      const segments: CubicSegment[] = [];
      for (const s of [...p1.segments, ...p2.segments]) {
        if (s instanceof CubicSegment) {
          segments.push(s);
        } else if (s instanceof LineSegment) {
          segments.push(CubicSegment.fromLine(s));
        }
      }
      const newWaypoints: Waypoint[] = [];

      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        newWaypoints.push({
          point: segment.end,
          controlPoints: {
            cp1: Point.subtract(segment.p2, segment.end),
            cp2: Point.subtract(segments[i + 1].p1, segment.end)
          }
        });
      }

      this.#waypoints = newWaypoints;

      uow.updateElement(this);

      return offset.segment;
    } else {
      const wpDistances = this.waypoints.map(p => {
        return {
          pathD: PointOnPath.toTimeOffset({ point: p.point }, path).pathD,
          ...p
        };
      });

      const newWaypoint = { ...waypoint, pathD: projection.pathD };
      this.#waypoints = [...wpDistances, newWaypoint].sort(
        (a, b) => a.pathD - b.pathD
      ) as Array<Waypoint>;

      uow.updateElement(this);

      return this.#waypoints.indexOf(newWaypoint);
    }
  }

  removeWaypoint(waypoint: Waypoint, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#waypoints = this.#waypoints.filter(w => w !== waypoint);
    uow.updateElement(this);
  }

  moveWaypoint(waypoint: Waypoint, point: Point, uow: UnitOfWork) {
    uow.snapshot(this);
    // TODO: Fix this
    (waypoint as DeepWriteable<Waypoint>).point = point;
    uow.updateElement(this);
  }

  updateWaypoint(idx: number, waypoint: Waypoint, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#waypoints = this.waypoints.map((w, i) => (i === idx ? waypoint : w));
    uow.updateElement(this);
  }

  get midpoints() {
    const path = this.path();
    return path.segments.map(s => {
      return s.point(0.5);
    });
  }

  /* Snapshot ************************************************************************************************ */

  snapshot(): DiagramEdgeSnapshot {
    return {
      id: this.id,
      type: 'edge',
      props: deepClone(this.props),
      start: this.start.serialize(),
      end: this.end.serialize(),
      waypoints: deepClone(this.waypoints),
      labelNodes: this.labelNodes?.map(ln => ({
        id: ln.id,
        type: ln.type,
        offset: ln.offset,
        timeOffset: ln.timeOffset
      }))
    };
  }

  // TODO: Add assertions for lookups
  restore(snapshot: DiagramEdgeSnapshot, uow: UnitOfWork) {
    this.#props = snapshot.props as NodeProps;
    this.#props.highlight = undefined;
    this.#start = Endpoint.deserialize(snapshot.start, this.diagram);
    this.#end = Endpoint.deserialize(snapshot.end, this.diagram);
    this.#waypoints = (snapshot.waypoints ?? []) as Array<Waypoint>;
    this.#labelNodes = snapshot.labelNodes?.map(ln => ({
      ...ln,
      node: this.diagram.nodeLookup.get(ln.id)!
    }));

    uow.updateElement(this);
  }

  duplicate(ctx?: DuplicationContext) {
    const uow = new UnitOfWork(this.diagram);

    const edge = new DiagramEdge(
      newid(),
      this.start,
      this.end,
      deepClone(this.props) as EdgeProps,
      deepClone(this.waypoints) as Array<Waypoint>,
      this.diagram,
      this.layer
    );

    ctx?.targetElementsInGroup.set(this.id, edge);

    // Clone any label nodes
    const newLabelNodes: ResolvedLabelNode[] = [];
    for (const l of edge.labelNodes ?? []) {
      const newNode = l.node.duplicate(ctx);
      newLabelNodes.push({
        ...l,
        node: newNode
      });
      newNode.updateProps(p => p.labelForEdgeId, uow);
    }
    edge.setLabelNodes(newLabelNodes, uow);

    uow.abort();

    return edge;
  }

  /* ***** ***** ******************************************************************************************** */

  isLocked() {
    return this.layer.isLocked() ?? false;
  }

  path() {
    // TODO: We should be able to cache this, and then invalidate it when the edge changes (see invalidate())
    return buildEdgePath(this, this.props.routing?.rounding ?? 0);
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork) {
    uow.snapshot(this);

    this.setBounds(Transform.box(this.bounds, ...transforms), uow);

    this.#waypoints = this.waypoints.map(w => {
      const absoluteControlPoints = Object.values(w.controlPoints ?? {}).map(cp =>
        Point.add(w.point, cp)
      );
      const transformedControlPoints = absoluteControlPoints.map(cp =>
        Transform.point(cp, ...transforms)
      );
      const transformedPoint = Transform.point(w.point, ...transforms);
      const relativeControlPoints = transformedControlPoints.map(cp =>
        Point.subtract(cp, transformedPoint)
      );

      return {
        point: transformedPoint,
        controlPoints: w.controlPoints
          ? {
              cp1: relativeControlPoints[0],
              cp2: relativeControlPoints[1]
            }
          : undefined
      };
    });

    uow.updateElement(this);
  }

  get intersections() {
    return this.#intersections;
  }

  flip(uow: UnitOfWork) {
    uow.snapshot(this);

    const start = this.#start;
    const end = this.#end;

    // Need to "zero" the end so that the setters logic should work correctly
    this.#end = new FreeEndpoint(Point.ORIGIN);

    this.setStart(end, uow);
    this.setEnd(start, uow);
  }

  /**
   * Called in case the edge has been changed and needs to be recalculated
   *
   *  edge -> label nodes -> ...
   *       -> intersecting edges
   *
   * Note, that whilst an edge can be part of a group, a change to the edge will not
   * impact the state and/or bounds of the parent group/container
   */
  invalidate(uow: UnitOfWork) {
    uow.snapshot(this);

    // Ensure we don't get into an infinite loop
    if (uow.hasBeenInvalidated(this)) return;
    uow.beginInvalidation(this);

    this.adjustLabelNodePosition(uow);
    this.recalculateIntersections(uow, true);
  }

  detach(uow: UnitOfWork) {
    // Update any parent
    if (this.parent) {
      this.parent.removeChild(this, uow);
    }

    // All label nodes must be detached
    if (this.labelNodes) {
      for (const l of this.labelNodes) {
        l.node.detach(uow);
      }
    }

    this.diagram.edgeLookup.delete(this.id);

    // Note, need to check if the element is still in the layer to avoid infinite recursion
    if (this.layer.elements.includes(this)) {
      this.layer.removeElement(this, uow);
    }
  }

  private recalculateIntersections(uow: UnitOfWork, propagate = false) {
    if (!this.diagram.mustCalculateIntersections) return;

    let currentEdgeHasBeenSeen = false;
    const path = this.path();
    const intersections: Intersection[] = [];
    for (const edge of this.diagram.visibleElements()) {
      if (edge === this) {
        currentEdgeHasBeenSeen = true;
        continue;
      }
      if (!isEdge(edge)) continue;

      const otherPath = edge.path();
      const intersectionsWithOther = path.intersections(otherPath);
      intersections.push(
        ...intersectionsWithOther.map(e => ({
          point: e.point,
          type: (currentEdgeHasBeenSeen ? 'below' : 'above') as Intersection['type']
        }))
      );
      if (propagate) {
        edge.recalculateIntersections(uow, false);
      }
    }

    if (!intersectionListIsSame(intersections, this.#intersections)) {
      this.#intersections = intersections;
      uow.updateElement(this);
    }
  }

  private adjustLabelNodePosition(uow: UnitOfWork) {
    if (!this.labelNodes || this.labelNodes.length === 0) return;

    const path = this.path();

    for (const labelNode of this.labelNodes) {
      const pathD = TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: labelNode.timeOffset }, path);
      const attachmentPoint = path.pointAt(pathD);

      let newCenterPoint = Point.add(attachmentPoint, labelNode.offset);
      let newRotation = labelNode.node.bounds.r;
      if (isParallel(labelNode.type) || isPerpendicular(labelNode.type)) {
        const tangent = path.tangentAt(pathD);

        if (isParallel(labelNode.type)) {
          newRotation = Vector.angle(tangent);
        } else {
          newRotation = Vector.angle(tangent) + Math.PI / 2;
        }

        if (isReadable(labelNode.type)) {
          if (newRotation > Math.PI / 2) newRotation -= Math.PI;
          if (newRotation < -Math.PI / 2) newRotation += Math.PI;
        }

        newCenterPoint = Point.add(
          attachmentPoint,
          Point.rotate({ x: -labelNode.offset.x, y: 0 }, Vector.angle(tangent) + Math.PI / 2)
        );
      } else if (isHorizontal(labelNode.type)) {
        newRotation = 0;
      } else if (isVertical(labelNode.type)) {
        newRotation = Math.PI / 2;
      }

      // Note, using rounding here to avoid infinite recursion
      const currentCenterPoint = Box.center(labelNode.node.bounds);
      const hasChanged =
        isDifferent(newCenterPoint.x, currentCenterPoint.x) ||
        isDifferent(newCenterPoint.y, currentCenterPoint.y) ||
        isDifferent(newRotation, labelNode.node.bounds.r);

      if (hasChanged) {
        labelNode.node.setBounds(
          {
            ...labelNode.node.bounds,
            r: newRotation,
            x: newCenterPoint.x - labelNode.node.bounds.w / 2,
            y: newCenterPoint.y - labelNode.node.bounds.h / 2
          },
          uow
        );
      }
    }
  }
}
