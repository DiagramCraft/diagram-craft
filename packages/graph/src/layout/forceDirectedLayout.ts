/*
 * Copyright (c) 2025 Magnus Johansson
 * SPDX-License-Identifier: ISC
 */

import type { Point } from '@diagram-craft/geometry/point';
import type { Graph } from '../graph';
import { getConnectedComponent } from '../connectivity';

/**
 * Layout options for force-directed graph layout algorithm
 */
export type ForceDirectedLayoutOptions = {
  /** Number of simulation iterations (default: 300) */
  iterations?: number;
  /** Spring strength multiplier for attractive forces (default: 0.5) */
  springStrength?: number;
  /** Repulsion strength multiplier for repulsive forces (default: 1.0) */
  repulsionStrength?: number;
  /** Ideal distance between connected nodes (default: 100) */
  idealEdgeLength?: number;
  /** Initial positions for nodes (optional) */
  initialPositions?: Map<string | number, Point>;
};

/**
 * Internal node structure for force-directed layout
 */
type ForceNode<VK> = {
  /** Unique identifier */
  id: VK;
  /** Current x position */
  x: number;
  /** Current y position */
  y: number;
  /** X displacement (force accumulator) */
  dx: number;
  /** Y displacement (force accumulator) */
  dy: number;
};

/**
 * Calculates repulsive force between two nodes using Fruchterman-Reingold formula.
 */
const calculateRepulsiveForce = (distance: number, k: number): number => {
  if (distance === 0) return 0;
  return (k * k) / distance;
};

/**
 * Calculates attractive force between two connected nodes using Fruchterman-Reingold formula.
 */
const calculateAttractiveForce = (distance: number, k: number): number => {
  return (distance * distance) / k;
};

/**
 * Computes center of mass for a set of nodes.
 */
const computeCenterOfMass = <VK>(nodes: Map<VK, ForceNode<VK>>): Point => {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const node of nodes.values()) {
    sumX += node.x;
    sumY += node.y;
    count++;
  }

  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
};

/**
 * Implements the Fruchterman-Reingold force-directed layout algorithm.
 *
 * This algorithm simulates a physical system where:
 * - Connected nodes attract each other (spring forces)
 * - All nodes repel each other (electrostatic forces)
 * - Forces are iteratively applied with a cooling schedule
 *
 * The layout always operates on the entire connected component containing the start nodes.
 *
 * @param graph - The graph to layout
 * @param startIds - IDs of vertices to start layout from (determines connected component)
 * @param options - Layout options
 * @returns Map of vertex IDs to 2D positions
 *
 * @example
 * ```ts
 * const positions = layoutForceDirected(graph, ['node1'], {
 *   iterations: 300,
 *   springStrength: 0.5,
 *   repulsionStrength: 1.0,
 *   idealEdgeLength: 100
 * });
 * ```
 */
export const layoutForceDirected = <V = unknown, E = unknown, VK = string, EK = string>(
  graph: Graph<V, E, VK, EK>,
  startIds: VK[],
  options: ForceDirectedLayoutOptions = {}
): Map<VK, Point> => {
  const {
    iterations = 300,
    springStrength = 0.5,
    repulsionStrength = 1.0,
    idealEdgeLength = 100,
    initialPositions = new Map<string | number, Point>()
  } = options;

  if (startIds.length === 0) {
    return new Map();
  }

  const firstStartId = startIds[0]!; // Safe due to length check above

  // Extract entire connected component using the first selected node
  const component = getConnectedComponent(graph, firstStartId);
  if (!component) {
    return new Map();
  }

  const vertices = component.vertices;
  const edges = component.edges;

  // Initialize nodes with positions
  const nodes = new Map<VK, ForceNode<VK>>();
  const k = idealEdgeLength; // Optimal distance

  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i]!;

    let initialPos: Point;
    if (initialPositions.has(vertex.id as string | number)) {
      initialPos = initialPositions.get(vertex.id as string | number)!;
    } else {
      // Random initial position in a circle
      const angle = (i / vertices.length) * 2 * Math.PI;
      const radius = (k * Math.sqrt(vertices.length)) / 2;
      initialPos = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle)
      };
    }

    nodes.set(vertex.id, {
      id: vertex.id,
      x: initialPos.x,
      y: initialPos.y,
      dx: 0,
      dy: 0
    });
  }

  // Store initial center of mass to restore after layout
  const initialCenter = computeCenterOfMass(nodes);

  // Run force-directed simulation
  for (let iteration = 0; iteration < iterations; iteration++) {
    // Calculate temperature (cooling schedule)
    const temperature = (1 - iteration / iterations) * k * 0.5;

    // Reset displacements
    for (const node of nodes.values()) {
      node.dx = 0;
      node.dy = 0;
    }

    // Calculate repulsive forces between all pairs
    const nodeArray = Array.from(nodes.values());
    for (let i = 0; i < nodeArray.length; i++) {
      const v = nodeArray[i]!;

      for (let j = i + 1; j < nodeArray.length; j++) {
        const u = nodeArray[j]!;
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const force = calculateRepulsiveForce(distance, k) * repulsionStrength;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          v.dx += fx;
          v.dy += fy;
          u.dx -= fx;
          u.dy -= fy;
        }
      }
    }

    // Calculate attractive forces for connected nodes
    for (const edge of edges) {
      const v = nodes.get(edge.from);
      const u = nodes.get(edge.to);

      if (!v || !u) continue;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const force = calculateAttractiveForce(distance, k) * springStrength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        v.dx -= fx;
        v.dy -= fy;
        u.dx += fx;
        u.dy += fy;
      }
    }

    // Apply forces with temperature-based damping
    for (const node of nodes.values()) {
      const displacement = Math.sqrt(node.dx * node.dx + node.dy * node.dy);
      if (displacement > 0) {
        const limitedDisplacement = Math.min(displacement, temperature);
        node.x += (node.dx / displacement) * limitedDisplacement;
        node.y += (node.dy / displacement) * limitedDisplacement;
      }
    }
  }

  // Restore center of mass
  const finalCenter = computeCenterOfMass(nodes);
  const offsetX = initialCenter.x - finalCenter.x;
  const offsetY = initialCenter.y - finalCenter.y;

  for (const node of nodes.values()) {
    node.x += offsetX;
    node.y += offsetY;
  }

  // Convert to position map
  const positions = new Map<VK, Point>();
  for (const node of nodes.values()) {
    positions.set(node.id, { x: node.x, y: node.y });
  }

  return positions;
};
