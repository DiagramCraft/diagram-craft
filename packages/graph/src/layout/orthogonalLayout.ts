import type { Point } from '@diagram-craft/geometry/point';
import type { Graph } from '../graph';
import { getConnectedComponent } from '../connectivity';

/**
 * Layout options for orthogonal graph layout algorithm
 */
export type OrthogonalLayoutOptions = {
  /** Grid spacing between nodes (default: 1) */
  gridSpacing?: number;
  /** Direction of the layout (default: 'down') */
  direction?: 'down' | 'up' | 'left' | 'right';
};

/**
 * A node in the planarized graph representation.
 * Can be either an original vertex or a dummy node inserted at edge crossings.
 */
type PlanarNode<VK> = {
  /** Unique identifier (original vertex ID or generated dummy ID) */
  id: VK | string;
  /** Original vertex ID if this is a real node */
  originalVertex?: VK;
  /** True if this is a dummy node inserted for planarization */
  isDummy: boolean;
};

/**
 * An edge in the planarized graph.
 * Long edges may be split into multiple segments through dummy nodes.
 */
type PlanarEdge<VK> = {
  /** Source node ID */
  from: VK | string;
  /** Target node ID */
  to: VK | string;
  /** Original edge if this is part of a split edge */
  originalEdge?: { from: VK; to: VK };
};

/**
 * A planarized graph representation with dummy nodes.
 */
type PlanarGraph<VK> = {
  /** All nodes (original and dummy) */
  nodes: Map<VK | string, PlanarNode<VK>>;
  /** All edges (including split segments) */
  edges: PlanarEdge<VK>[];
};

/**
 * Position on a 2D grid.
 */
type GridPosition = {
  /** Row index */
  row: number;
  /** Column index */
  col: number;
};

/**
 * An orthogonal shape representation mapping nodes to grid positions.
 */
type OrthogonalShape<VK> = {
  /** Map from node IDs to their grid positions */
  nodes: Map<VK | string, GridPosition>;
  /** Total width in grid units */
  width: number;
  /** Total height in grid units */
  height: number;
};

/**
 * Converts a graph to a planarized representation.
 * For the MVP, we use a simplified approach that doesn't insert dummy nodes
 * at crossings but prepares the structure for orthogonal layout.
 *
 * @param graph - The input graph
 * @param vertexIds - The vertex IDs in the connected component
 * @returns A planarized graph representation
 */
const planarize = <V, E, VK, EK>(graph: Graph<V, E, VK, EK>, vertexIds: VK[]): PlanarGraph<VK> => {
  const nodes = new Map<VK | string, PlanarNode<VK>>();
  const edges: PlanarEdge<VK>[] = [];

  // Create nodes for all vertices
  for (const vertexId of vertexIds) {
    nodes.set(vertexId, {
      id: vertexId,
      originalVertex: vertexId,
      isDummy: false
    });
  }

  // Add all edges in the connected component
  const vertexIdSet = new Set(vertexIds);
  for (const edge of graph.edges()) {
    if (edge.disabled) continue;

    // Only include edges where both endpoints are in the component
    if (vertexIdSet.has(edge.from) && vertexIdSet.has(edge.to)) {
      edges.push({
        from: edge.from,
        to: edge.to,
        originalEdge: { from: edge.from, to: edge.to }
      });
    }
  }

  return { nodes, edges };
};

/**
 * Assigns layers to nodes using a BFS-based approach.
 * Similar to the layered layout but adapted for orthogonal placement.
 */
const assignLayers = <VK>(
  planarGraph: PlanarGraph<VK>,
  startIds: (VK | string)[]
): Map<VK | string, number> => {
  const layers = new Map<VK | string, number>();
  const visited = new Set<VK | string>();

  // Build adjacency list
  const adjacencyList = new Map<VK | string, (VK | string)[]>();
  const inDegree = new Map<VK | string, number>();

  for (const node of planarGraph.nodes.values()) {
    adjacencyList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of planarGraph.edges) {
    const neighbors = adjacencyList.get(edge.from) ?? [];
    neighbors.push(edge.to);
    adjacencyList.set(edge.from, neighbors);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Find roots (nodes with in-degree 0)
  const roots: (VK | string)[] = [];
  for (const node of planarGraph.nodes.values()) {
    if (inDegree.get(node.id) === 0) {
      roots.push(node.id);
    }
  }

  // If no roots, use start IDs
  if (roots.length === 0) {
    roots.push(...startIds);
  }

  // BFS to assign layers
  const queue: (VK | string)[] = [...roots];
  for (const root of roots) {
    layers.set(root, 0);
    visited.add(root);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    const neighbors = adjacencyList.get(current) ?? [];

    for (const neighborId of neighbors) {
      const proposedLayer = currentLayer + 1;
      const existingLayer = layers.get(neighborId);

      if (existingLayer === undefined || proposedLayer > existingLayer) {
        layers.set(neighborId, proposedLayer);
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return layers;
};

/**
 * Assigns horizontal positions within each layer to minimize crossings.
 * Uses a simple barycenter heuristic similar to the layered layout.
 */
const assignPositionsInLayers = <VK>(
  planarGraph: PlanarGraph<VK>,
  layers: Map<VK | string, number>
): Map<VK | string, GridPosition> => {
  // Group nodes by layer
  const layerNodes = new Map<number, (VK | string)[]>();
  for (const [nodeId, layer] of layers) {
    if (!layerNodes.has(layer)) {
      layerNodes.set(layer, []);
    }
    layerNodes.get(layer)!.push(nodeId);
  }

  // Initialize positions
  const positions = new Map<VK | string, number>();
  for (const nodeIds of layerNodes.values()) {
    nodeIds.forEach((id, index) => {
      positions.set(id, index);
    });
  }

  // Build edge lookup
  const outgoingEdges = new Map<VK | string, (VK | string)[]>();
  const incomingEdges = new Map<VK | string, (VK | string)[]>();

  for (const edge of planarGraph.edges) {
    if (!outgoingEdges.has(edge.from)) {
      outgoingEdges.set(edge.from, []);
    }
    outgoingEdges.get(edge.from)!.push(edge.to);

    if (!incomingEdges.has(edge.to)) {
      incomingEdges.set(edge.to, []);
    }
    incomingEdges.get(edge.to)!.push(edge.from);
  }

  // Calculate barycenter for a node
  const calculateBarycenter = (nodeId: VK | string, lookUp: boolean): number => {
    const neighbors = lookUp
      ? (incomingEdges.get(nodeId) ?? [])
      : (outgoingEdges.get(nodeId) ?? []);

    if (neighbors.length === 0) return positions.get(nodeId) ?? 0;

    let sum = 0;
    for (const neighborId of neighbors) {
      sum += positions.get(neighborId) ?? 0;
    }

    return sum / neighbors.length;
  };

  // Perform several iterations of crossing minimization
  const maxLayer = Math.max(...Array.from(layerNodes.keys()));
  const iterations = 5;

  for (let iter = 0; iter < iterations; iter++) {
    // Sweep down
    for (let layer = 1; layer <= maxLayer; layer++) {
      const nodeIds = layerNodes.get(layer) ?? [];
      const nodesWithBarycenter = nodeIds.map(id => ({
        id,
        barycenter: calculateBarycenter(id, true)
      }));
      nodesWithBarycenter.sort((a, b) => a.barycenter - b.barycenter);
      nodesWithBarycenter.forEach((item, index) => {
        positions.set(item.id, index);
      });
    }

    // Sweep up
    for (let layer = maxLayer - 1; layer >= 0; layer--) {
      const nodeIds = layerNodes.get(layer) ?? [];
      const nodesWithBarycenter = nodeIds.map(id => ({
        id,
        barycenter: calculateBarycenter(id, false)
      }));
      nodesWithBarycenter.sort((a, b) => a.barycenter - b.barycenter);
      nodesWithBarycenter.forEach((item, index) => {
        positions.set(item.id, index);
      });
    }
  }

  // Convert to grid positions
  const gridPositions = new Map<VK | string, GridPosition>();
  for (const [nodeId, layer] of layers) {
    const col = positions.get(nodeId) ?? 0;
    gridPositions.set(nodeId, { row: layer, col });
  }

  return gridPositions;
};

/**
 * Computes an orthogonal shape from a planarized graph.
 * Uses a grid-based placement approach similar to layered layout.
 *
 * @param planarGraph - The planarized graph
 * @param startIds - Starting node IDs for layout
 * @returns An orthogonal shape with grid positions
 */
const computeOrthogonalShape = <VK>(
  planarGraph: PlanarGraph<VK>,
  startIds: (VK | string)[]
): OrthogonalShape<VK> => {
  // Step 1: Assign nodes to layers (rows in the grid)
  const layers = assignLayers(planarGraph, startIds);

  // Step 2: Assign positions within layers (columns in the grid)
  const gridPositions = assignPositionsInLayers(planarGraph, layers);

  // Calculate dimensions
  let maxRow = 0;
  let maxCol = 0;

  for (const pos of gridPositions.values()) {
    maxRow = Math.max(maxRow, pos.row);
    maxCol = Math.max(maxCol, pos.col);
  }

  return {
    nodes: gridPositions,
    width: maxCol + 1,
    height: maxRow + 1
  };
};

/**
 * Converts an orthogonal shape to actual coordinates.
 * This phase applies grid spacing and produces the final layout.
 *
 * @param shape - The orthogonal shape with grid positions
 * @param gridSpacing - Spacing between grid cells
 * @param direction - Layout direction
 * @returns Map of node IDs to final coordinates
 */
const compact = <VK>(
  shape: OrthogonalShape<VK>,
  gridSpacing: number,
  direction: 'down' | 'up' | 'left' | 'right'
): Map<VK, Point> => {
  const positions = new Map<VK, Point>();

  // Calculate center offset to center the layout around origin
  const centerRow = (shape.height - 1) / 2;
  const centerCol = (shape.width - 1) / 2;

  for (const [nodeId, gridPos] of shape.nodes) {
    // Skip dummy nodes (they will have string IDs starting with "dummy_")
    if (typeof nodeId === 'string' && nodeId.startsWith('dummy_')) {
      continue;
    }

    // Calculate position relative to center
    const relRow = gridPos.row - centerRow;
    const relCol = gridPos.col - centerCol;

    // Apply grid spacing
    const x = relCol * gridSpacing;
    const y = relRow * gridSpacing;

    // Apply direction transformation
    let point: Point;
    switch (direction) {
      case 'down':
        point = { x, y };
        break;
      case 'up':
        point = { x, y: -y };
        break;
      case 'left':
        point = { x: -y, y: x };
        break;
      case 'right':
        point = { x: y, y: x };
        break;
    }

    positions.set(nodeId as VK, point);
  }

  return positions;
};

/**
 * Lays out vertices in an orthogonal grid pattern.
 *
 * This algorithm creates orthogonal layouts where:
 * - Vertices are placed on a grid
 * - Edges route horizontally and vertically (orthogonal)
 * - Layout minimizes edge crossings using a layered approach
 *
 * The implementation uses a simplified Tamassia-inspired approach:
 * 1. Planarization - prepares the graph structure
 * 2. Orthogonalization - assigns vertices to grid positions
 * 3. Compaction - converts grid positions to actual coordinates
 *
 * This algorithm is ideal for:
 * - Circuit diagrams
 * - Network diagrams
 * - Flow charts requiring orthogonal edges
 * - Any graph that benefits from grid-based placement
 *
 * @param graph - The graph to layout
 * @param startIds - IDs of vertices to start layout from (determines connected component)
 * @param options - Layout options
 * @returns Map of vertex IDs to 2D positions
 *
 * @example
 * ```ts
 * const positions = layoutOrthogonal(graph, ['node1'], {
 *   gridSpacing: 2,
 *   direction: 'down'
 * });
 * ```
 */
export const layoutOrthogonal = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startIds: VK[],
  options: OrthogonalLayoutOptions = {}
): Map<VK, Point> => {
  const { gridSpacing = 1, direction = 'down' } = options;

  if (startIds.length === 0) {
    return new Map();
  }

  // Check if start vertex exists
  const startVertex = graph.getVertex(startIds[0]!);
  if (!startVertex) {
    return new Map();
  }

  // Extract connected component
  const component = getConnectedComponent(graph, startIds[0]!);
  if (!component) {
    return new Map();
  }

  const vertexIds = component.vertices.map(v => v.id);

  // Handle single node case
  if (vertexIds.length === 1) {
    return new Map([[vertexIds[0]!, { x: 0, y: 0 }]]);
  }

  // Phase 1: Planarization
  // Convert the graph to a planarized representation
  const planarGraph = planarize(graph, vertexIds);

  // Phase 2: Orthogonalization
  // Compute orthogonal shape by assigning nodes to grid positions
  const shape = computeOrthogonalShape(planarGraph, vertexIds);

  // Phase 3: Compaction
  // Convert grid positions to actual coordinates with spacing
  return compact(shape, gridSpacing, direction);
};
