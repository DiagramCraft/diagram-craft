import {
  SerializedAnchorEndpoint,
  SerializedEndpoint,
  SerializedPointInNodeEndpoint
} from './serialization/types';
import { DiagramNode } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { isSerializedEndpointConnected, isSerializedEndpointFree } from './serialization/serialize';

export interface Endpoint {
  readonly position: Point;
  serialize(): SerializedEndpoint;
  readonly isConnected: boolean;
}

const Maplike = {
  get<T, K extends string | number | symbol>(m: Record<K, T> | Map<K, T>, key: K): T | undefined {
    return m instanceof Map ? m.get(key) : m[key];
  }
};

export abstract class ConnectedEndpoint<T extends SerializedEndpoint = SerializedEndpoint>
  implements Endpoint
{
  protected constructor(public readonly node: DiagramNode) {}

  abstract isMidpoint(): boolean;

  abstract readonly position: Readonly<{ x: number; y: number }>;
  abstract serialize(): T;
  abstract isConnected: boolean;
}

export type OffsetType = 'absolute' | 'relative';

export const Endpoint = {
  deserialize: (
    endpoint: SerializedEndpoint,
    nodeLookup: Record<string, DiagramNode> | Map<string, DiagramNode>
  ): Endpoint => {
    if (isSerializedEndpointFree(endpoint)) {
      return new FreeEndpoint(endpoint.position);
    } else if (isSerializedEndpointConnected(endpoint)) {
      return new PointInNodeEndpoint(
        Maplike.get(nodeLookup, endpoint.node.id)!,
        endpoint.ref,
        endpoint.offset,
        endpoint.offsetType ?? 'absolute'
      );
    } else {
      return new AnchorEndpoint(
        Maplike.get(nodeLookup, endpoint.node.id)!,
        endpoint.anchor,
        endpoint.offset ?? Point.ORIGIN,
        endpoint.offsetType ?? 'absolute'
      );
    }
  }
};

const applyOffset = (offset: Point, offsetType: OffsetType, ref: Point, bounds: Box) => {
  if (offsetType === 'absolute') {
    return Point.add(ref, offset);
  } else {
    return Point.add(ref, { x: offset.x * bounds.w, y: offset.y * bounds.h });
  }
};

export class AnchorEndpoint
  extends ConnectedEndpoint<SerializedAnchorEndpoint>
  implements Endpoint
{
  isConnected = true;

  constructor(
    node: DiagramNode,
    public readonly anchorId: string,
    public readonly offset: Point = Point.ORIGIN,
    public readonly offsetType: OffsetType = 'relative'
  ) {
    super(node);
  }

  isMidpoint() {
    return this.node!.getAnchor(this.anchorId!)!.type === 'center';
  }

  get position() {
    const ref = this.node!._getAnchorPosition(this.anchorId!);
    return applyOffset(this.offset, this.offsetType, ref, this.node!.bounds);
  }

  serialize(): SerializedAnchorEndpoint {
    return {
      anchor: this.anchorId,
      node: { id: this.node.id },
      position: this.position,
      offset: this.offset,
      offsetType: this.offsetType
    };
  }
}

export class PointInNodeEndpoint
  extends ConnectedEndpoint<SerializedPointInNodeEndpoint>
  implements Endpoint
{
  isConnected = true;

  constructor(
    node: DiagramNode,
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

    const p = applyOffset(this.offset, this.offsetType, ref, bounds);
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
