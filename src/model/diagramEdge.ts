import { Box } from '../geometry/box.ts';
import { Transform } from '../geometry/transform.ts';
import { Diagram } from './diagram.ts';
import { Point } from '../geometry/point.ts';
import { DiagramNode } from './diagramNode.ts';
import { AbstractEdge, LabelNode, Waypoint } from './types.ts';
import { Layer } from './diagramLayer.ts';
import { buildEdgePath } from './edgePathBuilder.ts';
import { TimeOffsetOnPath } from '../geometry/pathPosition.ts';

export type ConnectedEndpoint = { anchor: number; node: DiagramNode };
export type Endpoint = ConnectedEndpoint | { position: Point };

// TODO: Maybe make endpoint a class with this as a method?
//       ...or perhaps a property as discriminator
export const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  'node' in endpoint;

export class DiagramEdge implements AbstractEdge {
  id: string;
  type: 'edge';

  #start: Endpoint;
  #end: Endpoint;

  props: EdgeProps = {};
  waypoints: Waypoint[] | undefined;

  // TODO: Maybe we can remove the diagram and use the layer reference instead?
  diagram?: Diagram;
  layer?: Layer;

  labelNode?: LabelNode & {
    node: DiagramNode;
  };

  constructor(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgeProps,
    midpoints?: Waypoint[]
  ) {
    this.id = id;
    this.type = 'edge';
    this.#start = start;
    this.#end = end;
    this.props = props;
    this.waypoints = midpoints;

    this.adjustLabelNodePosition();
  }

  isLocked() {
    return this.layer?.isLocked() ?? false;
  }

  commit() {
    this.diagram?.updateElement(this);
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
    return buildEdgePath(this, this.props.routing?.rounding ?? 0);
  }

  transform(transforms: Transform[]) {
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

  private adjustLabelNodePosition() {
    if (!this.labelNode) return;

    const path = this.path();
    const refPoint = path.pointAt(
      TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: this.labelNode.timeOffset }, path)
    );

    const centerPoint = Point.add(refPoint, this.labelNode.offset);
    const currentCenterPoint = {
      x: this.labelNode.node.bounds.pos.x + this.labelNode.node.bounds.size.w / 2,
      y: this.labelNode.node.bounds.pos.y + this.labelNode.node.bounds.size.h / 2
    };
    if (!Point.isEqual(centerPoint, currentCenterPoint)) {
      this.labelNode.node.bounds = {
        ...this.labelNode.node.bounds,
        pos: {
          x: centerPoint.x - this.labelNode.node.bounds.size.w / 2,
          y: centerPoint.y - this.labelNode.node.bounds.size.h / 2
        }
      };
      this.diagram?.updateElement(this.labelNode.node);
    }
  }
}
