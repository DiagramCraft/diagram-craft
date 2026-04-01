import type {
  SerializedAnchorEndpoint,
  SerializedEndpoint,
  SerializedPointOnEdgeEndpoint,
  SerializedPointInNodeEndpoint
} from './serialization/serializedTypes';
import type { DiagramNode } from './diagramNode';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import {
  isSerializedEndpointFree,
  isSerializedEndpointPointInNode,
  isSerializedEndpointPointOnEdge
} from './serialization/utils';
import { assert } from '@diagram-craft/utils/assert';
import { ElementLookup } from './elementLookup';
import {
  getCollapsedAncestor,
  getBoundsRelativeToCollapsedAncestor,
  getAnchorPositionForBounds,
  getPositionInBoundsForBox
} from './collapsible';
import type { DiagramEdge } from './diagramEdge';
import { clamp } from '@diagram-craft/utils/math';

/** Scales relative offsets to bounds space and rotates the result around the origin. */
const calculateOffset = (offset: Point, bounds: Box, isRelative: boolean): Point => {
  const v = isRelative ? { x: offset.x * bounds.w, y: offset.y * bounds.h } : offset;
  return Point.rotateAround(v, bounds.r, Point.ORIGIN);
};

/**
 * Represents an edge endpoint.
 *
 * Endpoints can either be free-floating in the canvas or attached to a node.
 */
export interface Endpoint {
  readonly position: Point;
  serialize(): SerializedEndpoint;
  readonly isConnected: boolean;
}

/**
 * Base class for endpoints that are attached to a node.
 *
 * The node can be provided eagerly or via a deferred lookup callback, which is
 * useful while deserializing graph structures that resolve nodes in a later pass.
 *
 * @typeParam T - The serialized endpoint shape
 */
export abstract class ConnectedEndpoint<
  T extends SerializedEndpoint = SerializedEndpoint,
  TTarget extends DiagramNode | DiagramEdge = DiagramNode | DiagramEdge
> implements Endpoint {
  protected constructor(readonly targetFn: TTarget | (() => TTarget)) {}

  get target(): TTarget {
    if (this.targetFn instanceof Function) {
      return this.targetFn();
    }
    return this.targetFn;
  }

  get node(): DiagramNode {
    assert.present(this.target);
    assert.true('nodeType' in this.target);
    return this.target as unknown as DiagramNode;
  }

  get edge(): DiagramEdge {
    assert.present(this.target);
    assert.true('start' in this.target && 'end' in this.target);
    return this.target as unknown as DiagramEdge;
  }

  isNodeConnected(): this is ConnectedEndpoint<T, DiagramNode> {
    return 'nodeType' in this.target;
  }

  isEdgeConnected(): this is ConnectedEndpoint<T, DiagramEdge> {
    return 'start' in this.target && 'end' in this.target;
  }

  abstract isMidpoint(): boolean;

  abstract readonly position: Readonly<{ x: number; y: number }>;
  abstract serialize(): T;
  abstract isConnected: boolean;
}

/**
 * Describes how an endpoint offset is interpreted.
 *
 * - `absolute`: the offset is stored in canvas units
 * - `relative`: the offset is stored in normalized node-space units
 */
export type OffsetType = 'absolute' | 'relative';

/**
 * Factory helpers for working with endpoints.
 *
 * @namespace
 */
export const Endpoint = {
  /**
   * Deserializes a serialized endpoint.
   *
   * When `defer` is enabled, connected endpoints keep a lazy node lookup so they
   * can be created before the referenced node object is accessed.
   *
   * @param endpoint - The serialized endpoint to deserialize
   * @param nodeLookup - Lookup used to resolve referenced nodes
   * @param defer - Whether node lookup should be deferred until first access
   * @returns The deserialized endpoint instance
   */
  deserialize: (
    endpoint: SerializedEndpoint,
    nodeLookup: ElementLookup<DiagramNode>,
    edgeLookupOrDefer?: ElementLookup<DiagramEdge> | boolean,
    defer = false
  ): Endpoint => {
    const edgeLookup =
      typeof edgeLookupOrDefer === 'boolean' ? undefined : edgeLookupOrDefer;
    const resolvedDefer = typeof edgeLookupOrDefer === 'boolean' ? edgeLookupOrDefer : defer;

    if (isSerializedEndpointFree(endpoint)) {
      return new FreeEndpoint(endpoint.position);
    } else if (isSerializedEndpointPointOnEdge(endpoint)) {
      assert.present(edgeLookup);
      return new PointOnEdgeEndpoint(
        resolvedDefer ? () => edgeLookup.get(endpoint.edge.id)! : edgeLookup.get(endpoint.edge.id)!,
        endpoint.pathPosition
      );
    } else if (isSerializedEndpointPointInNode(endpoint)) {
      return new PointInNodeEndpoint(
        resolvedDefer
          ? () => nodeLookup.get(endpoint.node.id)!
          : nodeLookup.get(endpoint.node.id)!,
        endpoint.ref,
        endpoint.offset,
        endpoint.offsetType ?? 'absolute'
      );
    } else {
      return new AnchorEndpoint(
        resolvedDefer
          ? () => nodeLookup.get(endpoint.node.id)!
          : nodeLookup.get(endpoint.node.id)!,
        endpoint.anchor,
        endpoint.offset ?? Point.ORIGIN
      );
    }
  }
};

/**
 * Endpoint that snaps to a named anchor on a node.
 */
export class AnchorEndpoint
  extends ConnectedEndpoint<SerializedAnchorEndpoint, DiagramNode>
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

  get position(): Point {
    const collapsedAncestor = getCollapsedAncestor(this.node);

    if (collapsedAncestor) {
      const bounds = getBoundsRelativeToCollapsedAncestor(this.node);
      const ref = getAnchorPositionForBounds(this.node, this.anchorId, bounds);
      const rotatedOffset = calculateOffset(this.offset, bounds, true);
      return Point.add(ref, rotatedOffset);
    }

    const bounds = this.node.bounds;
    const ref = this.node._getAnchorPosition(this.anchorId);
    const rotatedOffset = calculateOffset(this.offset, bounds, true);

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

/**
 * Endpoint that targets an arbitrary point inside or around a node.
 *
 * The endpoint can either use a normalized reference point inside the node or a
 * free offset from the node bounds when `ref` is undefined.
 */
export class PointInNodeEndpoint
  extends ConnectedEndpoint<SerializedPointInNodeEndpoint, DiagramNode>
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

    if (this.offsetType === 'relative') {
      const r = Point.add(this.ref, this.offset);
      return (
        Point.isEqual(r, _p(0, 0)) ||
        Point.isEqual(r, _p(1, 0)) ||
        Point.isEqual(r, _p(0, 1)) ||
        Point.isEqual(r, _p(1, 1))
      );
    }

    return Box.corners(this.node.bounds).some(corner => Point.isEqual(corner, this.position));
  }

  get position(): Point {
    const collapsedAncestor = getCollapsedAncestor(this.node);

    if (collapsedAncestor) {
      const bounds = getBoundsRelativeToCollapsedAncestor(this.node);
      const ref = this.ref ? getPositionInBoundsForBox(this.node, this.ref, bounds) : bounds;

      const v =
        this.offsetType === 'absolute'
          ? this.offset
          : { x: this.offset.x * bounds.w, y: this.offset.y * bounds.h };
      const p = Point.add(ref, v);

      const pointInCollapsed =
        !this.ref && this.offsetType !== 'absolute'
          ? Point.rotateAround(p, bounds.r, Box.center(bounds))
          : p;

      return Box.projectPointToBoundary(pointInCollapsed, collapsedAncestor.bounds);
    }

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

/**
 * Endpoint attached to a normalized position along another edge's routed path.
 */
export class PointOnEdgeEndpoint
  extends ConnectedEndpoint<SerializedPointOnEdgeEndpoint, DiagramEdge>
  implements Endpoint
{
  isConnected = true;

  constructor(edge: DiagramEdge | (() => DiagramEdge), public readonly pathPosition: number) {
    super(edge);
  }

  isMidpoint() {
    return false;
  }

  get normalizedPathPosition() {
    return clamp(this.pathPosition, 0, 1);
  }

  get position(): Point {
    const path = this.edge.path();
    const length = path.length();
    if (length === 0 || Number.isNaN(length)) {
      return this.edge.start.position;
    }
    return path.pointAt({ pathD: length * this.normalizedPathPosition });
  }

  serialize(): SerializedPointOnEdgeEndpoint {
    return {
      edge: { id: this.edge.id },
      position: this.position,
      pathPosition: this.normalizedPathPosition
    };
  }
}

/**
 * Endpoint with a fixed canvas position and no node attachment.
 */
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
