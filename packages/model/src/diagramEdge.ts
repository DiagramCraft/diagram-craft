import { DiagramNode, DuplicationContext } from './diagramNode';
import { AbstractEdge, LabelNode, Waypoint } from './types';
import { BaseEdgeDefinition } from './baseEdgeDefinition';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { Box } from '@diagram-craft/geometry/box';
import { PointOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { CubicSegment, LineSegment } from '@diagram-craft/geometry/pathSegment';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, isEdge } from './diagramElement';
import { DiagramEdgeSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { Diagram } from './diagram';
import { Layer } from './diagramLayer';
import { ConnectedEndpoint, Endpoint, FixedEndpoint, FreeEndpoint, isConnected } from './endpoint';
import { edgeDefaults } from './diagramDefaults';
import { buildEdgePath } from './edgePathBuilder';
import { isHorizontal, isParallel, isPerpendicular, isReadable, isVertical } from './labelNode';
import { DeepReadonly, DeepRequired, DeepWriteable } from '@diagram-craft/utils/types';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import { isDifferent } from '@diagram-craft/utils/math';
import { Direction } from '@diagram-craft/geometry/direction';

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

export class DiagramEdge
  implements AbstractEdge, DiagramElement, UOWTrackable<DiagramEdgeSnapshot>
{
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

    this.#props.style ??= 'default-edge';
  }

  // TODO: This should use the EdgeDefinitionRegistry
  getDefinition() {
    return new BaseEdgeDefinition(this.id, 'Edge', 'edge');
  }

  /* Props *************************************************************************************************** */

  // TODO: Maybe create a props cache helper
  #propsCache: NodeProps | undefined = undefined;
  #propsCacheStyle: NodeProps | undefined = undefined;

  private clearPropsCache() {
    this.#propsCache = undefined;
  }

  get propsForEditing(): DeepReadonly<EdgeProps> {
    const styleProps = this.diagram.document.styles.edgeStyles.find(
      s => s.id === this.props.style
    )?.props;

    if (this.#propsCache && this.#propsCacheStyle === styleProps) return this.#propsCache;

    this.#propsCacheStyle = styleProps;
    this.#propsCache = deepMerge(
      {},
      edgeDefaults,
      {},
      styleProps ?? {},
      this.#props as EdgeProps
    ) as DeepRequired<EdgeProps>;

    return this.#propsCache;
  }

  get propsForRendering(): DeepReadonly<DeepRequired<EdgeProps>> {
    return this.propsForEditing as DeepRequired<EdgeProps>;
  }

  get props(): DeepReadonly<EdgeProps> {
    return this.#props;
  }

  updateProps(callback: (props: EdgeProps) => void, uow: UnitOfWork) {
    uow.snapshot(this);

    const oldType = this.#props.type;
    callback(this.#props);

    if (this.#props.type === 'bezier' && oldType !== 'bezier') {
      for (let i = 0; i < this.waypoints.length; i++) {
        const wp = this.waypoints[i];
        if (!wp.controlPoints) {
          // TODO: Fix this
          (wp as DeepWriteable<Waypoint>).controlPoints = this.inferControlPoints(i);
        }
      }
    }

    uow.updateElement(this);

    this.clearPropsCache();
  }

  inferControlPoints(i: number) {
    const before = i === 0 ? this.start.position : this.waypoints[i - 1].point;
    const after = i === this.waypoints.length - 1 ? this.end.position : this.waypoints[i + 1].point;

    return {
      cp1: Vector.scale(Vector.from(after, before), 0.2),
      cp2: Vector.scale(Vector.from(before, after), 0.2)
    };
  }

  /* Name **************************************************************************************************** */

  get name() {
    // First we use any label nodes
    if (this.#labelNodes && this.#labelNodes.length > 0) {
      return this.#labelNodes[0].node.name;
    }

    // ... otherwise we form the name based on connected nodes
    if (isConnected(this.start) || isConnected(this.end)) {
      let s = '';
      if (isConnected(this.start)) {
        s = this.start.node.name;
      }
      s += ' - ';
      if (isConnected(this.end)) {
        s += this.end.node.name;
      }
      return s;
    }

    // ... finally we use the id
    return this.id;
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

    const delta = Point.subtract(b, this.bounds);

    if (!isConnected(this.start)) {
      this.#start = new FreeEndpoint({
        x: this.#start.position.x + delta.x,
        y: this.#start.position.y + delta.y
      });
      uow.updateElement(this);
    }
    if (!isConnected(this.end)) {
      this.#end = new FreeEndpoint({
        x: this.#end.position.x + delta.x,
        y: this.#end.position.y + delta.y
      });
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
      _snapshotType: 'edge',
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

    const oldLabelNodes = this.#labelNodes ?? [];
    this.#labelNodes = snapshot.labelNodes?.map(ln => ({
      ...ln,
      node: this.diagram.nodeLookup.get(ln.id)!
    }));
    for (const ln of oldLabelNodes) {
      if (!this.#labelNodes?.find(e => e.node === ln.node)) {
        ln.node.updateProps(p => (p.labelForEdgeId = undefined), uow);
      }
    }

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

    const startNormal = isConnected(this.start) ? this._calculateNormal(this.start) : undefined;
    const endNormal = isConnected(this.end) ? this._calculateNormal(this.end) : undefined;

    const startDirection = startNormal ? Direction.fromVector(startNormal) : undefined;
    const endDirection = endNormal ? Direction.fromVector(endNormal) : undefined;

    return buildEdgePath(
      this,
      this.props.stroke?.lineJoin === 'round' ? this.props.routing?.rounding ?? 0 : 0,
      startDirection,
      endDirection ? Direction.opposite(endDirection) : undefined
    );
  }

  private _calculateNormal(endpoint: ConnectedEndpoint | FixedEndpoint) {
    const startNode = endpoint.node;
    const boundingPath = startNode.getDefinition().getBoundingPath(startNode);
    const t = boundingPath.projectPoint(endpoint.position);

    const paths = boundingPath.all();
    const tangent = paths[t.pathIdx].tangentAt(t.offset);

    return { x: -tangent.y, y: tangent.x };
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
      uow.snapshot(edge);

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

  getAttachmentsInUse(): Array<string> {
    return [];
  }
}
