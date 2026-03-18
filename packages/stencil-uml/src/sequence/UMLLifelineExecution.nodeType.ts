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
      umlExecutionCascadeAdjusted?: Set<string>;
      umlExecutionCascadeActive?: boolean;
      umlExecutionCascadeRegistered?: boolean;
    }
  }
}

export const UML_EXECUTION_DEFAULT_WIDTH = 10;
export const UML_EXECUTION_DEFAULT_HEIGHT = 40;
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

const setEdgeEndpoint = (
  edge: DiagramEdge,
  endpointNode: DiagramNode,
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  if (!isFlexibleRightSideEndpoint(endpoint)) return;

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
    console.log('skip edge: endpoints are not anchor endpoints', {
      edgeId: edge.id,
      nodeId: node.id,
      startEndpointType: edge.start.constructor.name,
      endEndpointType: edge.end.constructor.name
    });
    return;
  }
  if (!isExecutionNode(edge.start.node) || !isExecutionNode(edge.end.node)) {
    console.log('skip edge: endpoints are not both execution nodes', {
      edgeId: edge.id,
      nodeId: node.id,
      startNodeId: edge.start.node.id,
      startNodeType: edge.start.node.nodeType,
      endNodeId: edge.end.node.id,
      endNodeType: edge.end.node.nodeType
    });
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

  console.log('skip edge: current node is not attached to edge endpoint', {
    edgeId: edge.id,
    nodeId: node.id,
    startNodeId: edge.start.node.id,
    endNodeId: edge.end.node.id
  });
};

const resizeExecutionForEndpoint = (
  edge: DiagramEdge,
  node: DiagramNode,
  endpoint: AnchorEndpoint | PointInNodeEndpoint,
  targetY: number,
  uow: UnitOfWork
) => {
  const previousBounds = node.bounds;
  console.log('resize for endpoint', {
    edgeId: edge.id,
    nodeId: node.id,
    endpoint:
      endpoint instanceof AnchorEndpoint
        ? endpoint.anchorId
        : endpoint.ref?.x === 1
          ? 'right-point'
          : 'point',
    targetY,
    previousBounds
  });
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
    setEdgeEndpoint(edge, node, endpoint, effectiveTargetY, uow);
    return previousBounds;
  }

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

  if (normalizedY === 0) {
    return undefined;
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

const cascadeExecutionResize = (
  currentNode: DiagramNode,
  transformRoots: Set<string>,
  uow: UnitOfWork,
  path: Set<string>,
  previousBounds: Box
) => {
  let currentPreviousBounds = previousBounds;
  console.log('process', currentNode.id, {
    edgeCount: currentNode.edges.length,
    previousBounds: currentPreviousBounds,
    currentBounds: currentNode.bounds
  });
  for (const edge of currentNode.edges) {
    const linked = getLinkedExecutionEndpoint(edge, currentNode);
    if (!linked) {
      continue;
    }

    const previousAnchorY = getEndpointYForBounds(linked.ownEndpoint, currentPreviousBounds);
    const unclampedTargetY = linked.ownEndpoint.position.y;
    const targetY = isFlexibleRightSideEndpoint(linked.ownEndpoint)
      ? clampFlexibleRightSideYWithinBounds(currentNode.bounds, unclampedTargetY)
      : unclampedTargetY;
    if (targetY !== unclampedTargetY) {
      setEdgeEndpoint(edge, currentNode, linked.ownEndpoint, targetY, uow);
    }
    console.log('consider edge', {
      edgeId: edge.id,
      nodeId: currentNode.id,
      otherNodeId: linked.otherNode.id,
      ownAnchorId:
        linked.ownEndpoint instanceof AnchorEndpoint ? linked.ownEndpoint.anchorId : 'right-point',
      otherEndpointType:
        linked.otherEndpoint instanceof AnchorEndpoint ? linked.otherEndpoint.anchorId : 'right-point',
      previousAnchorY,
      targetY
    });
    if (previousAnchorY === targetY) {
      console.log('skip edge: own anchor did not move', {
        edgeId: edge.id,
        nodeId: currentNode.id,
        ownAnchorId:
          linked.ownEndpoint instanceof AnchorEndpoint ? linked.ownEndpoint.anchorId : 'right-point',
        previousAnchorY,
        targetY
      });
      continue;
    }

    const skipBecauseBothRoots =
      transformRoots.size > 1 && transformRoots.has(linked.otherNode.id);
    const skipBecauseOtherAdjusted =
      uow.metadata.umlExecutionCascadeAdjusted?.has(linked.otherNode.id) ?? false;
    const skipBecausePath = path.has(linked.otherNode.id);
    const skipBecauseOtherIsRoot = transformRoots.has(linked.otherNode.id);

    if (
      !transformRoots.has(currentNode.id) &&
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
      console.log('skip edge: other node is a direct transform root', {
        edgeId: edge.id,
        nodeId: currentNode.id,
        otherNodeId: linked.otherNode.id
      });
      continue;
    }

    if (!skipBecauseBothRoots && (skipBecauseOtherAdjusted || skipBecausePath)) {
      console.log('resize already-adjusted dependent', {
        edgeId: edge.id,
        nodeId: currentNode.id,
        otherNodeId: linked.otherNode.id,
        targetY,
        skipBecauseOtherAdjusted,
        skipBecausePath
      });
      resizeExecutionForEndpoint(edge, linked.otherNode, linked.otherEndpoint, targetY, uow);
      continue;
    }

    if (skipBecauseBothRoots) {
      console.log('skip edge: both nodes are roots', {
        edgeId: edge.id,
        nodeId: currentNode.id,
        otherNodeId: linked.otherNode.id
      });
      continue;
    }
    if (skipBecauseOtherAdjusted) {
      console.log('skip edge: other node already adjusted', {
        edgeId: edge.id,
        nodeId: currentNode.id,
        otherNodeId: linked.otherNode.id
      });
      continue;
    }
    if (skipBecausePath) {
      console.log('skip edge: other node already in recursion path', {
        edgeId: edge.id,
        nodeId: currentNode.id,
        otherNodeId: linked.otherNode.id
      });
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
    uow.metadata.umlExecutionCascadeAdjusted?.add(linked.otherNode.id);
    cascadeExecutionResize(linked.otherNode, transformRoots, uow, path, dependentPreviousBounds);
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

  if (uow.metadata.umlExecutionCascadeRegistered) {
    return;
  }

  uow.metadata.umlExecutionCascadeRegistered = true;
  uow.on('before', 'commit', 'umlExecutionCascade', commitUmlExecutionCascade);
};

const commitUmlExecutionCascade = (uow: UnitOfWork) => {
  if (uow.metadata.umlExecutionCascadeActive) {
    console.log('skip commit hook: cascade already active');
    return;
  }

  const changes = [...(uow.metadata.umlExecutionTransformChanges?.values() ?? [])].filter(
    change => !isPureHorizontalMove(change.newBounds, change.prevBounds)
  );
  if (changes.length === 0) {
    console.log('skip commit hook: no relevant transform changes');
    return;
  }

  const transformRoots = new Set(changes.map(change => change.nodeId));
  console.log('start commit-phase cascade', [...transformRoots].join(', '));
  const previousActive = uow.metadata.umlExecutionCascadeActive;
  const previousAdjusted = uow.metadata.umlExecutionCascadeAdjusted;
  uow.metadata.umlExecutionCascadeActive = true;
  uow.metadata.umlExecutionCascadeAdjusted = new Set();

  try {
    for (const change of changes) {
      const node = uow.diagram.lookup(change.nodeId);
      if (!node || !isExecutionNode(node)) {
        console.log('skip root: node missing or no longer an execution', {
          nodeId: change.nodeId
        });
        continue;
      }

      uow.metadata.umlExecutionCascadeAdjusted.add(node.id);
      console.log('cascade from root', {
        nodeId: node.id,
        bounds: node.bounds
      });
      cascadeExecutionResize(node, transformRoots, uow, new Set([node.id]), change.prevBounds);
    }
  } finally {
    console.log('finish commit-phase cascade');
    uow.metadata.umlExecutionCascadeActive = previousActive;
    uow.metadata.umlExecutionCascadeAdjusted = previousAdjusted;
    uow.metadata.umlExecutionTransformChanges = undefined;
    uow.metadata.umlExecutionCascadeRegistered = false;
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
    console.log(Box.toString(prevBounds), Box.toString(newBounds));

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
