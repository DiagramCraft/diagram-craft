import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import {
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
  ConnectedEndpoint,
  Endpoint,
  PointInNodeEndpoint
} from '@diagram-craft/model/endpoint';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import { deepClone } from '@diagram-craft/utils/object';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isSame } from '@diagram-craft/utils/math';

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

export const UML_EXECUTION_DEFAULT_TOP_GAP = 10;
export const UML_EXECUTION_NEST_OFFSET = 8;
const NODE_MIN_HEIGHT = 25;
const RIGHT_CORNER_PADDING = 10;
const RIGHT_ANCHOR_COUNT = 7;

const isExecutionNode = (element: DiagramElement | undefined): element is DiagramNode =>
  !!element && isNode(element) && element.nodeType === 'umlLifelineExecution';

const getExecutionChildren = (node: DiagramNode) => node.children.filter(isExecutionNode);

const isConnected = (e: Endpoint): e is ConnectedEndpoint => e instanceof ConnectedEndpoint;

const isFullyConnected = (edge: DiagramEdge) => isConnected(edge.start) && isConnected(edge.end);

const isRightSideAnchor = (anchorId: string) =>
  /^r\d+$/.test(anchorId) &&
  Number(anchorId.slice(1)) >= 1 &&
  Number(anchorId.slice(1)) <= RIGHT_ANCHOR_COUNT;

const isConnectedToRightSide = (endpoint: ConnectedEndpoint) => {
  if (endpoint instanceof AnchorEndpoint) {
    return isRightSideAnchor(endpoint.anchorId);
  } else if (endpoint instanceof PointInNodeEndpoint) {
    return endpoint.ref?.x === 1 && endpoint.offset.x === 0;
  } else {
    VERIFY_NOT_REACHED();
  }
};

const getNormalizedYForAnchor = (anchorId: string) => {
  if (anchorId === 'tl') return 0;
  if (anchorId === 'bl') return 1;

  assert.true(isRightSideAnchor(anchorId));

  return (Number(anchorId.slice(1)) - 1) / (RIGHT_ANCHOR_COUNT - 1);
};

const getYForEndpoint = (endpoint: ConnectedEndpoint, bounds: Box): number | undefined => {
  if (endpoint instanceof AnchorEndpoint) {
    const normalizedY = getNormalizedYForAnchor(endpoint.anchorId);
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
};

const clampRightSideAnchorWithinBounds = (bounds: Box, targetY: number) =>
  Math.min(
    Math.max(targetY, bounds.y + RIGHT_CORNER_PADDING),
    bounds.y + bounds.h - RIGHT_CORNER_PADDING
  );

const clampDependentHeight = (currentHeight: number, proposedHeight: number) => {
  if (proposedHeight >= currentHeight) {
    return proposedHeight;
  }

  return Math.max(proposedHeight, Math.min(currentHeight, NODE_MIN_HEIGHT));
};

const setRightSideEndpoint = (
  existing: ConnectedEndpoint,
  edge: DiagramEdge,
  targetY: number,
  uow: UnitOfWork
) => {
  const newEndpoint = new PointInNodeEndpoint(
    existing.node,
    _p(1, 0),
    _p(0, targetY - existing.node.bounds.y),
    'absolute'
  );

  if (edge.start === existing) {
    edge.setStart(newEndpoint, uow);
  } else if (edge.end === existing) {
    edge.setEnd(newEndpoint, uow);
  }
};

const getDirectionalEndpointPair = (edge: DiagramEdge, node: DiagramNode) => {
  if (!isConnected(edge.start) || !isConnected(edge.end)) VERIFY_NOT_REACHED();

  if (edge.start.node === node) {
    return { own: edge.start, other: edge.end };
  } else if (edge.end.node === node) {
    return { own: edge.end, other: edge.start };
  } else {
    VERIFY_NOT_REACHED();
  }
};

const adjustRightSideEndpoint = (
  edge: DiagramEdge,
  endpoint: ConnectedEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  const bounds = endpoint.node.bounds;

  const effectiveTargetY = Math.max(targetY, bounds.y + RIGHT_CORNER_PADDING);
  const requiredHeight = Math.max(0.1, effectiveTargetY - bounds.y + RIGHT_CORNER_PADDING);
  if (requiredHeight > bounds.h) {
    endpoint.node.setBounds({ ...bounds, h: requiredHeight }, uow);
  }
  setRightSideEndpoint(endpoint, edge, effectiveTargetY, uow);
  return bounds;
};

const adjustLeftSideEndpoint = (endpoint: AnchorEndpoint, targetY: number, uow: UnitOfWork) => {
  const bounds = endpoint.node.bounds;

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
};

const adjustEndpoint = (
  edge: DiagramEdge,
  endpoint: ConnectedEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  if (isConnectedToRightSide(endpoint)) {
    return adjustRightSideEndpoint(edge, endpoint, targetY, uow);
  } else if (endpoint instanceof AnchorEndpoint) {
    return adjustLeftSideEndpoint(endpoint, targetY, uow);
  } else {
    return undefined;
  }
};

const getAndAdjustTargetY = (edge: DiagramEdge, endpoint: ConnectedEndpoint, uow: UnitOfWork) => {
  const ypos = endpoint.position.y;
  if (isConnectedToRightSide(endpoint)) {
    const adjusted = clampRightSideAnchorWithinBounds(endpoint.node.bounds, ypos);
    if (!isSame(adjusted, ypos)) {
      // Direct transform roots may already use flexible right-side endpoints. If the root shrinks,
      // the endpoint itself may need to slide inward before we compare its previous and current Y.
      setRightSideEndpoint(endpoint, edge, adjusted, uow);
    }
    return adjusted;
  } else {
    return ypos;
  }
};

const cascadeExecutionResize = (
  currentNode: DiagramNode,
  transformRoots: Set<string>,
  adjusted: Set<string>,
  uow: UnitOfWork,
  path: Set<string>,
  previousBounds: Box
) => {
  let currentPreviousBounds = previousBounds;
  const isCurrentNodeRoot = transformRoots.has(currentNode.id);
  for (const edge of currentNode.edges) {
    if (!isFullyConnected(edge)) continue;

    const { own, other } = getDirectionalEndpointPair(edge, currentNode);
    if (!isExecutionNode(own.node) || !isExecutionNode(other.node)) continue;

    const previousAnchorY = getYForEndpoint(own, currentPreviousBounds);
    const targetY = getAndAdjustTargetY(edge, own, uow);
    if (previousAnchorY !== undefined && isSame(previousAnchorY, targetY)) continue;

    const skipBecauseOtherAdjusted = adjusted.has(other.node.id);
    const skipBecauseOtherPath = path.has(other.node.id);
    const skipBecauseOtherIsRoot = transformRoots.has(other.node.id);

    if (
      !isCurrentNodeRoot &&
      isConnectedToRightSide(own) &&
      (skipBecauseOtherAdjusted || skipBecauseOtherPath)
    ) {
      const currentNodePreviousBounds = adjustEndpoint(edge, own, other.position.y, uow);
      if (currentNodePreviousBounds) {
        currentPreviousBounds = currentNodePreviousBounds;
      }
      continue;
    }

    if (skipBecauseOtherIsRoot) {
      continue;
    }

    if (skipBecauseOtherAdjusted || skipBecauseOtherPath) {
      adjustEndpoint(edge, other, targetY, uow);
      continue;
    }

    const dependentPreviousBounds = adjustEndpoint(edge, other, targetY, uow);
    if (!dependentPreviousBounds) {
      continue;
    }

    path.add(other.node.id);
    adjusted.add(other.node.id);
    cascadeExecutionResize(
      other.node,
      transformRoots,
      adjusted,
      uow,
      path,
      dependentPreviousBounds
    );
    path.delete(other.node.id);
  }
};

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

  const transformRoots = new Set(changes.map(change => change.nodeId));
  const adjusted = new Set<string>();

  uow.metadata.umlExecutionCascadeActive = true;
  try {
    for (const change of changes) {
      const node = uow.diagram.lookup(change.nodeId);
      if (!isExecutionNode(node)) continue;

      adjusted.add(node.id);
      cascadeExecutionResize(
        node,
        transformRoots,
        adjusted,
        uow,
        new Set([node.id]),
        change.prevBounds
      );
    }
  } finally {
    uow.metadata.umlExecutionCascadeActive = false;
    uow.metadata.umlExecutionTransformChanges = undefined;
  }
};

const getFirstAvailableExecutionY = (
  parent: DiagramNode,
  child: DiagramNode,
  topGap = UML_EXECUTION_DEFAULT_TOP_GAP
) => {
  const siblings = getExecutionChildren(parent)
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
  const currentY =
    child.parent === parent && child.bounds.y < parent.bounds.y
      ? parent.bounds.y + child.bounds.y
      : child.bounds.y;
  const nextX =
    parent.nodeType === 'umlLifeline'
      ? parent.bounds.x + (parent.bounds.w - child.bounds.w) / 2
      : parent.bounds.x + UML_EXECUTION_NEST_OFFSET;
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
      { id: 'r1', start: _p(1, 0 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r2', start: _p(1, 1 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r3', start: _p(1, 2 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r4', start: _p(1, 3 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r5', start: _p(1, 4 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r6', start: _p(1, 5 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r7', start: _p(1, 6 / 6), type: 'point', isPrimary: true, normal: 0 }
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
    for (const execution of getExecutionChildren(node)) {
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
