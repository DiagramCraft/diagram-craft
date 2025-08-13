import type {
  SerializedAnchorEndpoint,
  SerializedEndpoint,
  SerializedPointInNodeEndpoint
} from './serialization/types';
import type { DiagramNode } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { isSerializedEndpointPointInNode, isSerializedEndpointFree } from './serialization/utils';
import { getTypedKeys } from '@diagram-craft/utils/object';

export interface Endpoint {
  readonly position: Point;
  serialize(): SerializedEndpoint;
  readonly isConnected: boolean;
}

const Maplike = {
  get<T, K extends string | number | symbol>(m: Record<K, T> | Map<K, T>, key: K): T | undefined {
    return m instanceof Map ? m.get(key) : m[key];
  },
  keys<T, K extends string | number | symbol>(m: Record<K, T> | Map<K, T>): Array<K> {
    return m instanceof Map ? Array.from(m.keys()) : getTypedKeys(m);
  }
};

export abstract class ConnectedEndpoint<T extends SerializedEndpoint = SerializedEndpoint>
  implements Endpoint
{
  protected constructor(readonly nodeFn: DiagramNode | (() => DiagramNode)) {}

  get node() {
    if (this.nodeFn instanceof Function) {
      return this.nodeFn();
    }
    return this.nodeFn;
  }

  abstract isMidpoint(): boolean;

  abstract readonly position: Readonly<{ x: number; y: number }>;
  abstract serialize(): T;
  abstract isConnected: boolean;
}

export type OffsetType = 'absolute' | 'relative';

export const Endpoint = {
  deserialize: (
    endpoint: SerializedEndpoint,
    nodeLookup: Record<string, DiagramNode> | Map<string, DiagramNode>,
    defer = false
  ): Endpoint => {
    if (isSerializedEndpointFree(endpoint)) {
      return new FreeEndpoint(endpoint.position);
    } else if (isSerializedEndpointPointInNode(endpoint)) {
      return new PointInNodeEndpoint(
        defer
          ? () => Maplike.get(nodeLookup, endpoint.node.id)!
          : Maplike.get(nodeLookup, endpoint.node.id)!,
        endpoint.ref,
        endpoint.offset,
        endpoint.offsetType ?? 'absolute'
      );
    } else {
      return new AnchorEndpoint(
        defer
          ? () => Maplike.get(nodeLookup, endpoint.node.id)!
          : Maplike.get(nodeLookup, endpoint.node.id)!,
        endpoint.anchor,
        endpoint.offset ?? Point.ORIGIN
      );
    }
  }
};

export class AnchorEndpoint
  extends ConnectedEndpoint<SerializedAnchorEndpoint>
  implements Endpoint
{
  isConnected = true;

  constructor(
    node: DiagramNode | (() => DiagramNode),
    public readonly anchorId: string,
    public readonly offset: Point = Point.ORIGIN
  ) {
    super(node);
  }

  isMidpoint() {
    return this.getAnchorType() === 'center';
  }

  private getAnchorType() {
    return this.getAnchor()!.type;
  }

  getAnchor() {
    return this.node.getAnchor(this.anchorId);
  }

  get position() {
    const bounds = this.node.bounds;
    const ref = this.node._getAnchorPosition(this.anchorId!);

    const v = { x: this.offset.x * bounds.w, y: this.offset.y * bounds.h };
    const rotatedOffset = Point.rotateAround(v, bounds.r, Point.ORIGIN);

    return Point.add(ref, rotatedOffset);
  }

  serialize(): SerializedAnchorEndpoint {
    return {
      anchor: this.anchorId,
      node: { id: this.node.id },
      position: this.position,
      offset: this.offset
    };
  }
}

export class PointInNodeEndpoint
  extends ConnectedEndpoint<SerializedPointInNodeEndpoint>
  implements Endpoint
{
  isConnected = true;

  constructor(
    node: DiagramNode | (() => DiagramNode),
    public readonly ref: Point | undefined,
    public readonly offset: Point,
    public readonly offsetType: OffsetType
  ) {
    super(node);
  }

  isMidpoint() {
    const p = this.ref;
    if (!p) return false;
    return p.x === 0.5 && p.y === 0.5 && this.offset.x === 0 && this.offset.y === 0;
  }

  get position() {
    const bounds = this.node.bounds;
    const ref = this.ref ? this.node!._getPositionInBounds(this.ref) : bounds;

    const v =
      this.offsetType === 'absolute'
        ? this.offset
        : { x: this.offset.x * bounds.w, y: this.offset.y * bounds.h };
    const p = Point.add(ref, v);

    if (!this.ref && this.offsetType !== 'absolute') {
      return Point.rotateAround(p, bounds.r, Box.center(bounds));
    }
    return p;
  }

  serialize(): SerializedPointInNodeEndpoint {
    return {
      node: { id: this.node.id },
      position: this.position,
      ref: this.ref,
      offset: this.offset,
      offsetType: this.offsetType
    };
  }
}

export class FreeEndpoint implements Endpoint {
  isConnected = false;
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
