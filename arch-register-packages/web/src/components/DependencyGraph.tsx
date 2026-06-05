import { useMemo } from 'react';
import { SimpleGraph } from '@diagram-craft/graph/graph';
import { getConnectedComponents } from '@diagram-craft/graph/connectivity';
import { layoutLayered } from '@diagram-craft/graph/layout/layeredLayout';
import { layoutForceDirected } from '@diagram-craft/graph/layout/forceDirectedLayout';
import { layoutTree } from '@diagram-craft/graph/layout/treeLayout';
import type { Point } from '@diagram-craft/geometry/point';
import styles from './DependencyGraph.module.css';

export type LayoutAlgorithm = 'layered' | 'force' | 'tree' | 'hierarchy';

export type DependencyGraphNode<T> = {
  id: string;
  data: T;
};

export type DependencyGraphEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind?: string;
};

type Props<T> = {
  nodes: DependencyGraphNode<T>[];
  edges: DependencyGraphEdge[];
  layout: LayoutAlgorithm;
  nodeWidth?: number;
  nodeHeight?: number;
  renderNode: (node: DependencyGraphNode<T>) => React.ReactNode;
  onNodeClick?: (id: string) => void;
};

const PADDING = 48;

/**
 * Distance from rectangle center to its border along direction (ux, uy).
 * hw/hh are half-width and half-height.
 */
const rectBorderDist = (ux: number, uy: number, hw: number, hh: number): number =>
  Math.min(
    Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity
  );

const normalize = (dx: number, dy: number): [number, number] => {
  const len = Math.sqrt(dx * dx + dy * dy);
  return len > 1e-6 ? [dx / len, dy / len] : [0, 0];
};

export const DependencyGraph = <T,>({
  nodes,
  edges,
  layout,
  nodeWidth = 160,
  nodeHeight = 48,
  renderNode,
  onNodeClick,
}: Props<T>) => {
  const positions = useMemo((): Map<string, Point> => {
    if (nodes.length === 0) return new Map();

    const graph = new SimpleGraph<T, { kind?: string }>();
    for (const node of nodes) {
      graph.addVertex({ id: node.id, data: node.data });
    }

    // Hierarchy layout: only containment edges drive node positioning.
    // Reference edges are rendered as arcs and don't affect layout.
    const layoutEdges = layout === 'hierarchy'
      ? edges.filter(e => e.kind === 'containment')
      : edges;

    for (const edge of layoutEdges) {
      graph.addEdge({ id: edge.id, from: edge.from, to: edge.to, weight: 1, data: { kind: edge.kind } });
    }

    const components = getConnectedComponents(graph);
    const hSpacing = nodeWidth + 40;
    const vSpacing = nodeHeight + 60;
    const idealLength = Math.max(nodeWidth, nodeHeight) * 2.5;

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
          });
          break;
        case 'force':
          componentPositions = layoutForceDirected(graph, [startId], {
            idealEdgeLength: idealLength,
            iterations: 300,
          });
          break;
        case 'tree':
          componentPositions = layoutTree(graph, startId, {
            horizontalSpacing: hSpacing,
            verticalSpacing: vSpacing,
            direction: 'down',
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

    // For hierarchy layout the edge convention is child → parent, so the layered
    // layout assigns children to layer 0 (top). Flip Y so parents appear at the top.
    if (layout === 'hierarchy' && result.size > 0) {
      const maxY = Math.max(...Array.from(result.values()).map(p => p.y));
      for (const [id, pos] of result) {
        result.set(id, { x: pos.x, y: maxY - pos.y });
      }
    }

    return result;
  }, [nodes, edges, layout, nodeWidth, nodeHeight]);

  const viewBox = useMemo(() => {
    if (positions.size === 0) return '0 0 400 300';

    const posValues = Array.from(positions.values());
    let minX = Math.min(...posValues.map(p => p.x)) - nodeWidth / 2 - PADDING;
    let minY = Math.min(...posValues.map(p => p.y)) - nodeHeight / 2 - PADDING;
    let maxX = Math.max(...posValues.map(p => p.x)) + nodeWidth / 2 + PADDING;
    let maxY = Math.max(...posValues.map(p => p.y)) + nodeHeight / 2 + PADDING;

    // For hierarchy layout, extend the viewBox downward to include arc peaks for reference edges
    if (layout === 'hierarchy') {
      for (const edge of edges) {
        if (edge.kind === 'containment') continue;
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) continue;
        const dist = Math.sqrt((toPos.x - fromPos.x) ** 2 + (toPos.y - fromPos.y) ** 2);
        const arcHeight = Math.max(dist * 0.35, nodeHeight);
        const peakY = (fromPos.y + toPos.y) / 2 + arcHeight;
        maxY = Math.max(maxY, peakY + PADDING);
      }
    }

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [positions, nodeWidth, nodeHeight, layout, edges]);

  const nodeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, n])),
    [nodes]
  );

  const nw = nodeWidth;
  const nh = nodeHeight;

  return (
    <svg
      className={styles.root}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/*
          fill="context-stroke" makes the arrowhead inherit the stroke color of
          the line/path that references this marker, avoiding CSS-variable
          resolution issues inside <marker> defs.
        */}
        <marker
          id="dep-arrow"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 Z" style={{ fill: 'context-stroke' }} />
        </marker>
      </defs>

      {/* Straight edges — rendered before nodes so nodes appear on top */}
      {edges.map(edge => {
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;

        // In hierarchy layout, reference edges are rendered as arcs in a later pass
        if (layout === 'hierarchy' && edge.kind !== 'containment') return null;

        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return null;

        const [ux, uy] = normalize(dx, dy);
        const trimSrc = rectBorderDist(ux, uy, nw / 2, nh / 2);
        const trimDst = rectBorderDist(ux, uy, nw / 2, nh / 2) + 2;

        const x1 = fromPos.x + ux * trimSrc;
        const y1 = fromPos.y + uy * trimSrc;
        const x2 = toPos.x - ux * trimDst;
        const y2 = toPos.y - uy * trimDst;

        return (
          <line
            key={edge.id}
            x1={x1} y1={y1}
            x2={x2} y2={y2}
            className={edge.kind === 'containment' ? styles.edgeContainment : styles.edge}
            markerEnd="url(#dep-arrow)"
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions.get(node.id);
        if (!pos) return null;

        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onClick={() => onNodeClick?.(node.id)}
            style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
          >
            <rect
              x={-nw / 2}
              y={-nh / 2}
              width={nw}
              height={nh}
              rx={6}
              className={styles.nodeRect}
            />
            <foreignObject x={-nw / 2} y={-nh / 2} width={nw} height={nh}>
              <div
                // @ts-expect-error xmlns is required for foreignObject content in some renderers
                xmlns="http://www.w3.org/1999/xhtml"
                className={styles.nodeContent}
              >
                {renderNode(nodeMap.get(node.id) ?? node)}
              </div>
            </foreignObject>
          </g>
        );
      })}

      {/* Arc edges for reference relations in hierarchy layout — rendered after nodes so arcs appear on top */}
      {layout === 'hierarchy' && edges.map(edge => {
        if (edge.kind === 'containment') return null;
        const fromPos = positions.get(edge.from);
        const toPos = positions.get(edge.to);
        if (!fromPos || !toPos) return null;

        const x1 = fromPos.x, y1 = fromPos.y;
        const x2 = toPos.x, y2 = toPos.y;
        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (dist === 0) return null;

        // Control point bows downward (positive Y = below the nodes)
        const cx = (x1 + x2) / 2;
        const arcHeight = Math.max(dist * 0.35, nh);
        const cy = (y1 + y2) / 2 + arcHeight;

        // Source trim: tangent from source toward the control point
        const [ustx, usty] = normalize(cx - x1, cy - y1);
        const srcTrim = rectBorderDist(ustx, usty, nw / 2, nh / 2);

        // Target trim: tangent from the control point toward target
        const [uttx, utty] = normalize(x2 - cx, y2 - cy);
        const dstTrim = rectBorderDist(uttx, utty, nw / 2, nh / 2) + 2;

        const sx = x1 + ustx * srcTrim;
        const sy = y1 + usty * srcTrim;
        const ex = x2 - uttx * dstTrim;
        const ey = y2 - utty * dstTrim;

        return (
          <path
            key={edge.id}
            d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`}
            className={styles.arcEdge}
            markerEnd="url(#dep-arrow)"
          />
        );
      })}
    </svg>
  );
};
