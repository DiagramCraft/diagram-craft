import type {
  SerializedAnchorEndpoint,
  SerializedEndpoint,
  SerializedPointInNodeEndpoint
} from './serialization/serializedTypes';
import type { DiagramNode } from './diagramNode';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { isSerializedEndpointFree, isSerializedEndpointPointInNode } from './serialization/utils';
import { assert } from '@diagram-craft/utils/assert';
import { ElementLookup } from './elementLookup';

export interface Endpoint {
  readonly position: Point;
  serialize(): SerializedEndpoint;
  readonly isConnected: boolean;
}

export abstract class ConnectedEndpoint<T extends SerializedEndpoint = SerializedEndpoint>
  implements Endpoint
{
  protected constructor(readonly nodeFn: DiagramNode | (() => DiagramNode)) {}

  get node(): DiagramNode {
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
    nodeLookup: ElementLookup<DiagramNode>,
    defer = false
  ): Endpoint => {
    if (isSerializedEndpointFree(endpoint)) {
      return new FreeEndpoint(endpoint.position);
    } else if (isSerializedEndpointPointInNode(endpoint)) {
      return new PointInNodeEndpoint(
        defer ? () => nodeLookup.get(endpoint.node.id)! : nodeLookup.get(endpoint.node.id)!,
        endpoint.ref,
        endpoint.offset,
        endpoint.offsetType ?? 'absolute'
      );
    } else {
      return new AnchorEndpoint(
        defer ? () => nodeLookup.get(endpoint.node.id)! : nodeLookup.get(endpoint.node.id)!,
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
    return this.getAnchor().type;
  }

  getAnchor() {
    const anchor = this.node.getAnchor(this.anchorId);
    assert.present(anchor);
    return anchor;
  }

  get position() {
    const bounds = this.node.bounds;
    const ref = this.node._getAnchorPosition(this.anchorId);

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

  isCorner() {
    const p = this.ref;
    if (!p) return false;

    const r = Point.add(this.ref, this.offset);
    return (
      Point.isEqual(r, _p(0, 0)) ||
      Point.isEqual(r, _p(1, 0)) ||
      Point.isEqual(r, _p(0, 1)) ||
      Point.isEqual(r, _p(1, 1))
    );
  }

  get position() {
    const bounds = this.node.bounds;
    const ref = this.ref ? this.node._getPositionInBounds(this.ref) : bounds;

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
