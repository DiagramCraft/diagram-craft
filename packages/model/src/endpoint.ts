import { SerializedEndpoint } from './serialization/types';
import { DiagramNode } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Diagram } from './diagram';

export const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (endpoint as any).node !== undefined;

export interface Endpoint {
  readonly position: Point;
  serialize(): SerializedEndpoint;
}

export const Endpoint = {
  deserialize: (endpoint: SerializedEndpoint, diagram: Diagram): Endpoint => {
    if ('node' in endpoint) {
      if ('anchor' in endpoint) {
        return new ConnectedEndpoint(endpoint.anchor, diagram.nodeLookup.get(endpoint.node.id)!);
      } else {
        return new FixedEndpoint(endpoint.offset, diagram.nodeLookup.get(endpoint.node.id)!);
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
    public readonly offset: Point,
    public readonly node: DiagramNode
  ) {}

  get position() {
    const b = this.node.bounds;
    const r = {
      x: b.x + this.offset.x * b.w,
      y: b.y + this.offset.y * b.h
    };

    return r;
  }

  serialize(): SerializedEndpoint {
    return {
      node: { id: this.node.id },
      position: this.position,
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
