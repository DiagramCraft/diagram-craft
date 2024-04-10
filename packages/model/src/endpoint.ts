import { SerializedEndpoint } from './serialization/types';
import { DiagramNode } from './diagramNode';
import { Diagram } from './index';
import { Point } from '@diagram-craft/geometry';

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
      return new ConnectedEndpoint(endpoint.anchor, diagram.nodeLookup.get(endpoint.node.id)!);
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
