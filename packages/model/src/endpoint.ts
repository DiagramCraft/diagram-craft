import { SerializedEndpoint } from './serialization/types';
import { DiagramNode } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from './diagram';
import { Box } from '@diagram-craft/geometry/box';

export const isConnectedOrFixed = (
  endpoint: Endpoint
): endpoint is ConnectedEndpoint & FixedEndpoint =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (endpoint as any).node !== undefined;

export const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (endpoint as any).anchor !== undefined && (endpoint as any).isMidpoint;

export interface Endpoint {
  readonly position: Point;
  serialize(): SerializedEndpoint;
}

export const Endpoint = {
  deserialize: (endpoint: SerializedEndpoint, diagram: Diagram): Endpoint => {
    if ('node' in endpoint) {
      if ('anchor' in endpoint && !('offset' in endpoint)) {
        return new ConnectedEndpoint(endpoint.anchor, diagram.nodeLookup.get(endpoint.node.id)!);
      } else {
        return new FixedEndpoint(
          endpoint.anchor,
          endpoint.offset,
          diagram.nodeLookup.get(endpoint.node.id)!
        );
      }
    } else {
      return new FreeEndpoint(endpoint.position);
    }
  }
};

export class ConnectedEndpoint implements Endpoint {
  constructor(
    public readonly anchor: number,
    public readonly node: DiagramNode
  ) {}

  isMidpoint() {
    const p = this.node!.getAnchor(this.anchor!)!.start;
    if (!p) return false;
    return p.x === 0.5 && p.y === 0.5;
  }

  get position() {
    return this.node!._getAnchorPosition(this.anchor!);
  }

  serialize(): SerializedEndpoint {
    return {
      anchor: this.anchor,
      node: { id: this.node.id },
      position: this.position
    };
  }
}

export class FixedEndpoint implements Endpoint {
  constructor(
    public readonly anchor: Point,
    public readonly offset: Point,
    public readonly node: DiagramNode
  ) {}

  isMidpoint() {
    const p = this.anchor;
    return p.x === 0.5 && p.y === 0.5 && this.offset.x === 0 && this.offset.y === 0;
  }

  get position() {
    const point = Point.add(this.node!._getPositionInBounds(this.anchor!), this.offset);
    return Point.rotateAround(point, this.node.bounds.r, Box.center(this.node.bounds));
  }

  serialize(): SerializedEndpoint {
    return {
      node: { id: this.node.id },
      position: this.position,
      anchor: this.anchor,
      offset: this.offset
    };
  }
}

export class FreeEndpoint implements Endpoint {
  readonly position: Point;

  constructor(position: Point) {
    this.position = position;
  }

  serialize(): SerializedEndpoint {
    return {
      position: this.position
    };
  }
}
