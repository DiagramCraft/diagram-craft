import { Box } from '../geometry/box.ts';
import { Transform } from '../geometry/transform.ts';
import { ChangeType, Diagram } from './diagram.ts';
import { Point } from '../geometry/point.ts';
import { DiagramNode, DuplicationContext } from './diagramNode.ts';
import { AbstractEdge, LabelNode, Waypoint } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { buildEdgePath } from './edgePathBuilder.ts';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '../geometry/pathPosition.ts';
import { Vector } from '../geometry/vector.ts';
import { newid } from '../utils/id.ts';
import { deepClone } from '../utils/clone.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement } from './diagramElement.ts';
import { UndoableAction } from './undoManager.ts';
import { round } from '../utils/math.ts';

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
        this.adjustLabelNodePosition();
      }
    });
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
    this.recalculateIntersections(new UnitOfWork(this.diagram), true);
    this.adjustLabelNodePosition();
  }

  onDrop(
    coord: Point,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _changeType: ChangeType,
    operation: string
  ): UndoableAction | undefined {
    if (elements.length === 1 && elements[0].type === 'node') {
      if (operation === 'split') {
        // Split the edge into two edges
        const element = elements[0] as DiagramNode;

        const newEdge = new DiagramEdge(
          newid(),
          { anchor: 0, node: element },
          this.end,
          deepClone(this.props),
          [],
          this.diagram,
          this.layer
        );
        element.addEdge(0, newEdge);
        this.layer.addElement(newEdge);

        this.end = { anchor: 0, node: element };
        uow.updateElement(this);
      } else {
        // Attach as label
        const element = elements[0] as DiagramNode;

        const path = this.path();
        const projection = path.projectPoint(coord);

        this.labelNodes = [
          ...(this.labelNodes ?? []),
          {
            id: element.id,
            node: element,
            offset: Point.ORIGIN,
            timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
            type: 'horizontal'
          }
        ];

        element.props.labelForEdgeId = this.id;

        // TODO: Perhaps create a helper to add an element as a label edge
        if (this.parent) {
          if (element.parent) {
            element.parent.children = element.parent.children.filter(c => c !== element);
            uow.updateElement(element.parent);
          }

          element.parent = this.parent;
          this.parent.children = [...this.parent.children, element];
          uow.updateElement(this.parent);
        }

        uow.updateElement(element);
        uow.updateElement(this);
      }
    }
    return undefined;
  }

  private recalculateIntersections(uow: UnitOfWork, propagate = false) {
    if (!this.diagram.mustCalculateIntersections) return;

    let currentEdgeHasBeenSeen = false;
    const path = this.path();
    const intersections: Intersection[] = [];
    for (const edge of this.diagram.visibleElements()) {
      if (edge === this) currentEdgeHasBeenSeen = true;

      if (edge.type === 'edge' && edge.id !== this.id) {
        const otherPath = edge.path();
        const intersectionsWithOtherPath = path.intersections(otherPath);
        intersections.push(
          ...intersectionsWithOtherPath.map(e => ({
            point: e.point,
            type: (currentEdgeHasBeenSeen ? 'below' : 'above') as Intersection['type']
          }))
        );
        if (propagate) {
          edge.recalculateIntersections(uow, false);
        }
      }
    }
    if (this.#intersections !== intersections) {
      this.#intersections = intersections;
      uow.updateElement(this);
    }
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

      // Note, using rounding here to avoid infinite recursion
      if (
        round(newCenterPoint.x) !== round(currentCenterPoint.x) ||
        round(newCenterPoint.y) !== round(currentCenterPoint.y) ||
        round(newRotation) !== round(labelNode.node.bounds.rotation)
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
