import type { Point } from '@diagram-craft/geometry/point';
import type { Graph } from '../graph';
import { getConnectedComponent } from '../connectivity';

/**
 * Layout options for layered graph layout algorithm (Sugiyama framework)
 */
export type LayeredLayoutOptions = {
  /** Horizontal spacing between nodes in the same layer (default: 1) */
  horizontalSpacing?: number;
  /** Vertical spacing between layers (default: 1) */
  verticalSpacing?: number;
  /** Direction of the layout (default: 'down') */
  direction?: 'down' | 'up' | 'left' | 'right';
  /** Number of iterations for crossing minimization (default: 10) */
  crossingMinimizationIterations?: number;
};

/**
 * Internal node structure for layered layout
 */
type LayeredNode<VK> = {
  id: VK;
  layer: number;
  position: number;
  x: number;
  y: number;
  isDummy: boolean;
  originalEdge?: { from: VK; to: VK };
};

/**
 * Internal edge structure for layered layout
 */
type LayeredEdge<VK> = {
  from: VK;
  to: VK;
};

/**
 * Assigns nodes to layers using longest path layering (Coffman-Graham)
 * This ensures that all edges point downward in the layer hierarchy
 */
const assignLayers = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>,
  startIds: VK[]
): Map<VK, number> => {
  const layers = new Map<VK, number>();
  const visited = new Set<VK>();
  const adjacencyList = graph.adjacencyList();

  // Calculate in-degree for each vertex
  const inDegree = new Map<VK, number>();
  for (const vertex of graph.vertices()) {
    inDegree.set(vertex.id, 0);
  }
  for (const edge of graph.edges()) {
    if (!edge.disabled) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  // Find all roots (nodes with in-degree 0) in the connected component
  const firstVertex = graph.getVertex(startIds[0]!);
  if (!firstVertex) return layers;

  const component = getConnectedComponent(graph, startIds[0]!);
  if (!component) return layers;

  const componentVertices = new Set(component.vertices.map(v => v.id));
  const roots: VK[] = [];
  for (const vertexId of componentVertices) {
    if (inDegree.get(vertexId) === 0) {
      roots.push(vertexId);
    }
  }

  // If no roots found, pick start nodes as roots (handles cycles)
  if (roots.length === 0) {
    roots.push(...startIds);
  }

  // BFS to assign layers
  const queue: VK[] = [...roots];
  for (const root of roots) {
    layers.set(root, 0);
    visited.add(root);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    const neighbors = adjacencyList.get(current) ?? [];

    for (const { vertexId, edge } of neighbors) {
      if (edge.disabled) continue;

      // Only process nodes in the same connected component
      if (!componentVertices.has(vertexId)) continue;

      const proposedLayer = currentLayer + 1;
      const existingLayer = layers.get(vertexId);

      if (existingLayer === undefined || proposedLayer > existingLayer) {
        layers.set(vertexId, proposedLayer);
      }

      if (!visited.has(vertexId)) {
        visited.add(vertexId);
        queue.push(vertexId);
      }
    }
  }

  return layers;
};

/**
 * Creates dummy nodes for edges that span multiple layers
 */
const createDummyNodes = <V, E, VK, EK>(
  graph: Graph<V, E, VK, EK>,
  layers: Map<VK, number>
): {
  nodes: Map<VK | string, LayeredNode<VK | string>>;
  edges: LayeredEdge<VK | string>[];
} => {
  const nodes = new Map<VK | string, LayeredNode<VK | string>>();
  const edges: LayeredEdge<VK | string>[] = [];
  let dummyCounter = 0;

  // Create nodes for all original vertices
  for (const [vertexId, layer] of layers) {
    nodes.set(vertexId, {
      id: vertexId,
      layer,
      position: 0,
      x: 0,
      y: 0,
      isDummy: false
    });
  }

  // Process edges and create dummy nodes for long edges
  for (const edge of graph.edges()) {
    if (edge.disabled) continue;

    const fromLayer = layers.get(edge.from);
    const toLayer = layers.get(edge.to);

    if (fromLayer === undefined || toLayer === undefined) continue;

    const layerSpan = toLayer - fromLayer;

    if (layerSpan === 1) {
      // Direct edge
      edges.push({ from: edge.from, to: edge.to });
    } else if (layerSpan > 1) {
      // Create dummy nodes
      let previousId: VK | string = edge.from;
      for (let i = 1; i < layerSpan; i++) {
        const dummyId = `dummy_${dummyCounter++}`;
        nodes.set(dummyId, {
          id: dummyId,
          layer: fromLayer + i,
          position: 0,
          x: 0,
          y: 0,
          isDummy: true,
          originalEdge: { from: edge.from, to: edge.to }
        });
        edges.push({ from: previousId, to: dummyId });
        previousId = dummyId;
      }
      edges.push({ from: previousId, to: edge.to });
    }
    // Ignore backward edges (layerSpan <= 0)
  }

  return { nodes, edges };
};

/**
 * Calculates barycenter (average position of neighbors) for crossing minimization
 */
const calculateBarycenter = <VK>(
  nodeId: VK | string,
  edges: LayeredEdge<VK | string>[],
  nodes: Map<VK | string, LayeredNode<VK | string>>,
  lookUp: boolean
): number => {
  const neighbors = lookUp
    ? edges.filter(e => e.to === nodeId).map(e => e.from)
    : edges.filter(e => e.from === nodeId).map(e => e.to);

  if (neighbors.length === 0) return 0;

  let sum = 0;
  for (const neighborId of neighbors) {
    const neighbor = nodes.get(neighborId);
    if (neighbor) {
      sum += neighbor.position;
    }
  }

  return sum / neighbors.length;
};

/**
 * Minimizes edge crossings using barycenter heuristic
 */
const minimizeCrossings = <VK>(
  nodes: Map<VK | string, LayeredNode<VK | string>>,
  edges: LayeredEdge<VK | string>[],
  iterations: number
): void => {
  // Group nodes by layer
  const layerNodes = new Map<number, (VK | string)[]>();
  for (const node of nodes.values()) {
    if (!layerNodes.has(node.layer)) {
      layerNodes.set(node.layer, []);
    }
    layerNodes.get(node.layer)!.push(node.id);
  }

  const maxLayer = Math.max(...Array.from(layerNodes.keys()));

  // Initialize positions
  for (const nodeIds of layerNodes.values()) {
    nodeIds.forEach((id, index) => {
      const node = nodes.get(id)!;
      node.position = index;
    });
  }

  // Iterate to minimize crossings
  for (let iter = 0; iter < iterations; iter++) {
    // Sweep down
    for (let layer = 1; layer <= maxLayer; layer++) {
      const nodeIds = layerNodes.get(layer) ?? [];
      const nodeWithBarycenter = nodeIds.map(id => ({
        id,
        barycenter: calculateBarycenter(id, edges, nodes, true)
      }));
      nodeWithBarycenter.sort((a, b) => a.barycenter - b.barycenter);
      nodeWithBarycenter.forEach((item, index) => {
        const node = nodes.get(item.id)!;
        node.position = index;
      });
    }

    // Sweep up
    for (let layer = maxLayer - 1; layer >= 0; layer--) {
      const nodeIds = layerNodes.get(layer) ?? [];
      const nodeWithBarycenter = nodeIds.map(id => ({
        id,
        barycenter: calculateBarycenter(id, edges, nodes, false)
      }));
      nodeWithBarycenter.sort((a, b) => a.barycenter - b.barycenter);
      nodeWithBarycenter.forEach((item, index) => {
        const node = nodes.get(item.id)!;
        node.position = index;
      });
    }
  }
};

/**
 * Assigns final coordinates to nodes using a simple layering approach
 */
const assignCoordinates = <VK>(
  nodes: Map<VK | string, LayeredNode<VK | string>>,
  horizontalSpacing: number,
  verticalSpacing: number
): void => {
  // Group nodes by layer
  const layerNodes = new Map<number, LayeredNode<VK | string>[]>();
  for (const node of nodes.values()) {
    if (!layerNodes.has(node.layer)) {
      layerNodes.set(node.layer, []);
    }
    layerNodes.get(node.layer)!.push(node);
  }

  // Sort nodes within each layer by position
  for (const nodeList of layerNodes.values()) {
    nodeList.sort((a, b) => a.position - b.position);
  }

  // Assign coordinates
  for (const [layer, nodeList] of layerNodes) {
    const layerWidth = (nodeList.length - 1) * horizontalSpacing;
    const startX = -layerWidth / 2;

    nodeList.forEach((node, index) => {
      node.x = startX + index * horizontalSpacing;
      node.y = layer * verticalSpacing;
    });
  }
};

/**
 * Collects final positions, applying direction transformation
 */
const collectPositions = <VK>(
  nodes: Map<VK | string, LayeredNode<VK | string>>,
  direction: 'down' | 'up' | 'left' | 'right'
): Map<VK, Point> => {
  const positions = new Map<VK, Point>();

  for (const node of nodes.values()) {
    if (node.isDummy) continue;

    let point: Point;
    const x = node.x === 0 ? 0 : node.x;
    const y = node.y === 0 ? 0 : node.y;

    switch (direction) {
      case 'down':
        point = { x, y };
        break;
      case 'up':
        point = { x, y: y === 0 ? 0 : -y };
        break;
      case 'left':
        point = { x: y === 0 ? 0 : -y, y: x };
        break;
      case 'right':
        point = { x: y, y: x };
        break;
    }

    positions.set(node.id as VK, point);
  }

  return positions;
};

/**
 * Lays out vertices in layers using the Sugiyama framework.
 *
 * The Sugiyama framework is a well-established algorithm for layered graph drawing
 * that produces hierarchical layouts. It consists of four phases:
 * 1. Layer assignment - assigns nodes to horizontal layers
 * 2. Dummy node insertion - creates dummy nodes for edges spanning multiple layers
 * 3. Crossing minimization - reorders nodes within layers to minimize edge crossings
 * 4. Coordinate assignment - assigns final x,y positions
 *
 * This algorithm is ideal for:
 * - Directed acyclic graphs (DAGs)
 * - Hierarchical structures (flowcharts, call graphs, dependency diagrams)
 * - Any graph that benefits from a layered representation
 *
 * @param graph - The graph to layout
 * @param startIds - IDs of vertices to start layout from (determines connected component)
 * @param options - Layout options
 * @returns Map of vertex IDs to 2D positions
 *
 * @example
 * ```ts
 * const positions = layoutLayered(graph, ['root'], {
 *   horizontalSpacing: 2,
 *   verticalSpacing: 1.5,
 *   direction: 'down',
 *   crossingMinimizationIterations: 10
 * });
 * ```
 */
export const layoutLayered = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startIds: VK[],
  options: LayeredLayoutOptions = {}
): Map<VK, Point> => {
  const {
    horizontalSpacing = 1,
    verticalSpacing = 1,
    direction = 'down',
    crossingMinimizationIterations = 10
  } = options;

  if (startIds.length === 0) {
    return new Map();
  }

  // Phase 1: Assign nodes to layers
  const layers = assignLayers(graph, startIds);
  if (layers.size === 0) {
    return new Map();
  }

  // Phase 2: Create dummy nodes for long edges
  const { nodes, edges } = createDummyNodes(graph, layers);

  // Phase 3: Minimize crossings
  minimizeCrossings(nodes, edges, crossingMinimizationIterations);

  // Phase 4: Assign coordinates
  assignCoordinates(nodes, horizontalSpacing, verticalSpacing);

  // Return final positions
  return collectPositions(nodes, direction);
};
