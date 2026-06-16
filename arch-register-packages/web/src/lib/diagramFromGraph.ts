import { SimpleGraph } from '@diagram-craft/graph/graph';
import { getConnectedComponents } from '@diagram-craft/graph/connectivity';
import { layoutLayered } from '@diagram-craft/graph/layout/layeredLayout';
import { layoutForceDirected } from '@diagram-craft/graph/layout/forceDirectedLayout';
import { layoutTree } from '@diagram-craft/graph/layout/treeLayout';
import type { Point } from '@diagram-craft/geometry/point';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { emptyDiagram } from './api';

export type GraphNodeInput = { id: string; label: string };
export type GraphEdgeInput = { id: string; from: string; to: string; label?: string; kind?: string };

export type GraphLayoutOptions = {
  layout: 'hierarchy' | 'layered' | 'force' | 'tree';
  horizontalSpacing?: number;
  verticalSpacing?: number;
  iterations?: number;
  springStrength?: number;
  repulsionStrength?: number;
  idealEdgeLength?: number;
  crossingMinimizationIterations?: number;
  nodeWidth?: number;
  nodeHeight?: number;
};

const PADDING = 60;

const randomId = () => Math.random().toString(36).substring(2, 9);

const computePositions = (
  inputNodes: GraphNodeInput[],
  inputEdges: GraphEdgeInput[],
  options: GraphLayoutOptions
): Map<string, Point> => {
  if (inputNodes.length === 0) return new Map();

  const { layout } = options;
  const nodeWidth = options.nodeWidth ?? 200;
  const nodeHeight = options.nodeHeight ?? 52;
  const hSpacing = options.horizontalSpacing ?? nodeWidth + 40;
  const vSpacing = options.verticalSpacing ?? nodeHeight + 60;
  const idealLength = options.idealEdgeLength ?? Math.max(nodeWidth, nodeHeight);

  const graph = new SimpleGraph<GraphNodeInput, { kind?: string }>();
  for (const n of inputNodes) {
    graph.addVertex({ id: n.id, data: n });
  }

  // Mirror DependencyGraph: hierarchy uses only containment edges for layout
  const layoutEdges =
    layout === 'hierarchy'
      ? inputEdges.filter(e => e.kind === 'containment' && e.from !== e.to)
      : inputEdges.filter(e => e.from !== e.to);

  for (const e of layoutEdges) {
    graph.addEdge({ id: e.id, from: e.from, to: e.to, weight: 1, data: { kind: e.kind } });
  }

  const components = getConnectedComponents(graph);
  const result = new Map<string, Point>();
  let xOffset = 0;

  for (const component of components) {
    if (component.vertices.length === 0) continue;
    const startId = component.vertices[0]!.id;

    let componentPositions: Map<string, Point>;

    switch (layout) {
      case 'layered':
      case 'hierarchy':
        componentPositions = layoutLayered(graph, [startId], {
          horizontalSpacing: hSpacing,
          verticalSpacing: vSpacing,
          direction: 'down',
          crossingMinimizationIterations: options.crossingMinimizationIterations ?? 10
        });
        break;
      case 'force':
        componentPositions = layoutForceDirected(graph, [startId], {
          idealEdgeLength: idealLength,
          iterations: options.iterations ?? 300,
          springStrength: options.springStrength ?? 0.5,
          repulsionStrength: options.repulsionStrength ?? 1.0
        });
        break;
      case 'tree':
        componentPositions = layoutTree(graph, startId, {
          horizontalSpacing: hSpacing,
          verticalSpacing: vSpacing,
          direction: 'down'
        });
        break;
    }

    if (componentPositions.size === 0) continue;

    const xs = Array.from(componentPositions.values()).map(p => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const compWidth = maxX - minX + nodeWidth;

    for (const [id, pos] of componentPositions) {
      result.set(id, { x: pos.x - minX + xOffset, y: pos.y });
    }

    xOffset += compWidth + hSpacing;
  }

  // Flip Y for hierarchy so parents appear at top (same as DependencyGraph)
  if (layout === 'hierarchy' && result.size > 0) {
    const maxY = Math.max(...Array.from(result.values()).map(p => p.y));
    for (const [id, pos] of result) {
      result.set(id, { x: pos.x, y: maxY - pos.y });
    }
  }

  return result;
};

const buildLabelChild = (label: string, midX: number, midY: number) => {
  const labelId = randomId();
  const labelW = Math.max(50, label.length * 7);
  return {
    labelNode: {
      id: labelId,
      type: 'horizontal' as const,
      offset: { x: 0, y: -10 },
      timeOffset: 0.5
    },
    child: {
      id: labelId,
      type: 'node' as const,
      nodeType: 'text',
      bounds: { x: midX - labelW / 2, y: midY - 16, w: labelW, h: 16, r: 0 },
      children: [],
      props: {
        text: { align: 'center' as const },
        stroke: { enabled: false },
        fill: { enabled: false }
      },
      metadata: { style: 'default-text', textStyle: 'default-text-default' },
      texts: { text: label }
    }
  };
};

export const createDiagramFromGraph = (
  name: string,
  inputNodes: GraphNodeInput[],
  inputEdges: GraphEdgeInput[],
  options: GraphLayoutOptions = { layout: 'hierarchy' }
): SerializedDiagramDocument => {
  const nodeWidth = options.nodeWidth ?? 200;
  const nodeHeight = options.nodeHeight ?? 52;
  const { layout } = options;

  const positions = computePositions(inputNodes, inputEdges, options);

  const serializedNodes = inputNodes.map(n => {
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    return {
      type: 'node' as const,
      nodeType: 'rounded-rect',
      id: n.id,
      bounds: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
        w: nodeWidth,
        h: nodeHeight,
        r: 0
      },
      props: {},
      metadata: {},
      texts: { text: n.label },
      children: []
    };
  });

  const serializedEdges = inputEdges.map(e => {
    const fromPos = positions.get(e.from) ?? { x: 0, y: 0 };
    const toPos = positions.get(e.to) ?? { x: 0, y: 0 };

    const isContainment = e.kind === 'containment';
    const isSelfLoop = e.from === e.to;
    const isArcEdge = layout === 'hierarchy' && !isContainment && !isSelfLoop;

    // Dashed for all non-containment edges (matches DependencyGraph CSS)
    const strokeProps = isContainment ? {} : { stroke: { pattern: 'DASHED' } };
    const arrowProps = { arrow: { end: { type: 'SQUARE_ARROW_FILLED' } } };

    if (isSelfLoop) {
      // Cubic bezier loop from right-middle to bottom-center of node
      const loopSize = Math.max(nodeWidth, nodeHeight) * 0.8;
      const sx = fromPos.x + nodeWidth / 2;
      const sy = fromPos.y;
      const ex = fromPos.x;
      const ey = fromPos.y + nodeHeight / 2;
      const midX = (sx + ex) / 2 + loopSize * 0.5;
      const midY = (sy + ey) / 2 + loopSize * 0.5;

      const label = e.label ? buildLabelChild(e.label, midX, midY) : null;

      return {
        type: 'edge' as const,
        id: e.id,
        start: { position: { x: sx, y: sy } },
        end: { position: { x: ex, y: ey } },
        props: { ...strokeProps, ...arrowProps, type: 'bezier' },
        metadata: {},
        waypoints: [{ point: { x: fromPos.x + loopSize, y: fromPos.y + loopSize } }],
        ...(label ? { labelNodes: [label.labelNode], children: [label.child] } : {})
      };
    }

    if (isArcEdge) {
      // Quadratic bezier arc below the two nodes (matches DependencyGraph arc rendering)
      const dist = Math.sqrt((toPos.x - fromPos.x) ** 2 + (toPos.y - fromPos.y) ** 2);
      const arcHeight = Math.max(dist * 0.35, nodeHeight);
      const cx = (fromPos.x + toPos.x) / 2;
      const cy = (fromPos.y + toPos.y) / 2 + arcHeight;
      // Midpoint on the quadratic bezier at t=0.5
      const midX = 0.25 * fromPos.x + 0.5 * cx + 0.25 * toPos.x;
      const midY = 0.25 * fromPos.y + 0.5 * cy + 0.25 * toPos.y;

      const label = e.label ? buildLabelChild(e.label, midX, midY) : null;

      return {
        type: 'edge' as const,
        id: e.id,
        start: { anchor: 'c', node: { id: e.from }, position: fromPos, offset: { x: 0, y: 0 } },
        end: { anchor: 'c', node: { id: e.to }, position: toPos, offset: { x: 0, y: 0 } },
        props: { ...strokeProps, ...arrowProps, type: 'bezier' },
        metadata: {},
        waypoints: [{ point: { x: cx, y: cy } }],
        ...(label ? { labelNodes: [label.labelNode], children: [label.child] } : {})
      };
    }

    // Straight edge
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const label = e.label ? buildLabelChild(e.label, midX, midY) : null;

    return {
      type: 'edge' as const,
      id: e.id,
      start: { anchor: 'c', node: { id: e.from }, position: fromPos, offset: { x: 0, y: 0 } },
      end: { anchor: 'c', node: { id: e.to }, position: toPos, offset: { x: 0, y: 0 } },
      props: { ...strokeProps, ...arrowProps },
      metadata: {},
      waypoints: [],
      ...(label ? { labelNodes: [label.labelNode], children: [label.child] } : {})
    };
  });

  // Compute canvas bounds from node center positions
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
  if (positions.size > 0) {
    const xs = Array.from(positions.values()).map(p => p.x);
    const ys = Array.from(positions.values()).map(p => p.y);
    minX = Math.min(...xs) - nodeWidth / 2 - PADDING;
    minY = Math.min(...ys) - nodeHeight / 2 - PADDING;
    maxX = Math.max(...xs) + nodeWidth / 2 + PADDING;
    maxY = Math.max(...ys) + nodeHeight / 2 + PADDING;
  }

  const base = emptyDiagram(name);
  const diagram = base.diagrams[0]!;

  const diagramId = randomId();
  const layerId = randomId();

  return {
    ...base,
    diagrams: [
      {
        ...diagram,
        id: diagramId,
        name: 'Sheet 1',
        layers: [
          {
            id: layerId,
            name: 'Default',
            type: 'layer',
            layerType: 'regular',
            elements: [...serializedNodes, ...serializedEdges],
            isLocked: false
          }
        ],
        activeLayerId: layerId,
        visibleLayers: [layerId],
        canvas: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      }
    ],
    activeDiagramId: diagramId
  } as unknown as SerializedDiagramDocument;
};
