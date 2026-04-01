import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import {
  AttachEdgeContext,
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Anchor } from '@diagram-craft/model/anchor';
import {
  AnchorEndpoint,
  NodeConnectedEndpoint,
  Endpoint,
  PointInNodeEndpoint
} from '@diagram-craft/model/endpoint';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import { deepClone } from '@diagram-craft/utils/object';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { clamp, isSame } from '@diagram-craft/utils/math';

type UMLExecutionTransformChange = {
  nodeId: string;
  prevBounds: Box;
  newBounds: Box;
};

declare global {
  namespace DiagramCraft {
    interface UnitOfWorkMetadata {
      umlExecutionTransformChanges?: Map<string, UMLExecutionTransformChange>;
      umlExecutionCascadeActive?: boolean;
    }
  }
}

const RIGHT_ANCHOR_COUNT = 7;
const DEFAULT_TOP_GAP = 10;
const NEST_OFFSET = 8;
const NODE_MIN_HEIGHT = 25;
const RIGHT_CORNER_PADDING = 10;

const isConnected = (e: Endpoint): e is NodeConnectedEndpoint => e instanceof NodeConnectedEndpoint;

const isFullyConnected = (edge: DiagramEdge) => isConnected(edge.start) && isConnected(edge.end);

const isExecutionNode = (element: DiagramElement | undefined): element is DiagramNode =>
  !!element && isNode(element) && element.nodeType === 'umlLifelineExecution';

const isRightSideAnchor = (anchorId: string) =>
  /^r\d+$/.test(anchorId) &&
  Number(anchorId.slice(1)) >= 1 &&
  Number(anchorId.slice(1)) <= RIGHT_ANCHOR_COUNT;

/**
 * Execution cascade behavior:
 *
 * - A direct vertical move or resize of an execution may resize connected executions in the same UOW.
 * - Dependents are never translated independently; they are only resized.
 * - If two connected executions are both directly transformed in the same UOW, the shared edge is not
 *   cascaded.
 * - Circular paths are stopped by tracking which nodes were already adjusted during the current cascade.
 *
 * Connection rules:
 *
 * - `tl` and `bl` stay as fixed semantic anchors on the left edge.
 * - Right-side execution connections may slide vertically and are rewritten as right-edge
 *   `PointInNodeEndpoint`s when needed.
 * - Right-side connections must stay at least `UML_EXECUTION_RIGHT_SIDE_CORNER_PADDING` away from the
 *   top and bottom corners.
 * - Dependent executions may shrink, but never below `UML_EXECUTION_MIN_HEIGHT`. If that floor prevents
 *   all constraints from being satisfied, the blocked edge is allowed to become non-horizontal.
 *
 * Algorithm:
 *
 * - `onTransform(...)` records the first meaningful `prevBounds` and the latest `newBounds` for each
 *   directly transformed execution in `uow.metadata`.
 * - A single `before commit` hook runs once per UOW and treats the changed executions as cascade roots.
 * - For each traversed edge, the current node endpoint's previous Y is compared with its current Y. If
 *   the endpoint moved, that Y is propagated to the opposite endpoint.
 * - The dependent node is resized from the anchor that is already connected:
 *   `tl` resizes from the top, `bl` and right-side anchors resize from below, and flexible right-side
 *   endpoints may be retargeted along the right edge.
 * - Nodes already adjusted earlier in the same root traversal may still be resized again so later
 *   constraints can refine them, but direct transform roots remain authoritative and are not rewritten
 *   by dependents.
 */
class ExecutionCascade {
  private readonly adjusted = new Set<string>();

  constructor(
    private readonly transformRoots: ReadonlySet<string>,
    private readonly uow: UnitOfWork
  ) {}

  run(changes: UMLExecutionTransformChange[]) {
    for (const change of changes) {
      const node = this.uow.diagram.lookup(change.nodeId);
      if (!isExecutionNode(node)) continue;

      this.adjusted.add(node.id);
      this.cascadeExecutionResize(node, new Set([node.id]), change.prevBounds);
    }
  }

  private cascadeExecutionResize(currentNode: DiagramNode, path: Set<string>, prevBoundsArg: Box) {
    const isCurrentNodeRoot = this.transformRoots.has(currentNode.id);

    let prevBounds = prevBoundsArg;
    for (const edge of currentNode.edges.filter(isFullyConnected)) {
      const [own, other] = this.getEndpointPair(edge, currentNode);
      if (!isExecutionNode(own.node) || !isExecutionNode(other.node)) continue;

      const previousAnchorY = this.getYPositionForEndpoint(own, prevBounds);
      const targetY = this.getAndAdjustTargetY(edge, own, this.uow);

      // No vertical movement on this endpoint means there is nothing to propagate through this edge.
      if (previousAnchorY !== undefined && isSame(previousAnchorY, targetY)) continue;

      if (
        !isCurrentNodeRoot &&
        this.isConnectedToRightSide(own) &&
        (this.adjusted.has(other.node.id) || path.has(other.node.id))
      ) {
        // Once a dependent was already processed, prefer sliding this node's flexible right-side
        // endpoint instead of reopening the other node's subtree.
        const currentNodePreviousBounds = this.adjustEndpoint(
          edge,
          own,
          other.position.y,
          this.uow
        );
        if (currentNodePreviousBounds) {
          prevBounds = currentNodePreviousBounds;
        }
        continue;
      }

      if (this.transformRoots.has(other.node.id)) {
        // Shared edges between directly transformed executions are intentionally ignored.
        continue;
      }

      if (this.adjusted.has(other.node.id) || path.has(other.node.id)) {
        // The other node was already touched earlier in this traversal, so update it in place but
        // do not recurse into it again.
        this.adjustEndpoint(edge, other, targetY, this.uow);
        continue;
      }

      // First time we touch this dependent node: resize it and continue the cascade from there.
      const dependentPrevBounds = this.adjustEndpoint(edge, other, targetY, this.uow);
      if (!dependentPrevBounds) continue;

      path.add(other.node.id);
      try {
        this.adjusted.add(other.node.id);
        this.cascadeExecutionResize(other.node, path, dependentPrevBounds);
      } finally {
        path.delete(other.node.id);
      }
    }
  }

  private isConnectedToRightSide(endpoint: NodeConnectedEndpoint) {
    if (endpoint instanceof AnchorEndpoint) {
      return isRightSideAnchor(endpoint.anchorId);
    } else if (endpoint instanceof PointInNodeEndpoint) {
      if (endpoint.ref) {
        return endpoint.ref.x === 1 && endpoint.offset.x === 0;
      }

      if (endpoint.offsetType === 'relative') {
        return isSame(endpoint.offset.x, 1);
      }

      return isSame(endpoint.offset.x, endpoint.node.bounds.w);
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  private hasCornerRightSideAnchorPadding(endpoint: NodeConnectedEndpoint) {
    if (endpoint instanceof AnchorEndpoint) {
      return endpoint.anchorId !== 'r1' && endpoint.anchorId !== `r${RIGHT_ANCHOR_COUNT}`;
    }

    if (endpoint instanceof PointInNodeEndpoint) {
      if (endpoint.ref) {
        const normalizedY =
          endpoint.offsetType === 'absolute'
            ? endpoint.ref.y + endpoint.offset.y / endpoint.node.bounds.h
            : endpoint.ref.y + endpoint.offset.y;
        return !isSame(normalizedY, 0) && !isSame(normalizedY, 1);
      }

      const normalizedY =
        endpoint.offsetType === 'absolute'
          ? endpoint.offset.y / endpoint.node.bounds.h
          : endpoint.offset.y;
      return !isSame(normalizedY, 0) && !isSame(normalizedY, 1);
    }

    VERIFY_NOT_REACHED();
  }

  private getNormalizedYForAnchor(anchorId: string) {
    if (anchorId === 'tl') return 0;
    if (anchorId === 'bl') return 1;

    assert.true(isRightSideAnchor(anchorId));

    return (Number(anchorId.slice(1)) - 1) / (RIGHT_ANCHOR_COUNT - 1);
  }

  private getYPositionForEndpoint(
    endpoint: NodeConnectedEndpoint,
    bounds: Box
  ): number | undefined {
    if (endpoint instanceof AnchorEndpoint) {
      const normalizedY = this.getNormalizedYForAnchor(endpoint.anchorId);
      return bounds.y + bounds.h * normalizedY;
    } else if (endpoint instanceof PointInNodeEndpoint) {
      // endpoint is now PointInNodeEndpoint
      if (endpoint.ref) {
        const refY = bounds.y + endpoint.ref.y * bounds.h;
        const offsetY =
          endpoint.offsetType === 'absolute' ? endpoint.offset.y : endpoint.offset.y * bounds.h;
        return refY + offsetY;
      }

      return undefined;
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  private setRightSideEndpoint(
    endpoint: NodeConnectedEndpoint,
    edge: DiagramEdge,
    targetY: number,
    uow: UnitOfWork
  ) {
    const newEndpoint = new PointInNodeEndpoint(
      endpoint.node,
      _p(1, 0),
      _p(0, targetY - endpoint.node.bounds.y),
      'absolute'
    );

    if (edge.start === endpoint) {
      edge.setStart(newEndpoint, uow);
    } else if (edge.end === endpoint) {
      edge.setEnd(newEndpoint, uow);
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  private getEndpointPair(edge: DiagramEdge, node: DiagramNode) {
    if (!isConnected(edge.start) || !isConnected(edge.end)) VERIFY_NOT_REACHED();

    if (edge.start.node === node) {
      return [edge.start, edge.end] as const;
    } else if (edge.end.node === node) {
      return [edge.end, edge.start] as const;
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  private adjustEndpoint(
    edge: DiagramEdge,
    endpoint: NodeConnectedEndpoint,
    targetY: number,
    uow: UnitOfWork
  ) {
    if (this.isConnectedToRightSide(endpoint)) {
      return this.adjustRightSideEndpoint(edge, endpoint, targetY, uow);
    } else if (endpoint instanceof AnchorEndpoint) {
      return this.adjustLeftSideEndpoint(endpoint, targetY, uow);
    } else {
      return undefined;
    }
  }

  private adjustRightSideEndpoint(
    edge: DiagramEdge,
    endpoint: NodeConnectedEndpoint,
    targetY: number,
    uow: UnitOfWork
  ) {
    const bounds = endpoint.node.bounds;
    const cornerPadding = this.hasCornerRightSideAnchorPadding(endpoint) ? RIGHT_CORNER_PADDING : 0;

    const effectiveTargetY = Math.max(targetY, bounds.y + cornerPadding);
    const requiredHeight = Math.max(0.1, effectiveTargetY - bounds.y + cornerPadding);
    if (requiredHeight > bounds.h) {
      endpoint.node.setBounds({ ...bounds, h: requiredHeight }, uow);
    }
    this.setRightSideEndpoint(endpoint, edge, effectiveTargetY, uow);
    return bounds;
  }

  private adjustLeftSideEndpoint(endpoint: AnchorEndpoint, targetY: number, uow: UnitOfWork) {
    const bounds = endpoint.node.bounds;

    const clampDependentHeight = (currentHeight: number, proposedHeight: number) => {
      if (proposedHeight >= currentHeight) return proposedHeight;
      return clamp(proposedHeight, NODE_MIN_HEIGHT, currentHeight);
    };

    if (endpoint.anchorId === 'tl') {
      const h = clampDependentHeight(bounds.h, bounds.h + (bounds.y - targetY));
      const y = bounds.y + (bounds.h - h);
      endpoint.node.setBounds({ ...bounds, y, h }, uow);
      return bounds;
    } else if (endpoint.anchorId === 'bl') {
      const h = clampDependentHeight(bounds.h, targetY - bounds.y);
      endpoint.node.setBounds({ ...bounds, h }, uow);
      return bounds;
    } else {
      VERIFY_NOT_REACHED();
    }
  }

  private getAndAdjustTargetY(edge: DiagramEdge, endpoint: NodeConnectedEndpoint, uow: UnitOfWork) {
    const ypos = endpoint.position.y;
    if (this.isConnectedToRightSide(endpoint)) {
      const cornerPadding = this.hasCornerRightSideAnchorPadding(endpoint)
        ? RIGHT_CORNER_PADDING
        : 0;
      const adjusted = clamp(
        ypos,
        endpoint.node.bounds.y + cornerPadding,
        endpoint.node.bounds.y + endpoint.node.bounds.h - cornerPadding
      );
      if (!isSame(adjusted, ypos)) {
        // Direct transform roots may already use flexible right-side endpoints. If the root shrinks,
        // the endpoint itself may need to slide inward before we compare its previous and current Y.
        this.setRightSideEndpoint(endpoint, edge, adjusted, uow);
      }
      return adjusted;
    } else {
      return ypos;
    }
  }
}

const registerExecutionTransformChange = (
  node: DiagramNode,
  prevBounds: Box,
  newBounds: Box,
  uow: UnitOfWork
) => {
  if (Box.isEqual(prevBounds, newBounds)) return;

  uow.metadata.umlExecutionTransformChanges ??= new Map();
  const existing = uow.metadata.umlExecutionTransformChanges.get(node.id);
  if (existing) {
    existing.newBounds = deepClone(newBounds);
  } else {
    uow.metadata.umlExecutionTransformChanges.set(node.id, {
      nodeId: node.id,
      prevBounds: deepClone(prevBounds),
      newBounds: deepClone(newBounds)
    });
  }

  uow.on('before', 'commit', 'umlExecutionCascade', commitUmlExecutionCascade);
};

const commitUmlExecutionCascade = (uow: UnitOfWork) => {
  if (uow.metadata.umlExecutionCascadeActive) return;

  const changes = [...(uow.metadata.umlExecutionTransformChanges?.values() ?? [])];
  if (changes.length === 0) return;

  const cascade = new ExecutionCascade(new Set(changes.map(change => change.nodeId)), uow);

  uow.metadata.umlExecutionCascadeActive = true;
  try {
    cascade.run(changes);
  } finally {
    uow.metadata.umlExecutionCascadeActive = false;
    uow.metadata.umlExecutionTransformChanges = undefined;
  }
};

const getFirstAvailableExecutionY = (
  parent: DiagramNode,
  child: DiagramNode,
  topGap = DEFAULT_TOP_GAP
) => {
  const siblings = parent.children
    .filter(isExecutionNode)
    .filter(sibling => sibling.id !== child.id)
    .toSorted((a, b) => a.bounds.y - b.bounds.y);

  let y = parent.bounds.y + topGap;
  for (const sibling of siblings) {
    if (y + child.bounds.h + topGap <= sibling.bounds.y) {
      return y;
    }

    y = Math.max(y, sibling.bounds.y + sibling.bounds.h + topGap);
  }

  return y;
};

export const placeExecutionOnParent = (
  parent: DiagramNode,
  child: DiagramNode,
  uow: UnitOfWork,
  opts?: { assignDefaultY?: boolean }
) => {
  const hasParentLocalBounds =
    child.parent === parent && child.bounds.x < parent.bounds.x && child.bounds.y < parent.bounds.y;
  const currentY = hasParentLocalBounds ? parent.bounds.y + child.bounds.y : child.bounds.y;
  const nextX =
    parent.nodeType === 'umlLifeline'
      ? parent.bounds.x + (parent.bounds.w - child.bounds.w) / 2
      : parent.bounds.x + NEST_OFFSET;
  const nextY = opts?.assignDefaultY ? getFirstAvailableExecutionY(parent, child) : currentY;

  child.setBounds(
    {
      ...child.bounds,
      x: nextX,
      y: nextY
    },
    uow
  );
};

export class UMLLifelineExecutionNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlLifelineExecution', 'UML Lifeline Execution', UMLLifelineExecutionComponent);
    this.setFlags({
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false
    });
  }

  override getAnchors(_node: DiagramNode): Anchor[] {
    return [
      { id: 'tl', start: _p(0, 0), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'bl', start: _p(0, 1), type: 'point', isPrimary: true, normal: Math.PI },
      ...Array.from({ length: RIGHT_ANCHOR_COUNT }, (_, index) => ({
        id: `r${index + 1}`,
        start: _p(1, index / (RIGHT_ANCHOR_COUNT - 1)),
        type: 'point' as const,
        isPrimary: true,
        normal: 0
      }))
    ];
  }

  override onAdd(node: DiagramNode, diagram: DiagramNode['diagram'], uow: UnitOfWork) {
    super.onAdd(node, diagram, uow);
    node.invalidateAnchors(uow);
  }

  override onTransform(
    _transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    newBounds: Box,
    prevBounds: Box,
    uow: UnitOfWork
  ): void {
    super.onTransform(_transforms, node, newBounds, prevBounds, uow);
    if (uow.metadata.umlExecutionCascadeActive) {
      return;
    }

    registerExecutionTransformChange(node, prevBounds, newBounds, uow);
  }

  override onAttachEdge(
    node: DiagramNode,
    _edge: DiagramEdge,
    endpoint: Endpoint,
    context: AttachEdgeContext
  ): Endpoint | undefined {
    if (context.phase !== 'dragEnd') {
      return endpoint;
    }

    if (!(endpoint instanceof PointInNodeEndpoint) || endpoint.node !== node) {
      return endpoint;
    }

    const position = endpoint.position;
    const rotated = Point.rotateAround(position, -node.bounds.r, Box.center(node.bounds));
    const normalizedX = (rotated.x - node.bounds.x) / node.bounds.w;
    const attachToRightSide = normalizedX >= 0.5;
    const ref = attachToRightSide ? _p(1, 0) : _p(0, 0);
    const offset = _p(0, rotated.y - node.bounds.y);

    return new PointInNodeEndpoint(node, ref, offset, 'absolute');
  }

  getCustomPropertyDefinitions(_def: DiagramNode) {
    return new CustomPropertyDefinition(() => []);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    const executions = elements.filter(isExecutionNode);
    if (executions.length === 0) return;

    node.diagram.moveElement(executions, uow, node.layer, {
      relation: 'on',
      element: node
    });

    for (const execution of executions) {
      placeExecutionOnParent(node, execution, uow, { assignDefaultY: true });
    }
  }

  protected layoutChildren(node: DiagramNode, uow: UnitOfWork): void {
    for (const execution of node.children.filter(isExecutionNode)) {
      placeExecutionOnParent(node, execution, uow);
    }
  }
}

class UMLLifelineExecutionComponent extends BaseNodeComponent<UMLLifelineExecutionNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());
    builder.add(renderChildren(this, props.node, props));
  }
}
