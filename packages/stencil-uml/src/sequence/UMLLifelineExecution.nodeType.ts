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
import { Point, _p } from '@diagram-craft/geometry/point';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Anchor } from '@diagram-craft/model/anchor';
import { AnchorEndpoint, PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box } from '@diagram-craft/geometry/box';
import { Transform } from '@diagram-craft/geometry/transform';
import { deepClone } from '@diagram-craft/utils/object';

declare global {
  namespace DiagramCraft {
    interface UMLExecutionTransformChange {
      nodeId: string;
      prevBounds: Box;
      newBounds: Box;
    }

    interface UnitOfWorkMetadata {
      umlExecutionTransformChanges?: Map<string, UMLExecutionTransformChange>;
      umlExecutionCascadeActive?: boolean;
    }
  }
}

export const UML_EXECUTION_DEFAULT_TOP_GAP = 10;
export const UML_EXECUTION_NEST_OFFSET = 8;
const UML_EXECUTION_MIN_HEIGHT = 25;
const UML_EXECUTION_RIGHT_SIDE_CORNER_PADDING = 10;

const isExecutionNode = (element: DiagramElement): element is DiagramNode =>
  isNode(element) && element.nodeType === 'umlLifelineExecution';

const getExecutionChildren = (node: DiagramNode) => node.children.filter(isExecutionNode);

const getExecutionAnchorY = (anchorId: string) => {
  if (anchorId === 'tl') return 0;
  if (anchorId === 'bl') return 1;

  const match = /^r([1-7])$/.exec(anchorId);
  if (!match) return undefined;

  return (Number(match[1]) - 1) / 6;
};

const isRightExecutionAnchor = (anchorId: string) => /^r[1-7]$/.test(anchorId);

const getEndpointYForBounds = (
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  bounds: Box
): number | undefined => {
  if (endpoint instanceof AnchorEndpoint) {
    const normalizedY = getExecutionAnchorY(endpoint.anchorId);
    if (normalizedY === undefined) return undefined;
    return bounds.y + bounds.h * normalizedY;
  }

  if (endpoint.ref) {
    const refY = bounds.y + endpoint.ref.y * bounds.h;
    const offsetY =
      endpoint.offsetType === 'absolute' ? endpoint.offset.y : endpoint.offset.y * bounds.h;
    return refY + offsetY;
  }

  return undefined;
};

const isPureHorizontalMove = (newBounds: Box, prevBounds: Box) =>
  newBounds.x !== prevBounds.x &&
  newBounds.y === prevBounds.y &&
  newBounds.w === prevBounds.w &&
  newBounds.h === prevBounds.h &&
  newBounds.r === prevBounds.r;

const isSupportedExecutionEndpoint = (
  endpoint: DiagramEdge['start']
): endpoint is AnchorEndpoint | PointInNodeEndpoint =>
  endpoint instanceof AnchorEndpoint || endpoint instanceof PointInNodeEndpoint;

const isFlexibleRightSideEndpoint = (endpoint: AnchorEndpoint | PointInNodeEndpoint) => {
  if (endpoint instanceof AnchorEndpoint) {
    return isRightExecutionAnchor(endpoint.anchorId);
  }

  return endpoint.ref?.x === 1 && endpoint.offset.x === 0;
};

const clampFlexibleRightSideYWithinBounds = (bounds: Box, targetY: number) =>
  Math.min(
    Math.max(targetY, bounds.y + UML_EXECUTION_RIGHT_SIDE_CORNER_PADDING),
    bounds.y + bounds.h - UML_EXECUTION_RIGHT_SIDE_CORNER_PADDING
  );

const clampDependentHeight = (currentHeight: number, proposedHeight: number) => {
  if (proposedHeight >= currentHeight) {
    return proposedHeight;
  }

  return Math.max(proposedHeight, Math.min(currentHeight, UML_EXECUTION_MIN_HEIGHT));
};

const setFlexibleRightSideEndpoint = (
  edge: DiagramEdge,
  endpointNode: DiagramNode,
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  const nextEndpoint = new PointInNodeEndpoint(
    endpointNode,
    _p(1, 0),
    _p(0, targetY - endpointNode.bounds.y),
    'absolute'
  );

  if (edge.start === endpoint) {
    edge.setStart(nextEndpoint, uow);
  } else if (edge.end === endpoint) {
    edge.setEnd(nextEndpoint, uow);
  }
};

const getLinkedExecutionEndpoint = (edge: DiagramEdge, node: DiagramNode) => {
  if (!isSupportedExecutionEndpoint(edge.start) || !isSupportedExecutionEndpoint(edge.end)) {
    return;
  }
  if (!isExecutionNode(edge.start.node) || !isExecutionNode(edge.end.node)) {
    return;
  }

  if (edge.start.node === node) {
    return {
      ownEndpoint: edge.start,
      otherEndpoint: edge.end,
      otherNode: edge.end.node
    };
  }

  if (edge.end.node === node) {
    return {
      ownEndpoint: edge.end,
      otherEndpoint: edge.start,
      otherNode: edge.start.node
    };
  }
  return undefined;
};

const retargetFlexibleRightSideEndpoint = (
  edge: DiagramEdge,
  node: DiagramNode,
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  const previousBounds = node.bounds;
  if (isFlexibleRightSideEndpoint(endpoint)) {
    const effectiveTargetY = Math.max(
      targetY,
      node.bounds.y + UML_EXECUTION_RIGHT_SIDE_CORNER_PADDING
    );
    const requiredHeight = Math.max(
      0.1,
      effectiveTargetY - node.bounds.y + UML_EXECUTION_RIGHT_SIDE_CORNER_PADDING
    );
    if (requiredHeight > node.bounds.h) {
      node.setBounds(
        {
          ...node.bounds,
          h: requiredHeight
        },
        uow
      );
    }
    setFlexibleRightSideEndpoint(edge, node, endpoint, effectiveTargetY, uow);
    return previousBounds;
  }
  return undefined;
};

const resizeExecutionFromAnchor = (
  node: DiagramNode,
  endpoint: AnchorEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  const previousBounds = node.bounds;
  if (!(endpoint instanceof AnchorEndpoint)) {
    return undefined;
  }

  const normalizedY = getExecutionAnchorY(endpoint.anchorId);
  if (normalizedY === undefined) {
    return undefined;
  }

  if (endpoint.anchorId === 'tl') {
    const bottom = node.bounds.y + node.bounds.h;
    const nextHeight = clampDependentHeight(node.bounds.h, bottom - targetY);
    const nextY = bottom - nextHeight;

    node.setBounds(
      {
        ...node.bounds,
        y: nextY,
        h: nextHeight
      },
      uow
    );
    return previousBounds;
  }

  const nextHeight = clampDependentHeight(node.bounds.h, (targetY - node.bounds.y) / normalizedY);
  node.setBounds(
    {
      ...node.bounds,
      h: nextHeight
    },
    uow
  );
  return previousBounds;
};

const resizeExecutionForEndpoint = (
  edge: DiagramEdge,
  node: DiagramNode,
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  return (
    retargetFlexibleRightSideEndpoint(edge, node, endpoint, targetY, uow) ??
    (endpoint instanceof AnchorEndpoint
      ? resizeExecutionFromAnchor(node, endpoint, targetY, uow)
      : undefined)
  );
};

const getAdjustedTargetY = (
  edge: DiagramEdge,
  node: DiagramNode,
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  uow: UnitOfWork
) => {
  const rawTargetY = endpoint.position.y;
  if (!isFlexibleRightSideEndpoint(endpoint)) {
    return rawTargetY;
  }

  const adjustedTargetY = clampFlexibleRightSideYWithinBounds(node.bounds, rawTargetY);
  if (adjustedTargetY !== rawTargetY) {
    setFlexibleRightSideEndpoint(edge, node, endpoint, adjustedTargetY, uow);
  }
  return adjustedTargetY;
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
    const linked = getLinkedExecutionEndpoint(edge, currentNode);
    if (!linked) {
      continue;
    }

    const previousAnchorY = getEndpointYForBounds(linked.ownEndpoint, currentPreviousBounds);
    const targetY = getAdjustedTargetY(edge, currentNode, linked.ownEndpoint, uow);
    if (previousAnchorY === targetY) {
      continue;
    }

    const skipBecauseOtherAdjusted = adjusted.has(linked.otherNode.id);
    const skipBecausePath = path.has(linked.otherNode.id);
    const skipBecauseOtherIsRoot = transformRoots.has(linked.otherNode.id);

    if (
      !isCurrentNodeRoot &&
      isFlexibleRightSideEndpoint(linked.ownEndpoint) &&
      (skipBecauseOtherAdjusted || skipBecausePath)
    ) {
      const currentNodePreviousBounds = resizeExecutionForEndpoint(
        edge,
        currentNode,
        linked.ownEndpoint,
        linked.otherEndpoint.position.y,
        uow
      );
      if (currentNodePreviousBounds) {
        currentPreviousBounds = currentNodePreviousBounds;
      }
      continue;
    }

    if (skipBecauseOtherIsRoot) {
      continue;
    }

    if (skipBecauseOtherAdjusted || skipBecausePath) {
      resizeExecutionForEndpoint(edge, linked.otherNode, linked.otherEndpoint, targetY, uow);
      continue;
    }

    const dependentPreviousBounds = resizeExecutionForEndpoint(
      edge,
      linked.otherNode,
      linked.otherEndpoint,
      targetY,
      uow
    );
    if (!dependentPreviousBounds) {
      continue;
    }

    path.add(linked.otherNode.id);
    adjusted.add(linked.otherNode.id);
    cascadeExecutionResize(linked.otherNode, transformRoots, adjusted, uow, path, dependentPreviousBounds);
    path.delete(linked.otherNode.id);
  }
};

const registerExecutionTransformChange = (
  node: DiagramNode,
  prevBounds: Box,
  newBounds: Box,
  uow: UnitOfWork
) => {
  if (Box.isEqual(prevBounds, newBounds)) {
    return;
  }

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
  if (uow.metadata.umlExecutionCascadeActive) {
    return;
  }

  const changes = [...(uow.metadata.umlExecutionTransformChanges?.values() ?? [])].filter(
    change => !isPureHorizontalMove(change.newBounds, change.prevBounds)
  );
  if (changes.length === 0) {
    return;
  }

  const transformRoots = new Set(changes.map(change => change.nodeId));
  const previousActive = uow.metadata.umlExecutionCascadeActive;
  uow.metadata.umlExecutionCascadeActive = true;
  const adjusted = new Set<string>();

  try {
    for (const change of changes) {
      const node = uow.diagram.lookup(change.nodeId);
      if (!node || !isExecutionNode(node)) {
        continue;
      }

      adjusted.add(node.id);
      cascadeExecutionResize(node, transformRoots, adjusted, uow, new Set([node.id]), change.prevBounds);
    }
  } finally {
    uow.metadata.umlExecutionCascadeActive = previousActive;
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
