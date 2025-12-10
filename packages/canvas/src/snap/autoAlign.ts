import { Magnet, type MagnetType } from './magnet';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Axis } from '@diagram-craft/geometry/axis';
import type { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { GridSnapProvider } from './gridSnapProvider';
import { NodeSnapProvider } from './nodeSnapProvider';
import { GuidesSnapProvider } from './guidesSnapProvider';
import { CanvasSnapProvider } from './canvasSnapProvider';
import { NodeDistanceSnapProvider } from './nodeDistanceSnapProvider';
import { NodeSizeSnapProvider } from './nodeSizeSnapProvider';
import type { SnapProvider } from './snapManager';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { smallest } from '@diagram-craft/utils/array';
import { Direction } from '@diagram-craft/geometry/direction';

export type AutoAlignMode = 'move' | 'resize' | 'both' | 'none';

export type AutoAlignConfig = {
  threshold: number;
  magnetTypes: MagnetType[];
  mode: AutoAlignMode;
};

type MatchingMagnetPair = {
  self: Magnet;
  matching: Magnet;
  distance: number;
};

const MAX_ITERATIONS = 3;

/**
 * This adds all fixed magnets, i.e. the ones not affected by nodes that
 * are moved/resized by the auto align algorithm.
 *
 * Please note that eligibleNodePredicate ensures only nodes *not* part
 * of the selection are considered.
 */
const getFixedMagnets = (
  diagram: Diagram,
  magnetTypes: MagnetType[],
  eligibleNodePredicate: (id: string) => boolean
): ReadonlyArray<Magnet> => {
  const viewportBox = { ...diagram.bounds, r: 0 };
  const magnets: Magnet[] = [];

  for (const type of magnetTypes) {
    // biome-ignore lint/suspicious/noExplicitAny: correct
    let provider: SnapProvider<any>;
    switch (type) {
      case 'grid':
        provider = new GridSnapProvider(diagram);
        break;
      case 'node':
        provider = new NodeSnapProvider(diagram, eligibleNodePredicate);
        break;
      case 'guide':
        provider = new GuidesSnapProvider(diagram);
        break;
      case 'canvas':
        provider = new CanvasSnapProvider(diagram);
        break;
      case 'distance':
        provider = new NodeDistanceSnapProvider(diagram, eligibleNodePredicate);
        break;
      case 'size':
        provider = new NodeSizeSnapProvider(diagram, eligibleNodePredicate);
        break;
      default:
        continue;
    }
    magnets.push(...provider.getMagnets(viewportBox));
  }

  return magnets;
};

const sortByArea = (nodes: DiagramNode[]): DiagramNode[] => {
  return nodes.toSorted((a, b) => Box.area(a.bounds) - Box.area(b.bounds));
};

const align = (
  nodes: DiagramNode[],
  fixedMagnets: ReadonlyArray<Magnet>,
  threshold: number,
  mode: 'move' | 'resize',
  uow: UnitOfWork
): number => {
  let movedCount = 0;
  const dynamicMagnets: Magnet[] = [];

  for (const node of nodes) {
    // Combine all magnets but exclude the current node's own magnets
    const allTargetMagnets = [...fixedMagnets, ...dynamicMagnets].filter(m => {
      if (m.type === 'node' || m.type === 'size') {
        return m.node.id !== node.id;
      }
      return true;
    });

    // Find alignments within the threshold
    const sourceMagnets = Magnet.forNode(node.bounds);
    const matches = matchMagnets(sourceMagnets, allTargetMagnets, threshold);

    if (matches.length === 0) {
      dynamicMagnets.push(...sourceMagnets);
      continue;
    }

    const newBounds =
      mode === 'move'
        ? calculateAlignedBounds(node.bounds, matches)
        : calculateResizedBounds(node.bounds, matches);

    // Update if position or size changed
    if (!Box.isEqual(node.bounds, newBounds)) {
      node.setBounds(newBounds, uow);
      movedCount++;
      dynamicMagnets.push(...Magnet.forNode(newBounds));
    } else {
      dynamicMagnets.push(...sourceMagnets);
    }
  }

  return movedCount;
};

const matchMagnets = (
  sourceMagnets: ReadonlyArray<Magnet>,
  targetMagnets: ReadonlyArray<Magnet>,
  threshold: number
): MatchingMagnetPair[] => {
  const matches: MatchingMagnetPair[] = [];

  for (const target of targetMagnets) {
    for (const source of sourceMagnets) {
      if (target.axis !== source.axis) continue;
      if (target.respectDirection && target.matchDirection !== source.matchDirection) {
        continue;
      }

      const axis = Axis.toXY(Axis.orthogonal(source.axis));
      const distance = source.line.from[axis] - target.line.from[axis];

      if (Math.abs(distance) <= threshold) {
        matches.push({ self: source, matching: target, distance });
      }
    }
  }

  return matches;
};

/**
 * Calculate new bounds by moving the element to align with magnets.
 * Finds the closest match for each axis (horizontal and vertical) and moves
 * the entire element by that distance.
 */
const calculateAlignedBounds = (
  originalBounds: Box,
  matchingMagnets: MatchingMagnetPair[]
): Box => {
  const newBounds = Box.asReadWrite(originalBounds);

  // Horizontal axis (left/center/right)
  const hMatches = matchingMagnets.filter(m => m.self.axis === Axis.v);
  const closestH = smallest(hMatches, (a, b) => Math.abs(a.distance) - Math.abs(b.distance));
  if (closestH) {
    newBounds.x -= closestH.distance;
  }

  // Vertical axis (top/center/bottom)
  const vMatches = matchingMagnets.filter(m => m.self.axis === Axis.h);
  const closestV = smallest(vMatches, (a, b) => Math.abs(a.distance) - Math.abs(b.distance));
  if (closestV) {
    newBounds.y -= closestV.distance;
  }

  return WritableBox.asBox(newBounds);
};

/**
 * Calculate new bounds by resizing the element to align edges with magnets.
 * Processes edges in priority order (left, top, right, bottom) and aligns
 * the FIRST edge found within the threshold.
 */
const calculateResizedBounds = (
  originalBounds: Box,
  matchingMagnets: MatchingMagnetPair[]
): Box => {
  const newBounds = Box.asReadWrite(originalBounds);

  // Find matches for each edge
  const edgeMatches = new Map<string, MatchingMagnetPair>();
  for (const match of matchingMagnets) {
    const sourceMagnet = match.self;
    const direction = sourceMagnet.matchDirection;
    if (direction) {
      const existing = edgeMatches.get(direction);
      if (!existing || Math.abs(match.distance) < Math.abs(existing.distance)) {
        edgeMatches.set(direction, match);
      }
    }
  }

  // Process edges in order: left, top, right, bottom
  // Apply only the FIRST matching edge found
  const edgeOrder = Direction.all();
  for (const direction of edgeOrder) {
    const match = edgeMatches.get(direction);
    if (!match) continue;

    const distance = match.distance;

    switch (direction) {
      case 'w': // Left edge
        newBounds.x -= distance;
        newBounds.w += distance;
        return WritableBox.asBox(newBounds);
      case 'n': // Top edge
        newBounds.y -= distance;
        newBounds.h += distance;
        return WritableBox.asBox(newBounds);
      case 'e': // Right edge
        newBounds.w -= distance;
        return WritableBox.asBox(newBounds);
      case 's': // Bottom edge
        newBounds.h -= distance;
        return WritableBox.asBox(newBounds);
    }
  }

  return WritableBox.asBox(newBounds);
};

/**
 * Auto-align diagram nodes based on snap magnets
 * @param nodes - Nodes to align (will be sorted by area internally)
 * @param diagram - The diagram containing the nodes
 * @param config - Alignment configuration
 * @param uow - Unit of work for tracking changes
 */
export const autoAlign = (
  nodes: Array<DiagramNode>,
  diagram: Diagram,
  config: AutoAlignConfig,
  uow: UnitOfWork
) => {
  if (config.mode === 'none' || nodes.length === 0) return;

  const selectedIds = new Set(nodes.map(n => n.id));
  const sortedNodes = sortByArea(nodes);

  // Create magnets from NON-SELECTED elements only
  const eligibleNodePredicate = (id: string) => !selectedIds.has(id);
  const fixedMagnets = getFixedMagnets(diagram, config.magnetTypes, eligibleNodePredicate);

  switch (config.mode) {
    case 'both':
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const moves = align(sortedNodes, fixedMagnets, config.threshold, 'resize', uow);
        const changes = align(sortedNodes, fixedMagnets, config.threshold, 'move', uow);
        if (moves === 0 && changes === 0) break;
      }
      break;
    case 'move':
    case 'resize':
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const changes = align(sortedNodes, fixedMagnets, config.threshold, config.mode, uow);
        if (changes === 0) break;
      }
      break;
    default:
      VERIFY_NOT_REACHED();
  }

  return;
};
