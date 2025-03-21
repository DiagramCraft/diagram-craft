import { DiagramNode, DuplicationContext } from './diagramNode';
import { EdgeInterface, LabelNode, Waypoint } from './types';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { Box } from '@diagram-craft/geometry/box';
import { PointOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { CubicSegment, LineSegment } from '@diagram-craft/geometry/pathSegment';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, isEdge } from './diagramElement';
import { DiagramEdgeSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { Diagram } from './diagram';
import { Layer, RegularLayer } from './diagramLayer';
import {
  AnchorEndpoint,
  ConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  PointInNodeEndpoint
} from './endpoint';
import { DefaultStyles, edgeDefaults } from './diagramDefaults';
import { buildEdgePath } from './edgePathBuilder';
import { isHorizontal, isParallel, isPerpendicular, isReadable, isVertical } from './labelNode';
import { DeepReadonly, DeepRequired, DeepWriteable } from '@diagram-craft/utils/types';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import { isDifferent } from '@diagram-craft/utils/math';
import { Direction } from '@diagram-craft/geometry/direction';
import { EdgeDefinition } from './elementDefinitionRegistry';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { assert } from '@diagram-craft/utils/assert';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import { getAdjustments } from './diagramLayerRuleTypes';

const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  endpoint instanceof ConnectedEndpoint;

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

export type EdgePropsForEditing = DeepReadonly<EdgeProps>;
export type EdgePropsForRendering = DeepReadonly<DeepRequired<EdgeProps>>;

export class DiagramEdge
  implements EdgeInterface, DiagramElement, UOWTrackable<DiagramEdgeSnapshot>
{
  readonly type = 'edge';

  readonly id: string;

  #cache: Map<string, unknown> | undefined = undefined;

  #diagram: Diagram;
  #activeDiagram: Diagram;
  #layer: Layer;
  #parent?: DiagramNode;

  #props: EdgeProps = {};
  #metadata: ElementMetadata = {};

  #intersections: Intersection[] = [];
  #waypoints: ReadonlyArray<Waypoint> = [];

  #start: Endpoint;
  #end: Endpoint;
  #labelNodes?: ReadonlyArray<ResolvedLabelNode>;

  constructor(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgePropsForEditing,
    metadata: ElementMetadata,
    midpoints: ReadonlyArray<Waypoint>,
    diagram: Diagram,
    layer: Layer
  ) {
    this.id = id;
    this.#start = start;
    this.#end = end;
    this.#props = props as EdgeProps;
    this.#metadata = metadata;
    this.#waypoints = midpoints;
    this.#diagram = diagram;
    this.#activeDiagram = diagram;
    this.#layer = layer;

    if (start instanceof ConnectedEndpoint)
      start.node._addEdge(start instanceof AnchorEndpoint ? start.anchorId : undefined, this);
    if (end instanceof ConnectedEndpoint)
      end.node._addEdge(end instanceof AnchorEndpoint ? end.anchorId : undefined, this);

    this.#metadata.style ??= DefaultStyles.edge.default;
  }

  getDefinition(): EdgeDefinition {
    return this.diagram.document.edgeDefinitions.get(this.renderProps.shape);
  }

  get cache() {
    if (!this.#cache) {
      this.#cache = new Map<string, unknown>();
    }
    return this.#cache;
  }

  /* Highlights ********************************************************************************************** */

  #highlights: ReadonlyArray<string> = [];

  set highlights(highlights: ReadonlyArray<string>) {
    this.#highlights = highlights;
    this.diagram.emitAsync('elementHighlighted', { element: this });
  }

  get highlights() {
    return this.#highlights;
  }

  /* Metadata ************************************************************************************************ */

  get metadata() {
    return this.#metadata;
  }

  updateMetadata(callback: (props: ElementMetadata) => void, uow: UnitOfWork) {
    uow.snapshot(this);
    callback(this.#metadata);
    uow.updateElement(this);
    this.#cache?.clear();
  }

  /* Props *************************************************************************************************** */

  getPropsInfo<T extends PropPath<EdgeProps>>(path: T): PropertyInfo<PropPathValue<EdgeProps, T>> {
    const { styleProps, ruleProps, ruleStyleProps } = this.getPropsSources();

    const accessor = new DynamicAccessor<EdgeProps>();

    const dest: PropertyInfo<PropPathValue<EdgeProps, T>> = [];

    dest.push({
      val: edgeDefaults.get(path) as PropPathValue<EdgeProps, T>,
      type: 'default'
    });

    if (styleProps) {
      dest.push({
        val: accessor.get(styleProps, path) as PropPathValue<EdgeProps, T>,
        type: 'style',
        id: this.#metadata.style
      });
    }

    if (ruleStyleProps) {
      dest.push({
        val: accessor.get(ruleStyleProps, path) as PropPathValue<EdgeProps, T>,
        type: 'ruleStyle'
      });
    }

    dest.push({
      val: accessor.get(this.#props, path) as PropPathValue<EdgeProps, T>,
      type: 'stored'
    });

    for (const rp of ruleProps) {
      dest.push({
        val: accessor.get(rp[1], path) as PropPathValue<EdgeProps, T>,
        type: 'rule',
        id: rp[0]
      });
    }

    return dest.filter(e => e.val !== undefined);
  }

  private getPropsSources() {
    const styleProps = this.diagram.document.styles.edgeStyles.find(
      s => s.id === this.#metadata.style
    )?.props;

    const adjustments = getAdjustments(this.#activeDiagram, this.id);
    const ruleProps = adjustments.map(([k, v]) => [k, v.props]);

    const ruleElementStyle = adjustments
      .map(([, v]) => v.elementStyle)
      .filter(e => !!e)
      .at(-1);
    const ruleStyleProps = this.diagram.document.styles.edgeStyles.find(
      s => s.id === ruleElementStyle
    )?.props;

    return { styleProps, ruleProps: ruleProps as [string, EdgeProps][], ruleStyleProps };
  }

  private populatePropsCache() {
    const { styleProps, ruleProps, ruleStyleProps } = this.getPropsSources();

    const consolidatedRulesProps = ruleProps.reduce(
      (p, c) => deepMerge<EdgeProps>({}, p, c[1]),
      {}
    );

    const propsForEditing = deepMerge(
      {},
      styleProps ?? {},
      ruleStyleProps ?? {},
      this.#props
    ) as DeepRequired<EdgeProps>;

    const propsForRendering = edgeDefaults.applyDefaults(
      deepMerge({}, propsForEditing, consolidatedRulesProps)
    );

    this.cache.set('props.forEditing', propsForEditing);
    this.cache.set('props.forRendering', propsForRendering);

    return {
      forEditing: propsForEditing,
      forRendering: propsForRendering
    };
  }

  get storedProps() {
    return this.#props;
  }

  get editProps(): EdgePropsForEditing {
    return (this.cache.get('props.forEditing') ??
      this.populatePropsCache().forEditing) as EdgePropsForEditing;
  }

  get renderProps(): EdgePropsForRendering {
    return (this.cache.get('props.forRendering') ??
      this.populatePropsCache().forRendering) as EdgePropsForRendering;
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

    this.#cache?.clear();
  }

  updateCustomProps<K extends keyof CustomEdgeProps>(
    key: K,
    callback: (props: NonNullable<CustomEdgeProps[K]>) => void,
    uow: UnitOfWork
  ) {
    this.updateProps(p => {
      p.custom ??= {};
      p.custom[key] ??= {};
      callback(p.custom[key]!);
    }, uow);
  }

  inferControlPoints(i: number) {
    const before = i === 0 ? this.start.position : this.waypoints[i - 1].point;
    const after = i === this.waypoints.length - 1 ? this.end.position : this.waypoints[i + 1].point;

    return {
      cp1: Vector.scale(Vector.from(after, before), 0.2),
      cp2: Vector.scale(Vector.from(before, after), 0.2)
    };
  }

  isHidden() {
    return this.renderProps.hidden;
  }

  /* Name **************************************************************************************************** */

  get dataForTemplate() {
    return deepMerge(
      {
        name: this.#metadata.name
      },
      this.metadata.data?.customData ?? {},
      ...(this.metadata.data?.data?.map(d => d.data) ?? [])
    );
  }

  get name() {
    // First we use any label nodes
    if (this.#labelNodes && this.#labelNodes.length > 0) {
      return this.#labelNodes[0].node.name;
    }

    if (!isEmptyString(this.#metadata.name)) {
      this.cache.set('name', this.#metadata.name!);
      return this.cache.get('name') as string;
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

  get activeDiagram() {
    return this.#activeDiagram;
  }

  set activeDiagram(diagram: Diagram) {
    if (this.#activeDiagram !== diagram) {
      this.cache.clear();
    }
    this.#activeDiagram = diagram;
  }

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

      this.#start.node._removeEdge(
        this.#start instanceof AnchorEndpoint ? this.#start.anchorId : undefined,
        this
      );
      uow.updateElement(this.#start.node);
    }

    if (isConnected(start)) {
      uow.snapshot(start.node);

      start.node._addEdge(start instanceof AnchorEndpoint ? start.anchorId : undefined, this);
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

      this.#end.node._removeEdge(
        this.#end instanceof AnchorEndpoint ? this.#end.anchorId : undefined,
        this
      );
      uow.updateElement(this.#end.node);
    }

    if (isConnected(end)) {
      uow.snapshot(end.node);

      end.node._addEdge(end instanceof AnchorEndpoint ? end.anchorId : undefined, this);
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

    if (this.#props.type === 'bezier' && !waypoint.controlPoints) {
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
      props: deepClone(this.#props),
      metadata: deepClone(this.#metadata),
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
    this.#props = snapshot.props as EdgeProps;
    this.#highlights = [];
    this.#start = Endpoint.deserialize(snapshot.start, this.diagram.nodeLookup);
    this.#end = Endpoint.deserialize(snapshot.end, this.diagram.nodeLookup);
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
    this.#cache?.clear();
  }

  duplicate(ctx?: DuplicationContext, id?: string | undefined) {
    const uow = new UnitOfWork(this.diagram);

    const edge = new DiagramEdge(
      id ?? newid(),
      this.start,
      this.end,
      deepClone(this.#props) as EdgeProps,
      deepClone(this.#metadata) as ElementMetadata,
      deepClone(this.waypoints) as Array<Waypoint>,
      this.diagram,
      this.layer
    );

    ctx?.targetElementsInGroup.set(this.id, edge);

    // Clone any label nodes
    const newLabelNodes: ResolvedLabelNode[] = [];
    for (let i = 0; i < (edge.labelNodes ?? []).length; i++) {
      const l = (edge.labelNodes ?? [])[i];

      const newNode = l.node.duplicate(ctx, id ? `${id}-${i}` : undefined);
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
    return this.layer.isLocked();
  }

  path() {
    // TODO: We should be able to cache this, and then invalidate it when the edge changes (see invalidate())

    const startDirection = this._getNormalDirection(this.start);
    const endDirection = this._getNormalDirection(this.end);

    let rounding = 0;
    if (this.#props.stroke?.lineJoin === undefined || this.#props.stroke.lineJoin === 'round') {
      rounding = this.#props.routing?.rounding ?? 0;
    }

    return buildEdgePath(
      this,
      rounding,
      startDirection,
      endDirection ? Direction.opposite(endDirection) : undefined
    );
  }

  /**
   * In case the endpoint is connected, there are two options; either
   * the anchor has a normal (and we will use it) - or we need to calculate
   * the normal based on the point and the boundary path
   *
   * In case the endpoint is not connected, there's no inherent direction to use
   *
   * Note that this gives you the direction of the endpoint as the node
   * is rotated - i.e. rotating the node will have an effect on which direction
   * this method returns
   *
   * TODO: Could we move this to the endpoint?
   */
  private _getNormalDirection(endpoint: Endpoint) {
    if (isConnected(endpoint)) {
      if (endpoint instanceof AnchorEndpoint && endpoint.getAnchor().normal !== undefined) {
        return Direction.fromAngle(endpoint.getAnchor().normal! + endpoint.node.bounds.r, true);
      }

      if (endpoint instanceof PointInNodeEndpoint) return undefined;

      // ... else, we calculate the normal assuming the closest point to the
      // endpoint on the boundary path
      const startNode = endpoint.node;
      const boundingPath = startNode.getDefinition().getBoundingPath(startNode);
      const t = boundingPath.projectPoint(endpoint.position);

      const paths = boundingPath.all();
      const tangent = paths[t.pathIdx].tangentAt(t.offset);

      // TODO: We need to check this is going in the right direction (i.e. outwards)
      //       probably need to pick up some code from ShapeNodeDefinition.getAnchors

      return Direction.fromVector({ x: -tangent.y, y: tangent.x });
    }
    return undefined;
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
    assert.true(this.layer instanceof RegularLayer);
    if ((this.layer as RegularLayer).elements.includes(this)) {
      (this.layer as RegularLayer).removeElement(this, uow);
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

      let newReferencePoint = Point.add(attachmentPoint, labelNode.offset);
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

        newReferencePoint = Point.add(
          attachmentPoint,
          Point.rotate({ x: -labelNode.offset.x, y: 0 }, Vector.angle(tangent) + Math.PI / 2)
        );
      } else if (isHorizontal(labelNode.type)) {
        newRotation = 0;
      } else if (isVertical(labelNode.type)) {
        newRotation = Math.PI / 2;
      }

      const referenceOffsetFromMidpoint = Point.of(0, 0);
      if (labelNode.node.renderProps.text.align === 'left') {
        referenceOffsetFromMidpoint.x = labelNode.node.bounds.w / 2;
      } else if (labelNode.node.renderProps.text.align === 'right') {
        referenceOffsetFromMidpoint.x = -labelNode.node.bounds.w / 2;
      }

      if (labelNode.node.renderProps.text.valign === 'top') {
        referenceOffsetFromMidpoint.y = labelNode.node.bounds.h / 2 + 6;
      } else if (labelNode.node.renderProps.text.valign === 'bottom') {
        referenceOffsetFromMidpoint.y = -labelNode.node.bounds.h / 2 - 1;
      }

      // Note, using rounding here to avoid infinite recursion
      newReferencePoint = Point.add(newReferencePoint, referenceOffsetFromMidpoint);
      const currentReferencePoint = Point.add(
        Box.center(labelNode.node.bounds),
        referenceOffsetFromMidpoint
      );
      const hasChanged =
        isDifferent(newReferencePoint.x, currentReferencePoint.x) ||
        isDifferent(newReferencePoint.y, currentReferencePoint.y) ||
        isDifferent(newRotation, labelNode.node.bounds.r);

      if (hasChanged) {
        labelNode.node.setBounds(
          {
            ...labelNode.node.bounds,
            r: newRotation,
            x: newReferencePoint.x - labelNode.node.bounds.w / 2,
            y: newReferencePoint.y - labelNode.node.bounds.h / 2
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
