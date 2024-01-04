import { Box } from '../geometry/box.ts';
import { Transform } from '../geometry/transform.ts';
import { ChangeType, Diagram } from './diagram.ts';
import { Point } from '../geometry/point.ts';
import { DiagramNode, DuplicationContext } from './diagramNode.ts';
import { AbstractEdge, LabelNode, Waypoint } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { buildEdgePath } from './edgePathBuilder.ts';
import { TimeOffsetOnPath } from '../geometry/pathPosition.ts';
import { Vector } from '../geometry/vector.ts';
import { newid } from '../utils/id.ts';
import { deepClone } from '../utils/clone.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { isEdge } from './diagramElement.ts';
import { isDifferent } from '../utils/math.ts';
import { isHorizontal, isParallel, isPerpendicular, isReadable, isVertical } from './labelNode.ts';
import { BaseEdgeDefinition } from '../base-ui/baseEdgeDefinition.ts';

export type ConnectedEndpoint = { anchor: number; node: DiagramNode };
export type Endpoint = ConnectedEndpoint | { position: Point };

export const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  'node' in endpoint;

export type ResolvedLabelNode = LabelNode & {
  node: DiagramNode;
};

export type Intersection = {
  point: Point;
  type: 'above' | 'below';
};

export class DiagramEdge implements AbstractEdge {
  readonly id: string;
  readonly type = 'edge';
  readonly props: EdgeProps = {};

  #intersections: Intersection[] = [];

  waypoints: ReadonlyArray<Waypoint> | undefined;

  diagram: Diagram;
  layer: Layer;
  parent?: DiagramNode;

  #start: Endpoint;
  #end: Endpoint;
  #labelNodes?: ReadonlyArray<ResolvedLabelNode>;

  constructor(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgeProps,
    midpoints: ReadonlyArray<Waypoint>,
    diagram: Diagram,
    layer: Layer
  ) {
    this.id = id;
    this.#start = start;
    this.#end = end;
    this.props = props;
    this.waypoints = midpoints;
    this.diagram = diagram;
    this.layer = layer;

    this.diagram.on('change', this.invalidate.bind(this));
    this.diagram.on('elementChange', ({ element }) => {
      if (
        (isConnected(this.#start) && element === this.#start.node) ||
        (isConnected(this.#end) && element === this.#end.node) ||
        element === this
      ) {
        this.invalidate();
      } else if (this.#labelNodes?.find(ln => ln.node === element)) {
        // TODO: Note that this can cause infinite recursion
        UnitOfWork.execute(this.diagram, uow => {
          this.adjustLabelNodePosition(uow);
        });
      }
    });
  }

  // TODO: This should use the EdgeDefinitionRegistry
  getEdgeDefinition() {
    return new BaseEdgeDefinition(this.id, 'Edge', 'edge');
  }

  get intersections() {
    return this.#intersections;
  }

  get labelNodes() {
    return this.#labelNodes;
  }

  set labelNodes(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined) {
    this.#labelNodes = labelNodes;
    this.invalidate();
  }

  isLocked() {
    return this.layer.isLocked() ?? false;
  }

  // TODO: This is probably not a sufficient way to calculate the bounding box
  get bounds() {
    return Box.fromCorners(this.startPosition, this.endPosition);
  }

  set bounds(b: Box) {
    if (!isConnected(this.start)) this.start = { position: { x: b.pos.x, y: b.pos.y } };
    if (!isConnected(this.end))
      this.end = { position: { x: b.pos.x + b.size.w, y: b.pos.y + b.size.h } };
  }

  path() {
    // TODO: We should be able to cache this, and then invalidate it when the edge changes (see invalidate())
    return buildEdgePath(this, this.props.routing?.rounding ?? 0);
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, _type: ChangeType) {
    this.bounds = Transform.box(this.bounds, ...transforms);

    this.waypoints = this.waypoints?.map(w => {
      const absoluteControlPoints = (w.controlPoints ?? []).map(cp => Point.add(w.point, cp));
      const transformedControlPoints = absoluteControlPoints.map(cp =>
        Transform.point(cp, ...transforms)
      );
      const transformedPoint = Transform.point(w.point, ...transforms);
      const relativeControlPoints = transformedControlPoints.map(cp =>
        Point.subtract(cp, transformedPoint)
      );

      return {
        point: transformedPoint,
        controlPoints: w.controlPoints ? (relativeControlPoints as [Point, Point]) : undefined
      };
    });

    this.recalculateIntersections(uow, true);
  }

  update() {
    const uow = new UnitOfWork(this.diagram);
    this.recalculateIntersections(uow, true);
    uow.updateElement(this);
    uow.commit();
  }

  duplicate(ctx?: DuplicationContext) {
    const edge = new DiagramEdge(
      newid(),
      this.start,
      this.end,
      deepClone(this.props),
      deepClone(this.waypoints ?? []),
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
      newNode.props.labelForEdgeId = edge.id;
    }
    edge.labelNodes = newLabelNodes;

    return edge;
  }

  get startPosition() {
    return isConnected(this.start)
      ? this.start.node.getAnchorPosition(this.start.anchor)
      : this.start.position;
  }

  isStartConnected() {
    return isConnected(this.start);
  }

  get endPosition() {
    return isConnected(this.end)
      ? this.end.node.getAnchorPosition(this.end.anchor)
      : this.end.position;
  }

  isEndConnected() {
    return isConnected(this.end);
  }

  set start(start: Endpoint) {
    if (isConnected(this.#start)) {
      this.#start.node.removeEdge(this.#start.anchor, this);
    }

    if (isConnected(start)) {
      start.node.addEdge(start.anchor, this);
    }

    this.#start = start;
  }

  get start() {
    return this.#start;
  }

  set end(end: Endpoint) {
    if (isConnected(this.#end)) {
      this.#end.node.removeEdge(this.#end.anchor, this);
    }

    if (isConnected(end)) {
      end.node.addEdge(end.anchor, this);
    }

    this.#end = end;
  }

  get end() {
    return this.#end;
  }

  flip() {
    const start = this.#start;
    const end = this.#end;

    // Need to "zero" the end so that the setters logic should work correctly
    this.end = { position: Point.ORIGIN, anchor: 0 };

    this.start = end;
    this.end = start;
  }

  invalidate() {
    const uow = new UnitOfWork(this.diagram);
    this.recalculateIntersections(uow, true);
    this.adjustLabelNodePosition(uow);
    uow.commit();
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

    // TODO: Maybe use deep-equals here?
    if (this.#intersections !== intersections) {
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
      let newRotation = labelNode.node.bounds.rotation;
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
        isDifferent(newRotation, labelNode.node.bounds.rotation);

      if (hasChanged) {
        labelNode.node.bounds = {
          ...labelNode.node.bounds,
          rotation: newRotation,
          pos: {
            x: newCenterPoint.x - labelNode.node.bounds.size.w / 2,
            y: newCenterPoint.y - labelNode.node.bounds.size.h / 2
          }
        };
        uow.updateElement(labelNode.node);
      }
    }
  }
}
