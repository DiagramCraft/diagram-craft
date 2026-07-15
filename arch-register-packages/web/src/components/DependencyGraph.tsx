import { useMemo, useState, useEffect, useRef } from 'react';
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

export type LayoutOptions = {
  // Common options
  horizontalSpacing?: number;
  verticalSpacing?: number;

  // Force-directed specific
  iterations?: number;
  springStrength?: number;
  repulsionStrength?: number;
  idealEdgeLength?: number;

  // Layered specific
  crossingMinimizationIterations?: number;
};

type Props<T> = {
  nodes: DependencyGraphNode<T>[];
  edges: DependencyGraphEdge[];
  layout: LayoutAlgorithm;
  layoutOptions?: LayoutOptions;
  nodeWidth?: number;
  nodeHeight?: number;
  renderNode: (node: DependencyGraphNode<T>) => React.ReactNode;
  onNodeClick?: (id: string) => void;
  onNodeContextMenu?: (id: string, event: React.MouseEvent) => void;
  highlightedIds?: ReadonlySet<string>;
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

const renderSelfLoop = (
  edge: DependencyGraphEdge,
  pos: Point,
  nodeWidth: number,
  nodeHeight: number,
  edgeClass: string,
  highlighted: boolean,
  includeKind: boolean
): React.JSX.Element => {
  const loopSize = Math.max(nodeWidth, nodeHeight) * 0.8;
  const startX = pos.x + nodeWidth / 2;
  const startY = pos.y;
  const endX = pos.x;
  const endY = pos.y + nodeHeight / 2;
  const c1x = startX + loopSize;
  const c2y = endY + loopSize;
  const labelX = pos.x + loopSize * 0.7;
  const labelY = pos.y + loopSize * 0.7;
  return (
    <g key={edge.id}>
      <path
        d={`M ${startX} ${startY} C ${c1x} ${startY}, ${endX} ${c2y}, ${endX} ${endY}`}
        className={edgeClass}
        {...(includeKind ? { 'data-kind': edge.kind } : {})}
        data-highlighted={highlighted}
        fill="none"
        markerEnd="url(#dep-arrow)"
      />
      {edge.label && (
        <text
          x={labelX}
          y={labelY}
          className={styles.eEdgeLabel}
          data-highlighted={highlighted}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

export const DependencyGraph = <T,>({
  nodes,
  edges,
  layout,
  layoutOptions = {},
  nodeWidth = 160,
  nodeHeight = 48,
  renderNode,
  onNodeClick,
  onNodeContextMenu,
  highlightedIds
}: Props<T>) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  // Kept in a ref so the wheel handler always reads the current zoom without
  // needing to re-register the listener on every zoom change.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const connectedEdges = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return new Set(
      edges.filter(e => e.from === hoveredNodeId || e.to === hoveredNodeId).map(e => e.id)
    );
  }, [hoveredNodeId, edges]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch zoom (browser translates pinch to wheel + ctrlKey)
        const delta = e.deltaY;
        const normalized = -(delta % 3 ? delta * 10 : delta / 3);
        const zoomFactor = normalized > 0 ? 1.008 : 1 / 1.008;
        setZoom(prevZoom => Math.max(0.1, Math.min(10, prevZoom * zoomFactor)));
      } else {
        // Two-finger pan
        setPan(prevPan => ({
          x: prevPan.x - e.deltaX * zoomRef.current,
          y: prevPan.y - e.deltaY * zoomRef.current
        }));
      }
    };

    svg.addEventListener('wheel', handleWheel);
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  const positions = useMemo((): Map<string, Point> => {
    if (nodes.length === 0) return new Map();

    const graph = new SimpleGraph<T, { kind?: string }>();
    for (const node of nodes) {
      graph.addVertex({ id: node.id, data: node.data });
    }

    // Hierarchy layout: only containment edges drive node positioning.
    // Reference edges are rendered as arcs and don't affect layout.
    // Self-referencing edges are excluded from layout to avoid cycles.
    const layoutEdges =
      layout === 'hierarchy'
        ? edges.filter(e => e.kind === 'containment' && e.from !== e.to)
        : edges.filter(e => e.from !== e.to);

    for (const edge of layoutEdges) {
      graph.addEdge({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        weight: 1,
        data: { kind: edge.kind }
      });
    }

    const components = getConnectedComponents(graph);
    const hSpacing = layoutOptions.horizontalSpacing ?? nodeWidth + 40;
    const vSpacing = layoutOptions.verticalSpacing ?? nodeHeight + 60;
    const idealLength = layoutOptions.idealEdgeLength ?? Math.max(nodeWidth, nodeHeight);

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
            crossingMinimizationIterations: layoutOptions.crossingMinimizationIterations ?? 10
          });
          break;
        case 'force':
          componentPositions = layoutForceDirected(graph, [startId], {
            idealEdgeLength: idealLength,
            iterations: layoutOptions.iterations ?? 300,
            springStrength: layoutOptions.springStrength ?? 0.5,
            repulsionStrength: layoutOptions.repulsionStrength ?? 1.0
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

    // For hierarchy layout the edge convention is child → parent, so the layered
    // layout assigns children to layer 0 (top). Flip Y so parents appear at the top.
    if (layout === 'hierarchy' && result.size > 0) {
      const maxY = Math.max(...Array.from(result.values()).map(p => p.y));
      for (const [id, pos] of result) {
        result.set(id, { x: pos.x, y: maxY - pos.y });
      }
    }

    return result;
  }, [nodes, edges, layout, layoutOptions, nodeWidth, nodeHeight]);

  const viewBox = useMemo(() => {
    if (positions.size === 0) return '0 0 400 300';

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of positions.values()) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const vbMinX = minX - nodeWidth / 2 - PADDING;
    const vbMinY = minY - nodeHeight / 2 - PADDING;
    const vbMaxX = maxX + nodeWidth / 2 + PADDING;
    let vbMaxY = maxY + nodeHeight / 2 + PADDING;

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
        vbMaxY = Math.max(vbMaxY, peakY + PADDING);
      }
    }

    return `${vbMinX} ${vbMinY} ${vbMaxX - vbMinX} ${vbMaxY - vbMinY}`;
  }, [positions, nodeWidth, nodeHeight, layout, edges]);

  return (
    <svg
      ref={svgRef}
      className={styles.cDependencyGraph}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/*
          fill="context-stroke" makes the arrowhead inherit the stroke color of
          the line/path that references this marker, avoiding CSS-variable
          resolution issues inside <marker> defs.
        */}
        <marker id="dep-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 Z" style={{ fill: 'context-stroke' }} />
        </marker>
      </defs>

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* Straight edges — rendered before nodes so nodes appear on top */}
        {edges.map(edge => {
          const fromPos = positions.get(edge.from);
          const toPos = positions.get(edge.to);
          if (!fromPos || !toPos) return null;

          // In hierarchy layout, reference edges are rendered as arcs in a later pass
          if (layout === 'hierarchy' && edge.kind !== 'containment') return null;

          if (edge.from === edge.to) {
            return renderSelfLoop(
              edge,
              fromPos,
              nodeWidth,
              nodeHeight,
              styles.eEdge!,
              connectedEdges.has(edge.id),
              true
            );
          }

          const dx = toPos.x - fromPos.x;
          const dy = toPos.y - fromPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return null;

          const [ux, uy] = normalize(dx, dy);
          const trim = rectBorderDist(ux, uy, nodeWidth / 2, nodeHeight / 2);

          const x1 = fromPos.x + ux * trim;
          const y1 = fromPos.y + uy * trim;
          const x2 = toPos.x - ux * (trim + 2);
          const y2 = toPos.y - uy * (trim + 2);

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <g key={edge.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={styles.eEdge}
                data-kind={edge.kind}
                data-highlighted={connectedEdges.has(edge.id)}
                markerEnd="url(#dep-arrow)"
              />
              {edge.label && (
                <text
                  x={midX}
                  y={midY}
                  className={styles.eEdgeLabel}
                  data-highlighted={connectedEdges.has(edge.id)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          return (
            <g
              key={node.id}
              data-node
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => onNodeClick?.(node.id)}
              onContextMenu={
                onNodeContextMenu
                  ? e => {
                      e.preventDefault();
                      onNodeContextMenu(node.id, e);
                    }
                  : undefined
              }
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
            >
              <rect
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                rx={6}
                className={styles.eNodeRect}
                data-selected={highlightedIds?.has(node.id) || undefined}
              />
              <foreignObject
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
              >
                <div
                  // @ts-expect-error xmlns is required for foreignObject content in some renderers
                  xmlns="http://www.w3.org/1999/xhtml"
                  className={styles.eNodeContent}
                >
                  {renderNode(node)}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Arc edges for reference relations in hierarchy layout — rendered after nodes so arcs appear on top */}
        {layout === 'hierarchy' &&
          edges.map(edge => {
            if (edge.kind === 'containment') return null;
            const fromPos = positions.get(edge.from);
            const toPos = positions.get(edge.to);
            if (!fromPos || !toPos) return null;

            if (edge.from === edge.to) {
              return renderSelfLoop(
                edge,
                fromPos,
                nodeWidth,
                nodeHeight,
                styles.eArcEdge!,
                connectedEdges.has(edge.id),
                false
              );
            }

            const x1 = fromPos.x,
              y1 = fromPos.y;
            const x2 = toPos.x,
              y2 = toPos.y;
            const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            if (dist === 0) return null;

            // Control point bows downward (positive Y = below the nodes)
            const cx = (x1 + x2) / 2;
            const arcHeight = Math.max(dist * 0.35, nodeHeight);
            const cy = (y1 + y2) / 2 + arcHeight;

            // Source trim: tangent from source toward the control point
            const [ustx, usty] = normalize(cx - x1, cy - y1);
            const srcTrim = rectBorderDist(ustx, usty, nodeWidth / 2, nodeHeight / 2);

            // Target trim: tangent from the control point toward target
            const [uttx, utty] = normalize(x2 - cx, y2 - cy);
            const dstTrim = rectBorderDist(uttx, utty, nodeWidth / 2, nodeHeight / 2) + 2;

            const sx = x1 + ustx * srcTrim;
            const sy = y1 + usty * srcTrim;
            const ex = x2 - uttx * dstTrim;
            const ey = y2 - utty * dstTrim;

            // Position label at t=0.5 on the quadratic bezier curve
            const t = 0.5;
            const labelX = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
            const labelY = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`}
                  className={styles.eArcEdge}
                  data-highlighted={connectedEdges.has(edge.id)}
                  markerEnd="url(#dep-arrow)"
                />
                {edge.label && (
                  <text
                    x={labelX}
                    y={labelY}
                    className={styles.eEdgeLabel}
                    data-highlighted={connectedEdges.has(edge.id)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
      </g>
    </svg>
  );
};
