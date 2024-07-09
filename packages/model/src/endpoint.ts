import { SerializedEndpoint, SerializedFixedEndpoint } from './serialization/types';
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

// TODO: Seems to be partially duplicated in deserizalieEndpoint
export const Endpoint = {
  deserialize: (endpoint: SerializedEndpoint, diagram: Diagram): Endpoint => {
    if ('node' in endpoint) {
      if ('anchor' in endpoint && !('offset' in endpoint)) {
        return new ConnectedEndpoint(endpoint.anchor, diagram.nodeLookup.get(endpoint.node.id)!);
      } else {
        return new FixedEndpoint(
          endpoint.anchor,
          endpoint.offset,
          diagram.nodeLookup.get(endpoint.node.id)!,
          endpoint.offsetType ?? 'absolute',
          endpoint.type ?? 'anchor'
        );
      }
    } else {
      return new FreeEndpoint(endpoint.position);
    }
  }
};

export class ConnectedEndpoint implements Endpoint {
  constructor(
    public readonly anchor: string,
    public readonly node: DiagramNode
  ) {}

  // TODO: Should be able to remove this
  isMidpoint() {
    return this.node!.getAnchor(this.anchor!)!.type === 'center';
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
    public readonly anchor: Point | undefined,
    public readonly offset: Point,
    public readonly node: DiagramNode,
    public readonly offsetType: 'absolute' | 'relative',
    public readonly type: 'boundary' | 'anchor'
  ) {}

  // TODO: Can we remove this
  isMidpoint() {
    const p = this.anchor;
    if (!p) return false;
    return p.x === 0.5 && p.y === 0.5 && this.offset.x === 0 && this.offset.y === 0;
  }

  get position() {
    const bounds = this.node.bounds;
    const ref = this.anchor ? this.node!._getPositionInBounds(this.anchor) : bounds;

    if (this.offsetType === 'absolute') {
      return Point.add(ref, this.offset);
    } else {
      return Point.rotateAround(
        Point.add(ref, { x: this.offset.x * bounds.w, y: this.offset.y * bounds.h }),
        bounds.r,
        Box.center(bounds)
      );
    }
  }

  serialize(): SerializedFixedEndpoint {
    return {
      node: { id: this.node.id },
      position: this.position,
      anchor: this.anchor,
      offset: this.offset,
      offsetType: this.offsetType,
      type: this.type
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
