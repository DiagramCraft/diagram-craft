import { Box } from '@diagram-craft/geometry/box';
import type { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { isNode } from '@diagram-craft/model/diagramElement';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { assert } from '@diagram-craft/utils/assert';

export type PlaceNodeOptions = {
  considerAllLayers?: boolean;
  minDistance?: number;
};

const DEFAULT_MIN_DISTANCE = 10;
const SEARCH_STEP = 20;
const MAX_SEARCH_DISTANCE = 2000;
const DIRECTIONS = [
  { x: 1, y: 0 }, // E
  { x: 1, y: -1 }, // NE
  { x: 0, y: -1 }, // N
  { x: -1, y: -1 }, // NW
  { x: -1, y: 0 }, // W
  { x: -1, y: 1 }, // SW
  { x: 0, y: 1 }, // S
  { x: 1, y: 1 } // SE
];

const getNodesToCheck = (diagram: Diagram, considerAllLayers: boolean) => {
  if (considerAllLayers) {
    return diagram.visibleElements().filter(isNode);
  } else {
    const resolved = diagram.activeLayer?.resolve();
    if (!resolved || !isRegularLayer(resolved)) return [];

    return resolved.elements.filter(isNode);
  }
};

const hasOverlap = (candidateBounds: Box, nodes: DiagramNode[], minDistance: number) => {
  return nodes.some(node => Box.intersects(Box.grow(candidateBounds, minDistance), node.bounds));
};

/**
 * Finds a suitable position for a new node near a reference node without overlaps
 *
 * @param bounds - The bounds of the node to place (x, y will be adjusted, w, h, r preserved)
 * @param referenceNode - The node to use as a reference point for placement (prefer close to this node)
 * @param diagram - The diagram containing the nodes
 * @param options - Configuration options
 * @returns A new Box with adjusted position that doesn't overlap existing nodes
 */
export const placeNode = (
  bounds: Box,
  referenceNode: DiagramNode,
  diagram: Diagram,
  options?: PlaceNodeOptions
): Box => {
  const considerAllLayers = options?.considerAllLayers ?? false;
  const minDistance = options?.minDistance ?? DEFAULT_MIN_DISTANCE;

  const nodes = getNodesToCheck(diagram, considerAllLayers);
  assert.true(nodes.includes(referenceNode));

  const referenceCenter = Box.center(referenceNode.bounds);

  // Start by trying the reference position offset to the right
  const initialOffset = referenceNode.bounds.w / 2 + bounds.w / 2 + minDistance;
  const initialCandidate = {
    ...bounds,
    x: referenceCenter.x + initialOffset - bounds.w / 2,
    y: referenceCenter.y - bounds.h / 2
  };

  if (!hasOverlap(initialCandidate, nodes, minDistance)) {
    return initialCandidate;
  }

  // Spiral search outward from the reference point
  for (let distance = SEARCH_STEP; distance <= MAX_SEARCH_DISTANCE; distance += SEARCH_STEP) {
    for (const direction of DIRECTIONS) {
      const offset = { x: direction.x * distance, y: direction.y * distance };

      const candidate: Box = {
        ...bounds,
        x: referenceCenter.x + offset.x - bounds.w / 2,
        y: referenceCenter.y + offset.y - bounds.h / 2
      };

      if (!hasOverlap(candidate, nodes, minDistance)) {
        return candidate;
      }
    }
  }

  // If no position found, return the initial candidate
  return initialCandidate;
};
