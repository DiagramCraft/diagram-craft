import { Box } from '../geometry/box.ts';
import { Transform } from '../geometry/transform.ts';
import { DiagramElement } from './diagram.ts';
import { Point } from '../geometry/point.ts';
import { DiagramNode } from './diagramNode.ts';

export type Waypoint = {
  point: Point;
  controlPoints?: [Point, Point];
};

export interface AbstractEdge extends DiagramElement {
  type: 'edge';
  id: string;
  waypoints?: Waypoint[];
  props: EdgeProps;
}

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

  transform(transforms: Transform[]) {
    this.bounds = Transform.box(this.bounds, ...transforms);

    this.waypoints = this.waypoints?.map(w => ({
      point: Transform.point(w.point, ...transforms),
      controlPoints: w.controlPoints
        ? [
            Transform.point(w.controlPoints[0], ...transforms),
            Transform.point(w.controlPoints[1], ...transforms)
          ]
        : undefined
    }));
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
}
