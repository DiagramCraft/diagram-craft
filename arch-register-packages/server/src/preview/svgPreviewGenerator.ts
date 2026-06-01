import type {
  SerializedDiagramDocument,
  SerializedLayer,
  SerializedRegularElement,
  SerializedNode,
  SerializedEdge,
  SerializedEndpoint
} from '@diagram-craft/model/serialization/serializedTypes';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import type { Box } from '@diagram-craft/geometry/box';

const MARGIN = 20;

const CSS_VAR_MAP: Record<string, string> = {
  'var(--canvas-fg)': '#000000',
  'var(--canvas-bg)': '#ffffff',
  'var(--canvas-bg2)': '#f0f0f0'
};

const resolveColor = (color: string | undefined, fallback: string): string => {
  if (!color) return fallback;
  if (color.startsWith('var(')) return CSS_VAR_MAP[color] ?? fallback;
  return color;
};

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Shape path builders ──────────────────────────────────────
// Each returns an SVG path string for the given bounds.
// These replicate the getBoundingPathBuilder() logic from the actual node type definitions.

const shapePaths: Record<string, (bounds: Box, props: Record<string, unknown>) => string> = {
  rect: (b) =>
    new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0, 0)).lineTo(_p(1, 0)).lineTo(_p(1, 1)).lineTo(_p(0, 1)).close()
      .getPaths().asSvgPath(),

  'rounded-rect': (b, props) => {
    const radius = (props?.['custom.roundedRect.radius'] as number) ?? Math.min(10, b.w / 4, b.h / 4);
    const xr = Math.min(radius / b.w, 0.5);
    const yr = Math.min(radius / b.h, 0.5);
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(xr, 0)).lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1)
      .getPaths().asSvgPath();
  },

  'icon-rounded-rect': (b, props) => shapePaths['rounded-rect']!(b, props),

  circle: (b) =>
    new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0.5, 0))
      .arcTo(_p(1, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 1), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 0), 0.5, 0.5, 0, 0, 1)
      .getPaths().asSvgPath(),

  diamond: (b) =>
    new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0.5, 0)).lineTo(_p(1, 0.5)).lineTo(_p(0.5, 1)).lineTo(_p(0, 0.5)).close()
      .getPaths().asSvgPath(),

  triangle: (b, props) => {
    const direction = (props?.['custom.triangle.direction'] as string) ?? 'south';
    const pb = new PathListBuilder().withTransform(fromUnitLCS(b));
    switch (direction) {
      case 'east':
        return pb.moveTo(_p(1, 0.5)).lineTo(_p(0, 1)).lineTo(_p(0, 0)).close().getPaths().asSvgPath();
      case 'west':
        return pb.moveTo(_p(0, 0.5)).lineTo(_p(1, 1)).lineTo(_p(1, 0)).close().getPaths().asSvgPath();
      case 'north':
        return pb.moveTo(_p(0.5, 1)).lineTo(_p(0, 0)).lineTo(_p(1, 0)).close().getPaths().asSvgPath();
      default: // south
        return pb.moveTo(_p(0.5, 0)).lineTo(_p(0, 1)).lineTo(_p(1, 1)).close().getPaths().asSvgPath();
    }
  },

  hexagon: (b, props) => {
    const sizePct = ((props?.['custom.hexagon.size'] as number) ?? 25) / 100;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(sizePct, 0)).lineTo(_p(1 - sizePct, 0)).lineTo(_p(1, 0.5))
      .lineTo(_p(1 - sizePct, 1)).lineTo(_p(sizePct, 1)).lineTo(_p(0, 0.5)).close()
      .getPaths().asSvgPath();
  },

  parallelogram: (b, props) => {
    const slant = ((props?.['custom.parallelogram.slant'] as number) ?? 15) / b.w;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(slant, 0)).lineTo(_p(1, 0)).lineTo(_p(1 - slant, 1)).lineTo(_p(0, 1)).close()
      .getPaths().asSvgPath();
  },

  trapezoid: (b, props) => {
    const slantLeft = ((props?.['custom.trapezoid.slantLeft'] as number) ?? 15) / b.w;
    const slantRight = ((props?.['custom.trapezoid.slantRight'] as number) ?? 15) / b.w;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(slantLeft, 0)).lineTo(_p(1 - slantRight, 0)).lineTo(_p(1, 1)).lineTo(_p(0, 1)).close()
      .getPaths().asSvgPath();
  },

  star: (b, props) => {
    const sides = (props?.['custom.star.numberOfSides'] as number) ?? 5;
    const innerRadius = (props?.['custom.star.innerRadius'] as number) ?? 0.4;
    const start = -Math.PI / 2;
    const dTheta = (2 * Math.PI) / sides;
    const pb = new PathListBuilder().withTransform(fromUnitLCS(b)).moveTo(_p(0.5, 0));
    for (let i = 0; i < sides; i++) {
      const angle = start + (i + 1) * dTheta;
      const iAngle = angle - dTheta / 2;
      pb.lineTo(Point.add(_p(0.5, 0.5), Vector.fromPolar(iAngle, innerRadius * 0.5)));
      pb.lineTo(Point.add(_p(0.5, 0.5), Vector.fromPolar(angle, 0.5)));
    }
    return pb.getPaths().asSvgPath();
  },

  'regular-polygon': (b, props) => {
    const sides = (props?.['custom.regularPolygon.numberOfSides'] as number) ?? 6;
    const start = -Math.PI / 2;
    const dTheta = (2 * Math.PI) / sides;
    const pb = new PathListBuilder().withTransform(fromUnitLCS(b)).moveTo(_p(0.5, 0));
    for (let i = 0; i < sides; i++) {
      const angle = start + (i + 1) * dTheta;
      pb.lineTo(Point.add(_p(0.5, 0.5), Vector.fromPolar(angle, 0.5)));
    }
    return pb.getPaths().asSvgPath();
  },

  delay: (b) => {
    const xr = (0.5 * b.h) / b.w;
    const yr = 0.5;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0, 0)).lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(0, 1)).close()
      .getPaths().asSvgPath();
  },

  document: (b) => {
    const size = 0.3;
    const k = 1.5;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0, 0)).lineTo(_p(1, 0)).lineTo(_p(1, 1 - size / 2))
      .quadTo(_p(0.5, 1 - size / 2), _p(3 / 4, 1 - size * k))
      .quadTo(_p(0, 1 - size / 2), _p(1 / 4, 1 - size * (1 - k)))
      .lineTo(_p(0, size / 2)).close()
      .getPaths().asSvgPath();
  },

  step: (b, props) => {
    const sizePct = ((props?.['custom.step.size'] as number) ?? 20) / b.w;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0, 0)).lineTo(_p(1 - sizePct, 0)).lineTo(_p(1, 0.5))
      .lineTo(_p(1 - sizePct, 1)).lineTo(_p(0, 1)).lineTo(_p(sizePct, 0.5)).close()
      .getPaths().asSvgPath();
  },

  cylinder: (b, props) => {
    const size = ((props?.['custom.cylinder.size'] as number) ?? 30) / b.h;
    const sizePct = Math.min(size, 0.45);
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0, sizePct))
      .arcTo(_p(0.5, 0), 0.5, sizePct, 0, 0, 1)
      .arcTo(_p(1, sizePct), 0.5, sizePct, 0, 0, 1)
      .lineTo(_p(1, 1 - sizePct))
      .arcTo(_p(0.5, 1), 0.5, sizePct, 0, 0, 0)
      .arcTo(_p(0, 1 - sizePct), 0.5, sizePct, 0, 0, 0)
      .close()
      .getPaths().asSvgPath();
  },

  cube: (b, props) => {
    const sizePct = ((props?.['custom.cube.size'] as number) ?? 20) / Math.min(b.w, b.h);
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(0, sizePct)).lineTo(_p(sizePct, 0)).lineTo(_p(1, 0))
      .lineTo(_p(1, 1 - sizePct)).lineTo(_p(1 - sizePct, 1)).lineTo(_p(0, 1)).close()
      .getPaths().asSvgPath();
  },

  arrow: (b, props) => {
    const x = ((props?.['custom.arrow.x'] as number) ?? 30) / b.w;
    const y = ((props?.['custom.arrow.y'] as number) ?? 30) / 100;
    const notch = ((props?.['custom.arrow.notch'] as number) ?? 0) / b.w;
    return new PathListBuilder()
      .withTransform(fromUnitLCS(b))
      .moveTo(_p(1, 0.5)).lineTo(_p(1 - x, 1)).lineTo(_p(1 - x, 1 - y))
      .lineTo(_p(0, 1 - y)).lineTo(_p(notch, 0.5)).lineTo(_p(0, y))
      .lineTo(_p(1 - x, y)).lineTo(_p(1 - x, 0)).close()
      .getPaths().asSvgPath();
  },
};

// Direction-specific arrow variants share the same arrow path with rotation
for (const dir of ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down']) {
  shapePaths[dir] = shapePaths['arrow']!;
}

// ── Custom properties extraction ─────────────────────────────

const extractCustomProps = (node: SerializedNode): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const custom = (node.props as Record<string, unknown>)?.['custom'] as Record<string, unknown> | undefined;
  if (!custom) return result;

  for (const [ns, values] of Object.entries(custom)) {
    if (values && typeof values === 'object') {
      for (const [key, val] of Object.entries(values as Record<string, unknown>)) {
        result[`custom.${ns}.${key}`] = val;
      }
    }
  }
  return result;
};

// ── Endpoint resolution ──────────────────────────────────────

const getEndpointPosition = (
  endpoint: SerializedEndpoint,
  nodeMap: Map<string, SerializedNode>
): { x: number; y: number } | null => {
  if ('position' in endpoint && endpoint.position) {
    return endpoint.position;
  }
  if ('node' in endpoint && endpoint.node) {
    const node = nodeMap.get(endpoint.node.id);
    if (node) {
      return { x: node.bounds.x + node.bounds.w / 2, y: node.bounds.y + node.bounds.h / 2 };
    }
  }
  return null;
};

const collectNodes = (
  elements: ReadonlyArray<SerializedRegularElement>,
  map: Map<string, SerializedNode>
) => {
  for (const el of elements) {
    if (el.type === 'node') {
      map.set(el.id, el);
      if (el.children) collectNodes(el.children, map);
    }
  }
};

// ── Node rendering ───────────────────────────────────────────

const renderNode = (node: SerializedNode, nodeMap: Map<string, SerializedNode>): string => {
  if (node.props?.hidden) return '';

  const { x, y, w, h, r } = node.bounds;
  const fill = node.props?.fill;
  const stroke = node.props?.stroke;
  const opacity = node.props?.effects?.opacity;

  const fillColor = fill?.enabled !== false ? resolveColor(fill?.color, '#ffffff') : 'none';
  const strokeColor = stroke?.enabled !== false ? resolveColor(stroke?.color, '#000000') : 'none';
  const strokeWidth = stroke?.enabled !== false ? (stroke?.width ?? 1) : 0;
  const opacityAttr = opacity !== undefined && opacity < 1 ? ` opacity="${opacity}"` : '';

  const nodeType = node.nodeType ?? 'rect';

  // Groups/containers render children
  if (nodeType === 'group' || nodeType === 'container') {
    const childrenSvg = node.children
      ? (node.children as SerializedRegularElement[])
          .flatMap(child => {
            if (child.type === 'node') return renderNode(child, nodeMap);
            if (child.type === 'edge') return renderEdge(child, nodeMap);
            return '';
          })
          .join('')
      : '';

    const transform = r ? ` transform="rotate(${(r * 180) / Math.PI} ${x + w / 2} ${y + h / 2})"` : '';
    return `<g${transform}${opacityAttr}><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>${childrenSvg}</g>`;
  }

  // Build shape path
  const customProps = extractCustomProps(node);
  const pathFn = shapePaths[nodeType];
  const boundsNoRotation: Box = { x, y, w, h, r: 0 };

  let shapeSvg: string;
  if (pathFn) {
    const pathData = pathFn(boundsNoRotation, customProps);
    const transform = r ? ` transform="rotate(${(r * 180) / Math.PI} ${x + w / 2} ${y + h / 2})"` : '';
    shapeSvg = `<path d="${pathData}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${transform}${opacityAttr}/>`;
  } else {
    // Fallback: render as rectangle
    const transform = r ? ` transform="rotate(${(r * 180) / Math.PI} ${x + w / 2} ${y + h / 2})"` : '';
    shapeSvg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${transform}${opacityAttr}/>`;
  }

  // Add text label
  const text = node.texts?.text;
  if (text) {
    const fontSize = Math.max(8, Math.min(14, h * 0.3));
    const truncated = text.length > 30 ? `${text.slice(0, 27)}...` : text;
    shapeSvg += `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family="sans-serif" fill="${resolveColor(stroke?.color, '#000000')}"${opacityAttr}>${escapeXml(truncated)}</text>`;
  }

  return shapeSvg;
};

// ── Edge rendering ───────────────────────────────────────────

const renderEdge = (
  edge: SerializedEdge,
  nodeMap: Map<string, SerializedNode>
): string => {
  if (edge.props?.hidden) return '';

  const startPos = getEndpointPosition(edge.start, nodeMap);
  const endPos = getEndpointPosition(edge.end, nodeMap);
  if (!startPos || !endPos) return '';

  const stroke = edge.props?.stroke;
  const strokeColor = stroke?.enabled !== false ? resolveColor(stroke?.color, '#000000') : 'none';
  const strokeWidth = stroke?.enabled !== false ? (stroke?.width ?? 1) : 0;
  const opacity = edge.props?.effects?.opacity;
  const opacityAttr = opacity !== undefined && opacity < 1 ? ` opacity="${opacity}"` : '';

  if (edge.waypoints && edge.waypoints.length > 0) {
    const allPoints = [startPos, ...edge.waypoints.map(wp => wp.point), endPos];
    const pointsStr = allPoints.map(p => `${p.x},${p.y}`).join(' ');
    return `<polyline points="${pointsStr}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr}/>`;
  }

  return `<line x1="${startPos.x}" y1="${startPos.y}" x2="${endPos.x}" y2="${endPos.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr}/>`;
};

// ── Bounding box computation ─────────────────────────────────

const expandBounds = (
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number
) => {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
};

const computeBounds = (
  elements: ReadonlyArray<SerializedRegularElement>,
  nodeMap: Map<string, SerializedNode>
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let hasElements = false;

  for (const el of elements) {
    if (el.type === 'node') {
      if (el.props?.hidden) continue;
      const { x, y, w, h } = el.bounds;
      expandBounds(b, x, y);
      expandBounds(b, x + w, y + h);
      hasElements = true;

      if (el.children) {
        const childBounds = computeBounds(el.children, nodeMap);
        if (childBounds) {
          expandBounds(b, childBounds.minX, childBounds.minY);
          expandBounds(b, childBounds.maxX, childBounds.maxY);
        }
      }
    } else if (el.type === 'edge') {
      if (el.props?.hidden) continue;
      const startPos = getEndpointPosition(el.start, nodeMap);
      const endPos = getEndpointPosition(el.end, nodeMap);
      if (startPos) { expandBounds(b, startPos.x, startPos.y); hasElements = true; }
      if (endPos) { expandBounds(b, endPos.x, endPos.y); hasElements = true; }
      if (el.waypoints) {
        for (const wp of el.waypoints) {
          expandBounds(b, wp.point.x, wp.point.y);
        }
      }
    }
  }

  return hasElements ? b : null;
};

// ── Main entry point ─────────────────────────────────────────

export const generateSvgPreview = (doc: SerializedDiagramDocument): string | null => {
  if (!doc.diagrams || doc.diagrams.length === 0) return null;

  const diagram = doc.diagrams[0]!;
  const regularLayers = diagram.layers.filter(
    (layer): layer is SerializedLayer & { layerType: 'regular' | 'basic' } =>
      'elements' in layer && (layer.layerType === 'regular' || layer.layerType === 'basic')
  );

  const allElements = regularLayers.flatMap(layer => layer.elements);
  if (allElements.length === 0) return null;

  const nodeMap = new Map<string, SerializedNode>();
  collectNodes(allElements, nodeMap);

  const bounds = computeBounds(allElements, nodeMap);
  if (!bounds) return null;

  const vx = bounds.minX - MARGIN;
  const vy = bounds.minY - MARGIN;
  const vw = bounds.maxX - bounds.minX + 2 * MARGIN;
  const vh = bounds.maxY - bounds.minY + 2 * MARGIN;

  // Render edges first (behind nodes), then nodes
  const edgeSvg: string[] = [];
  const nodeSvg: string[] = [];

  const processElements = (elements: ReadonlyArray<SerializedRegularElement>) => {
    for (const el of elements) {
      if (el.type === 'edge') {
        edgeSvg.push(renderEdge(el, nodeMap));
      } else if (el.type === 'node') {
        nodeSvg.push(renderNode(el, nodeMap));
      }
    }
  };

  for (const layer of regularLayers) {
    processElements(layer.elements);
  }

  const content = [...edgeSvg, ...nodeSvg].filter(Boolean).join('\n');
  if (!content) return null;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}">\n${content}\n</svg>`;
};
