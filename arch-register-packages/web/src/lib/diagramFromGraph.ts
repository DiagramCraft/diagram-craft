import { SimpleGraph } from '@diagram-craft/graph/graph';
import { getConnectedComponents } from '@diagram-craft/graph/connectivity';
import { layoutLayered } from '@diagram-craft/graph/layout/layeredLayout';
import { layoutForceDirected } from '@diagram-craft/graph/layout/forceDirectedLayout';
import { layoutTree } from '@diagram-craft/graph/layout/treeLayout';
import type { Point } from '@diagram-craft/geometry/point';
import type {
  SerializedDiagramDocument,
  SerializedRegularEdge,
  SerializedRegularNode
} from '@diagram-craft/model/serialization/serializedTypes';
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

const hasPoint = (point: Point | undefined): point is Point => point !== undefined;

const pickTreeRootId = (
  componentVertexIds: Set<string>,
  inputEdges: GraphEdgeInput[]
): string | undefined => {
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();

  for (const id of componentVertexIds) {
    incomingCounts.set(id, 0);
    outgoingCounts.set(id, 0);
  }

  for (const edge of inputEdges) {
    if (
      !componentVertexIds.has(edge.from) ||
      !componentVertexIds.has(edge.to) ||
      edge.from === edge.to
    ) {
      continue;
    }
    outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }

  const orderedIds = Array.from(componentVertexIds).sort();
  return orderedIds.sort((a, b) => {
    const incomingDiff = (incomingCounts.get(a) ?? 0) - (incomingCounts.get(b) ?? 0);
    if (incomingDiff !== 0) return incomingDiff;

    const outgoingDiff = (outgoingCounts.get(b) ?? 0) - (outgoingCounts.get(a) ?? 0);
    if (outgoingDiff !== 0) return outgoingDiff;

    return a.localeCompare(b);
  })[0];
};

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
    const componentVertexIds = new Set(component.vertices.map(vertex => vertex.id));
    const startId =
      layout === 'tree'
        ? pickTreeRootId(componentVertexIds, layoutEdges) ?? component.vertices[0]!.id
        : component.vertices[0]!.id;

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
      timeOffset: 0.5,
      offsetType: 'absolute' as const
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

const extendBoundsWithPoint = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  point: Point
) => {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
};

const extendBoundsWithRect = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { x: number; y: number; w: number; h: number }
) => {
  bounds.minX = Math.min(bounds.minX, rect.x);
  bounds.minY = Math.min(bounds.minY, rect.y);
  bounds.maxX = Math.max(bounds.maxX, rect.x + rect.w);
  bounds.maxY = Math.max(bounds.maxY, rect.y + rect.h);
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

  const serializedNodes: SerializedRegularNode[] = inputNodes.map(n => {
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

  const serializedEdges: SerializedRegularEdge[] = [];
  for (const e of inputEdges) {
    const fromPos = positions.get(e.from);
    const toPos = positions.get(e.to);

    if (!fromPos || !toPos) continue;

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

      serializedEdges.push({
        type: 'edge' as const,
        id: e.id,
        start: { position: { x: sx, y: sy } },
        end: { position: { x: ex, y: ey } },
        props: { ...strokeProps, ...arrowProps, type: 'bezier' },
        metadata: {},
        waypoints: [{ point: { x: fromPos.x + loopSize, y: fromPos.y + loopSize } }],
        ...(label ? { labelNodes: [label.labelNode], children: [label.child] } : {})
      });
      continue;
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

      serializedEdges.push({
        type: 'edge' as const,
        id: e.id,
        start: { anchor: 'c', node: { id: e.from }, position: fromPos, offset: { x: 0, y: 0 } },
        end: { anchor: 'c', node: { id: e.to }, position: toPos, offset: { x: 0, y: 0 } },
        props: { ...strokeProps, ...arrowProps, type: 'bezier' },
        metadata: {},
        waypoints: [{ point: { x: cx, y: cy } }],
        ...(label ? { labelNodes: [label.labelNode], children: [label.child] } : {})
      });
      continue;
    }

    // Straight edge
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const label = e.label ? buildLabelChild(e.label, midX, midY) : null;

    serializedEdges.push({
      type: 'edge' as const,
      id: e.id,
      start: { anchor: 'c', node: { id: e.from }, position: fromPos, offset: { x: 0, y: 0 } },
      end: { anchor: 'c', node: { id: e.to }, position: toPos, offset: { x: 0, y: 0 } },
      props: { ...strokeProps, ...arrowProps },
      metadata: {},
      waypoints: [],
      ...(label ? { labelNodes: [label.labelNode], children: [label.child] } : {})
    });
  }

  // Compute canvas bounds from generated geometry, including edge curves and labels.
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
  if (serializedNodes.length > 0) {
    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    };

    for (const node of serializedNodes) {
      extendBoundsWithRect(bounds, node.bounds);
    }

    for (const edge of serializedEdges) {
      if (hasPoint(edge.start.position)) {
        extendBoundsWithPoint(bounds, edge.start.position);
      }

      if (hasPoint(edge.end.position)) {
        extendBoundsWithPoint(bounds, edge.end.position);
      }

      for (const waypoint of edge.waypoints ?? []) {
        extendBoundsWithPoint(bounds, waypoint.point);
      }

      for (const child of edge.children ?? []) {
        if (child.type === 'node') {
          extendBoundsWithRect(bounds, child.bounds);
        }
      }
    }

    minX = bounds.minX - PADDING;
    minY = bounds.minY - PADDING;
    maxX = bounds.maxX + PADDING;
    maxY = bounds.maxY + PADDING;
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
