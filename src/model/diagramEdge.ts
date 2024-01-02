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

export type ConnectedEndpoint = { anchor: number; node: DiagramNode };
export type Endpoint = ConnectedEndpoint | { position: Point };

export const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  'node' in endpoint;

export type ResolvedLabelNode = LabelNode & {
  node: DiagramNode;
};

export class DiagramEdge implements AbstractEdge {
  readonly id: string;
  readonly type = 'edge';
  readonly props: EdgeProps = {};

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
        this.adjustLabelNodePosition();
      }
    });
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

  transform(transforms: ReadonlyArray<Transform>, _uow: UnitOfWork, _type: ChangeType) {
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
    if (isConnected(this.#start) && isConnected(start)) {
      // both before and after are connected
      if (this.#start.node === start.node) {
        this.#start.node.updateEdge(start.anchor, this);
      } else {
        this.#start.node.removeEdge(this);
        start.node.addEdge(start.anchor, this);
      }
    } else if (isConnected(this.#start)) {
      // before is connected, after is not
      this.#start.node.removeEdge(this);
    } else if (isConnected(start)) {
      // before is not connected, after is connected
      start.node.addEdge(start.anchor, this);
    }

    this.#start = start;
  }

  get start() {
    return this.#start;
  }

  set end(end: Endpoint) {
    if (isConnected(this.#end) && isConnected(end)) {
      // both before and after are connected
      if (this.#end.node === end.node) {
        this.#end.node.updateEdge(end.anchor, this);
      } else {
        this.#end.node.removeEdge(this);
        end.node.addEdge(end.anchor, this);
      }
    } else if (isConnected(this.#end)) {
      // before is connected, after is not
      this.#end.node.removeEdge(this);
    } else if (isConnected(end)) {
      // before is not connected, after is connected
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

    if (isConnected(this.#start)) {
      this.#start.node.removeEdge(this);
    }

    if (isConnected(this.#end)) {
      this.#end.node.removeEdge(this);
    }

    this.#start = end;
    this.#end = start;

    if (isConnected(this.#start)) {
      this.#start.node.addEdge(this.#start.anchor, this);
    }
    if (isConnected(this.#end)) {
      this.#end.node.addEdge(this.#end.anchor, this);
    }
  }

  invalidate() {
    this.adjustLabelNodePosition();
  }

  private adjustLabelNodePosition() {
    if (!this.labelNodes) return;

    const path = this.path();

    for (const labelNode of this.labelNodes) {
      const lengthOffsetOnPath = TimeOffsetOnPath.toLengthOffsetOnPath(
        { pathT: labelNode.timeOffset },
        path
      );
      const refPoint = path.pointAt(lengthOffsetOnPath);

      const currentCenterPoint = Box.center(labelNode.node.bounds);

      let newCenterPoint = Point.add(refPoint, labelNode.offset);
      let newRotation = labelNode.node.bounds.rotation;
      if (labelNode.type.startsWith('parallel') || labelNode.type.startsWith('perpendicular')) {
        const tangent = path.tangentAt(lengthOffsetOnPath);
        newRotation = Vector.angle(tangent);

        if (labelNode.type.startsWith('perpendicular')) {
          newRotation += Math.PI / 2;
        }

        if (labelNode.type.endsWith('-readable')) {
          if (newRotation > Math.PI / 2) newRotation -= Math.PI;
          if (newRotation < -Math.PI / 2) newRotation += Math.PI;
        }

        newCenterPoint = Point.add(
          refPoint,
          Point.rotate({ x: -labelNode.offset.x, y: 0 }, Vector.angle(tangent) + Math.PI / 2)
        );
      } else if (labelNode.type === 'horizontal') {
        newRotation = 0;
      } else if (labelNode.type === 'vertical') {
        newRotation = Math.PI / 2;
      }

      if (
        !Point.isEqual(newCenterPoint, currentCenterPoint) ||
        newRotation !== labelNode.node.bounds.rotation
      ) {
        labelNode.node.bounds = {
          ...labelNode.node.bounds,
          rotation: newRotation,
          pos: {
            x: newCenterPoint.x - labelNode.node.bounds.size.w / 2,
            y: newCenterPoint.y - labelNode.node.bounds.size.h / 2
          }
        };
        this.diagram.updateElement(labelNode.node);
      }
    }
  }
}
