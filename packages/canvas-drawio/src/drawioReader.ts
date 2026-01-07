import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode, NodeTexts, SimpleDiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramEdge, SimpleDiagramEdge, Waypoint } from '@diagram-craft/model/diagramEdge';
import { DiagramElement, isEdge } from '@diagram-craft/model/diagramElement';
import { FreeEndpoint, PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { Point } from '@diagram-craft/geometry/point';
import { assert, mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { clipPath } from '@diagram-craft/model/diagramEdgeUtils';
import {
  assertHAlign,
  assertVAlign,
  type EdgeProps,
  type ElementMetadata,
  type NodeProps
} from '@diagram-craft/model/diagramProps';
import { Angle } from '@diagram-craft/geometry/angle';
import { Line } from '@diagram-craft/geometry/line';
import { newid } from '@diagram-craft/utils/id';
import {
  parseDiamond,
  parseEllipse,
  parseImage,
  parseLine,
  parseRoundedRect,
  parseSwimlane,
  parseTriangle
} from './shapes/basicShapes';
import { StyleManager } from './styleManager';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { xIterElements, xNum } from '@diagram-craft/utils/xml';
import { parseNum } from '@diagram-craft/utils/number';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { getParser, shapeParsers } from './drawioShapeParserRegistry';
import { safeSplit } from '@diagram-craft/utils/safe';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { WorkQueue } from './workQueue';
import { arrows, drawioBuiltinShapes, LABEL_POSITIONS } from './drawioDefaults';
import { getShapeBundle, loadShapeBundle } from './drawioShapeBundleRegistry';
import {
  angleFromDirection,
  deflate,
  hasValue,
  isHTML,
  isStencilString,
  MxGeometry,
  MxPoint,
  parseStencilString
} from './drawioReaderUtils';
import { sanitizeHtml } from '@diagram-craft/utils/dom';

type Parent = RegularLayer | DiagramNode | DiagramEdge;

type CellElements = {
  $cell: Element;
  $parent: Element;
  $geometry: Element;
};

type CellContext = {
  parents: Map<string, Parent>;
  queue: WorkQueue;
  uow: UnitOfWork;
};

const calculateLabelNodeActualSize = (
  style: StyleManager,
  textNode: DiagramNode,
  value: string,
  uow: UnitOfWork
) => {
  const $el = document.createElement('div');
  $el.style.visibility = 'hidden';
  $el.style.position = 'absolute';
  $el.style.width = 'auto';
  $el.style.lineHeight = '0';
  document.body.appendChild($el);

  const css = [
    `font-size: ${style.num('fontSize', 12)}px`,
    `font-family: ${style.str('fontFamily') ?? 'Helvetica'}`,
    'direction: ltr',
    'line-height: 120%',
    'color: black'
  ].join(';');

  $el.innerHTML = sanitizeHtml(
    value.startsWith('<') ? value : `<span style="${css}">${value}</span>`
  );

  textNode.setBounds(
    {
      x: textNode.bounds.x,
      y: textNode.bounds.y,
      // TODO: Need to tune this a bit better
      w: $el.offsetWidth + 1,
      h: $el.offsetHeight,
      r: 0
    },
    uow
  );

  document.body.removeChild($el);
};

const createLabelNode = (
  id: string,
  edge: DiagramEdge,
  text: string,
  props: NodeProps,
  bgColor: string
) => {
  return ElementFactory.node(
    id,
    'text',
    edge.bounds,
    edge.layer,
    {
      text: {
        align: props.text?.align,
        valign: props.text?.valign,
        fontSize: props.text?.fontSize,
        font: props.text?.font
      },
      fill: {
        enabled: true,
        type: 'solid',
        color: bgColor
      }
    },
    {},
    { text }
  );
};

const attachLabelNode = (
  textNode: DiagramNode,
  edge: DiagramEdge,
  $geometry: Element,
  uow: UnitOfWork
) => {
  // The x coordinate represent the offset along the path, encoded as a number
  // between -1 and 1 - we need to convert to a number between 0 and 1
  const xOffset = (xNum($geometry, 'x', 0) + 1) / 2;

  const path = edge.path();
  if (path.length() === 0) {
    console.error('Path has zero length', path);
    return;
  }

  const clippedPath = clipPath(path, edge, undefined, undefined)!;

  // Since drawio uses a position on the clipped path, we convert the offset to a
  // point (x, y) on the path
  const lengthOffsetOnClippedPath = TimeOffsetOnPath.toLengthOffsetOnPath(
    { pathT: xOffset },
    clippedPath
  );
  const anchorPoint = clippedPath.pointAt(lengthOffsetOnClippedPath);

  // ... and then we convert this to a time offset on the full path (as this is the
  // representation we use
  const { pathT: timeOffset } = LengthOffsetOnPath.toTimeOffsetOnPath(
    path.projectPoint(anchorPoint),
    path
  );

  // In drawio, the y coordinate represents an offset along the normal at
  // the point described by the x-coordinate

  // So first we calculate the normal at this point
  const tangent = clippedPath.tangentAt(lengthOffsetOnClippedPath);
  const normal = Point.rotate(tangent, Math.PI / 2);

  // Then we calculate a vector from the point of the path to the
  // point described by the y-coordinate
  const initialOffset = Vector.scale(normal, -xNum($geometry, 'y', 0));

  // In draw io there's a second offset from the point calculated above
  const mxPointOffset = Array.from($geometry.getElementsByTagName('mxPoint')).find(
    e => e.getAttribute('as') === 'offset'
  );

  // We describe the label node location as a time offset on the path (0 - 1) and then
  // an offset from this point - this is essentially the sum as the two drawio offsets
  const offset = mxPointOffset
    ? Point.add(MxPoint.pointFrom(mxPointOffset), initialOffset)
    : Point.ORIGIN;

  edge.addLabelNode(
    { id: textNode.id, type: 'horizontal', node: () => textNode, offset, timeOffset },
    uow
  );
};

const attachEdge = (edge: DiagramEdge, $cell: Element, style: StyleManager, uow: UnitOfWork) => {
  const diagram = edge.diagram;

  const source = $cell.getAttribute('source');
  if (source) {
    const sourceNode = diagram.nodeLookup.get(source);
    if (sourceNode) {
      edge.setStart(
        new PointInNodeEndpoint(
          sourceNode,
          Point.of(style.num('exitX', 0.5), style.num('exitY', 0.5)),
          Point.of(style.num('exitDx', 0), style.num('exitDy', 0)),
          'absolute'
        ),
        uow
      );
    }
  }

  const target = $cell.getAttribute('target');
  if (target) {
    const targetNode = diagram.nodeLookup.get(target);
    if (targetNode) {
      edge.setEnd(
        new PointInNodeEndpoint(
          targetNode,
          Point.of(style.num('entryX', 0.5), style.num('entryY', 0.5)),
          Point.of(style.num('entryDx', 0), style.num('entryDy', 0)),
          'absolute'
        ),
        uow
      );
    }
  }
};

const parseNodeProps = (style: StyleManager, isEdge: boolean) => {
  const align = style.str('align');
  assertHAlign(align);

  const valign = style.str('verticalAlign');
  assertVAlign(valign);

  const props: NodeProps = {
    text: {
      fontSize: style.num('fontSize', isEdge ? 11 : 12),
      font: style.str('fontFamily', 'Helvetica'),
      color: style.str('fontColor', 'black'),
      lineHeight: 0.97,

      // Note, it seems drawio applies a special spacing of 5 and 1 in addition
      // to the base spacing in case vertical alignment is top or bottom
      top: style.num('spacingTop') + style.num('spacing') + (valign === 'top' ? 5 : 0),
      bottom: style.num('spacingBottom') + style.num('spacing') + (valign === 'bottom' ? 1 : 0),

      left: style.num('spacingLeft') + style.num('spacing'),
      right: style.num('spacingRight') + style.num('spacing'),
      align: align,
      valign: valign,

      position:
        LABEL_POSITIONS[style.str('labelPosition', 'center')]![
          style.str('verticalLabelPosition', 'middle')
        ]
    },
    fill: {
      color: style.str('fillColor', 'white')
    },
    geometry: {
      // Not sure checking if the object has a shape is correct
      // This is a workaround as flipping a shape doesn't flip the text?
      flipH: style.has('shape') && style.is('flipH'),
      flipV: style.has('shape') && style.is('flipV')
    },
    capabilities: {
      inheritStyle: false
    }
  };
  props.text ??= {};
  props.fill ??= {};

  if (style.num('perimeterSpacing', 0) !== 0) {
    props.routing ??= {};
    props.routing.spacing = style.num('perimeterSpacing', 0);
  }

  if (style.str('portConstraint') !== undefined) {
    props.routing ??= {};
    if (style.str('portConstraint') === 'north') props.routing.constraint = 'n';
    if (style.str('portConstraint') === 'south') props.routing.constraint = 's';
    if (style.str('portConstraint') === 'east') props.routing.constraint = 'e';
    if (style.str('portConstraint') === 'west') props.routing.constraint = 'w';
  }

  if (props.text.color === '#') props.text.color = 'black';

  const fontStyle = style.num('fontStyle', 0);
  props.text.bold = (fontStyle & 1) !== 0;
  props.text.italic = (fontStyle & 2) !== 0;
  props.text.textDecoration = (fontStyle & 4) !== 0 ? 'underline' : 'none';

  props.text.wrap = style.str('whiteSpace') === 'wrap';
  props.text.overflow =
    style.str('overflow') === 'hidden' ||
    style.str('overflow') === 'fill' ||
    style.str('overflow') === 'width'
      ? 'hidden'
      : 'visible';

  if (style.str('overflow') === 'fill' || style.str('overflow') === 'width') {
    props.text.top = 0;
    props.text.bottom = 0;
    props.text.left = 0;
    props.text.right = 0;
  }

  if (
    style.has('gradientColor') &&
    style.str('gradientColor') !== 'none' &&
    style.str('gradientColor') !== 'inherit'
  ) {
    props.fill.type = 'gradient';
    props.fill.color2 = style.str('gradientColor');
    props.fill.gradient = {
      type: 'linear',
      direction: angleFromDirection(style.str('gradientDirection') ?? 'south')
    };
  }

  if (style.num('opacity', 100) !== 100) {
    props.effects ??= {};
    props.effects.opacity = style.num('opacity', 100) / 100;
  }

  if (style.is('sketch')) {
    props.effects ??= {};
    props.effects.sketch = true;
    props.effects.sketchFillType = 'hachure';
  }

  if (style.is('glass')) {
    props.effects ??= {};
    props.effects.glass = true;
  }

  props.stroke = {
    color: style.str('strokeColor'),
    width: style.num('strokeWidth', 1)
  };

  if (style.is('dashed')) {
    const pattern: string = style.str('dashPattern') ?? '4 4';
    const [baseSize, baseGap] = safeSplit(pattern, ' ', 2).map(s => parseNum(s, 4)) as [
      number,
      number
    ];
    const strokeWidth = style.num('strokeWidth', 1);

    props.stroke.pattern = 'DASHED';
    props.stroke.patternSpacing = baseGap * 10 * strokeWidth;
    props.stroke.patternSize = baseSize * 10 * strokeWidth;
    props.stroke.lineCap = 'butt';
  }

  if (style.is('rounded')) {
    props.effects ??= {};
    props.effects.rounding = true;
    props.effects.roundingAmount = style.num('arcSize', nodeDefaults.get('effects.roundingAmount'));
  }

  if (style.is('shadow')) {
    props.shadow = { enabled: true, color: '#999999', x: 3, y: 3, blur: 3 };
  }

  if (!style.is('rotatable', true)) {
    props.capabilities ??= {};
    props.capabilities.rotatable = false;
  }

  if (!style.is('resizable', true)) {
    props.capabilities ??= {};
    props.capabilities.resizable = {
      vertical: false,
      horizontal: false
    };
  }

  if (!style.is('movable', true)) {
    props.capabilities ??= {};
    props.capabilities.movable = false;
  }

  if (!style.is('editable', true)) {
    props.capabilities ??= {};
    props.capabilities.editable = false;
  }

  if (!style.is('deletable', true)) {
    props.capabilities ??= {};
    props.capabilities.deletable = false;
  }

  if (style.has('indicatorShape')) {
    let shape = style.get('indicatorShape');
    if (shape === 'ellipse') shape = 'disc';

    const directionS = style.str('indicatorDirection', 'east');
    let direction: 'n' | 's' | 'e' | 'w' = 'e';
    if (directionS === 'east') direction = 'e';
    if (directionS === 'west') direction = 'w';
    if (directionS === 'north') direction = 'n';
    if (directionS === 'south') direction = 's';

    props.indicators = {
      _default: {
        enabled: true,
        shape: shape,
        color: style.str('indicatorColor', 'black'),
        direction: direction,
        width: style.num('indicatorWidth', 10),
        height: style.num('indicatorHeight', 10)
      }
    };
  }

  return props;
};

const parseParentChildRelations = ($$cells: HTMLCollectionOf<Element>, rootId: string) => {
  const parentChild = new MultiMap<string, string>();
  for (const $cell of xIterElements($$cells)) {
    const parent = $cell.getAttribute('parent');
    if (parent && parent !== rootId) {
      const id = $cell.getAttribute('id');
      if (id) parentChild.add(parent, id);
    }
  }
  return parentChild;
};

const parseEdgeArrow = (t: 'start' | 'end', style: StyleManager, props: EdgeProps & NodeProps) => {
  let type = style.get(`${t}Arrow`);
  const size = style.get(`${t}Size`);
  const fill = style.get(`${t}Fill`);

  if (type && type !== 'none') {
    if (fill === '0') {
      type += '-outline';
    }

    if (!(type in arrows)) {
      console.warn(`Arrow type ${type} not yet supported`);
    }

    props.arrow ??= {};
    props.arrow[t] = {
      type: arrows[type],
      size: parseNum(size, 6) * (type === 'circle' || type === 'circlePlus-outline' ? 20 : 11)
    };
    props.stroke!.color ??= 'black';
    if (props.stroke!.color === 'default') {
      props.stroke!.color = 'black';
    }
    props.fill!.color = props.stroke!.color;
  }
};

const parseMetadata = ($parent: Element) => {
  const dest: Record<string, string> = {};
  for (const n of $parent.getAttributeNames()) {
    if (n === 'id' || n === 'label' || n === 'placeholders') continue;

    const value = $parent.getAttribute(n);
    if (value) dest[n] = value;
  }
  return dest;
};

const applyRotation = (bounds: Box, style: StyleManager) => {
  const dir = style.str('direction');
  switch (dir) {
    case 'south': {
      const p = Point.rotateAround(
        Point.add(bounds, { x: 0, y: bounds.w }),
        Math.PI / 2,
        Point.add(bounds, { x: bounds.h / 2, y: bounds.w / 2 })
      );

      return {
        w: bounds.h,
        h: bounds.w,
        r: Math.PI / 2,
        x: bounds.x + (bounds.x - p.x),
        y: bounds.y + (bounds.y - p.y)
      };
    }
    case 'north': {
      const p = Point.rotateAround(
        Point.add(bounds, { x: bounds.h, y: 0 }),
        -Math.PI / 2,
        Point.add(bounds, { x: bounds.h / 2, y: bounds.w / 2 })
      );

      return {
        w: bounds.h,
        h: bounds.w,
        r: -Math.PI / 2,
        x: bounds.x + (bounds.x - p.x),
        y: bounds.y + (bounds.y - p.y)
      };
    }
    case 'west':
      return { ...bounds, r: Math.PI };
    default:
      return bounds;
  }
};

const parseShape = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer,
  { queue }: CellContext
): Promise<DiagramNode> => {
  const diagram = layer.diagram;
  if (style.shape! in shapeParsers) {
    const parser = mustExist(shapeParsers[style.shape!]);
    return await parser(id, bounds, props, metadata, texts, style, layer, queue);
  } else if (style.styleName === 'image' || style.has('image')) {
    return await parseImage(id, bounds, props, metadata, texts, style, layer, queue);
  } else if (style.shape?.startsWith('mxgraph.') || getShapeBundle(style.shape) !== undefined) {
    const registry = diagram.document.nodeDefinitions;

    const bundle = getShapeBundle(style.shape);
    if (!bundle) {
      console.warn(`No bundle found for ${style.shape}`);
      return ElementFactory.node(id, 'rect', bounds, layer, props, metadata, texts);
    }

    if (!registry.hasRegistration(style.shape!)) {
      await loadShapeBundle(bundle, registry);
    }

    const newBounds = applyRotation(bounds, style);

    const parser = getParser(style.shape);
    if (parser) {
      return await parser(id, newBounds, props, metadata, texts, style, layer, queue);
    } else {
      return ElementFactory.node(id, style.shape!, newBounds, layer, props, metadata, texts);
    }
  } else if (style.styleName === 'triangle') {
    return await parseTriangle(id, bounds, props, metadata, texts, style, layer);
  } else if (style.styleName === 'line') {
    return await parseLine(id, bounds, props, metadata, texts, style, layer);
  } else if (style.styleName === 'ellipse') {
    return await parseEllipse(id, bounds, props, metadata, texts, style, layer);
  } else if (style.styleName === 'rhombus') {
    return await parseDiamond(id, bounds, props, metadata, texts, style, layer);
  } else {
    if (style.is('rounded')) {
      return await parseRoundedRect(id, bounds, props, metadata, texts, style, layer);
    } else {
      return ElementFactory.node(id, 'rect', bounds, layer, props, metadata, texts);
    }
  }
};

const parseText = (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer
) => {
  if (style.str('strokeColor', 'none') === 'none') {
    props.stroke!.enabled = false;
  }

  if (style.str('fillColor', 'none') === 'none') {
    props.fill!.enabled = false;
  }

  props.capabilities ??= {};
  props.capabilities.adjustSizeBasedOnText = true;

  return ElementFactory.node(id, 'rect', bounds, layer, props, metadata, texts);
};

const parseLabelNode = (
  id: string,
  props: NodeProps,
  style: StyleManager,
  diagram: Diagram,
  parent: string,
  value: string,
  $geometry: Element,
  { queue, uow }: CellContext
) => {
  // Handle free-standing edge labels
  const edge = mustExist(diagram.edgeLookup.get(parent));

  const textNode = createLabelNode(id, edge, value, props, '#ffffff');

  // Note: This used to be done with queue.add - unclear why
  attachLabelNode(textNode, edge, $geometry, uow);

  queue.add(() => calculateLabelNodeActualSize(style, textNode, value, uow));
  queue.add(() => edge.invalidate(uow), 1);
};

const parseEdge = (
  id: string,
  props: NodeProps,
  metadata: ElementMetadata,
  style: StyleManager,
  layer: RegularLayer,
  parents: Map<string, Parent>,
  isWrappedByObject: boolean,
  { $cell, $geometry, $parent }: CellElements,
  { queue, uow }: CellContext
) => {
  // Handle edge creation

  // First create the node with free endpoints as the position of all connected
  // nodes are not known at this time

  const points = Array.from($geometry.getElementsByTagName('mxPoint')).map($p => ({
    ...MxPoint.pointFrom($p),
    as: $p.getAttribute('as')
  }));

  const source = new FreeEndpoint(points.find(p => p.as === 'sourcePoint') ?? Point.ORIGIN);
  const target = new FreeEndpoint(points.find(p => p.as === 'targetPoint') ?? Point.ORIGIN);

  parseEdgeArrow('start', style, props);

  // Note, apparently the lack of an arrow specified, means by default a
  // classic end arrow is assumed
  if (!style.has('endArrow')) style.set('endArrow', 'classic');
  parseEdgeArrow('end', style, props);

  const edgeProps = props as EdgeProps;

  const isNonCurveEdgeStyle =
    style.str('edgeStyle') === 'orthogonalEdgeStyle' ||
    style.str('edgeStyle') === 'elbowEdgeStyle' ||
    style.str('edgeStyle') === 'isometricEdgeStyle' ||
    style.str('edgeStyle') === 'entityRelationEdgeStyle';

  if (isNonCurveEdgeStyle) {
    edgeProps.type = 'orthogonal';
  }

  if (style.is('curved')) {
    if (isNonCurveEdgeStyle) {
      edgeProps.type = 'curved';
    } else {
      edgeProps.type = 'bezier';
    }
  }

  if (style.num('sourcePerimeterSpacing', 0) !== 0) {
    edgeProps.spacing ??= {};
    edgeProps.spacing.start = style.num('sourcePerimeterSpacing', 0);
  }

  if (style.num('targetPerimeterSpacing', 0) !== 0) {
    edgeProps.spacing ??= {};
    edgeProps.spacing.end = style.num('targetPerimeterSpacing', 0);
  }

  if (style.num('perimeterSpacing', 0) !== 0) {
    edgeProps.spacing ??= {};
    edgeProps.spacing.start = style.num('perimeterSpacing', 0);
    edgeProps.spacing.end = style.num('perimeterSpacing', 0);
  }

  if (style.shape === 'flexArrow') {
    edgeProps.shape = 'BlockArrow';
    edgeProps.custom ??= {};
    edgeProps.custom.blockArrow = {
      width: style.num('width', 10),
      arrowWidth: style.num('width', 10) + style.num('endWidth', 20),
      arrowDepth: style.num('endSize', 7) * 3
    };
    edgeProps.fill = {
      color: style.str('fillColor') ?? 'none'
    };
    edgeProps.effects = {
      opacity: style.has('opacity') ? style.num('opacity', 100) / 100 : 1
    };
  }

  const waypoints: Waypoint[] = [];
  const wps = Array.from(
    $geometry.getElementsByTagName('Array').item(0)?.getElementsByTagName('mxPoint') ?? []
  ).map($p => MxPoint.pointFrom($p));
  for (let i = 0; i < wps.length; i++) {
    if (edgeProps.type === 'bezier') {
      if (i === wps.length - 1) continue;

      // TODO: Maybe we should apply BezierUtils.qubicFromThreePoints here
      //       ...to smoothen the curve further

      const next = wps[i + 1]!;
      const midpoint = Line.midpoint(Line.of(wps[i]!, next));
      waypoints.push({
        point: midpoint,
        controlPoints: {
          cp1: Vector.scale(Point.subtract(wps[i]!, midpoint), 1),
          cp2: Vector.scale(Point.subtract(wps[i + 1]!, midpoint), 1)
        }
      });
    } else {
      // Some times the waypoints are duplicated, so we need to filter them out
      if (i > 0 && Point.isEqual(wps[i]!, wps[i - 1]!)) continue;
      waypoints.push({ point: wps[i]! });
    }
  }

  if (style.is('orthogonal')) {
    edgeProps.type = 'orthogonal';
  }

  const edge = ElementFactory.edge(id, source, target, edgeProps, metadata, waypoints, layer);
  parents.set(id, edge);

  // Post-pone attaching the edge to the source and target nodes until all
  // nodes have been processed
  queue.add(() => attachEdge(edge, $cell, style, uow));

  const value = isWrappedByObject ? $parent.getAttribute('label') : $cell.getAttribute('value');

  if (hasValue(value)) {
    props.stroke!.enabled = false;

    const labelBg = style.str('labelBackgroundColor') ?? 'transparent';

    const textNode = createLabelNode(`${id}-label`, edge, value, props, labelBg);

    queue.add(() => attachLabelNode(textNode, edge, $geometry, uow));
    queue.add(() => calculateLabelNodeActualSize(style, textNode, value, uow));
    queue.add(() => edge.invalidate(uow), 1);
  }

  return edge;
};

const parseStencil = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: { text: string } & Record<string, string>,
  style: StyleManager,
  layer: RegularLayer
) => {
  const stencil = mustExist(parseStencilString(drawioBuiltinShapes[style.shape!] ?? style.shape));
  props.custom ??= {};
  props.custom.drawio = { shape: btoa(await deflate(stencil)) };
  return ElementFactory.node(id, 'drawio', bounds, layer, props, metadata, texts);
};

const parseGroup = async (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: RegularLayer,
  { $geometry, $cell }: CellElements,
  ctx: CellContext
) => {
  const { parents, uow, queue } = ctx;
  const value = $cell.getAttribute('value');
  let node: DiagramNode;

  if (style.shape === 'table' || style.shape === 'tableRow') {
    const parser = mustExist(getParser(style.shape));
    node = await parser(id, bounds, props, metadata, texts, style, layer, queue);
    // TODO: Support more than stackLayout
  } else if (style.styleName === 'swimlane' && style.str('childLayout') === 'stackLayout') {
    node = await parseSwimlane(id, bounds, props, metadata, texts, style, layer);
  } else if (isStencilString(drawioBuiltinShapes[style.shape!] ?? style.shape)) {
    node = await parseStencil(id, bounds, props, metadata, texts, style, layer);
  } else if (style.num('container') === 1) {
    const $alternateBoundsRect = $geometry.getElementsByTagName('mxRectangle').item(0);

    const grp = await parseShape(id, bounds, props, metadata, texts, style, layer, ctx);

    const mode = $cell.getAttribute('collapsed') === '1' ? 'collapsed' : 'expanded';
    node = ElementFactory.node(
      id,
      'container',
      bounds,
      layer,
      {
        ...props,
        custom: {
          ...grp.storedProps.custom,
          _collapsible: {
            mode,
            collapsible: true
          },
          container: {
            ...($alternateBoundsRect
              ? {
                  bounds: `${$alternateBoundsRect.getAttribute('x')},${$alternateBoundsRect.getAttribute('y')},${$alternateBoundsRect.getAttribute('width')},${$alternateBoundsRect.getAttribute('height')},0`
                }
              : {}),
            shape: grp.nodeType
          }
        }
      },
      metadata,
      texts
    );
  } else {
    node = ElementFactory.node(id, 'group', bounds, layer, props, metadata, texts);

    if (
      style.styleName !== 'group' &&
      (style.has('fillColor') || style.has('strokeColor') || value || style.shape)
    ) {
      const grp = await parseShape(newid(), bounds, props, metadata, texts, style, layer, ctx);

      node.addChild(grp, uow);
      queue.add(() => grp.setBounds(node!.bounds, uow));
    }
  }

  parents.set(id, node);
  return node;
};

const parseLabelStyles = (texts: NodeTexts, style: StyleManager) => {
  // We don't support label styles natively, so simulate using a wrapping span. Note, we only do this in case the
  // text itself is not an HTML formatted
  if (!isHTML(texts.text) && texts.text !== '') {
    const spanStyles: string[] = [];
    const divStyles: string[] = [];
    if (style.str('labelBackgroundColor', 'none') !== 'none')
      spanStyles.push(`background-color: ${style.str('labelBackgroundColor')}`);
    if (style.str('labelBorderColor', 'none') !== 'none')
      spanStyles.push(`border: 1px solid ${style.str('labelBorderColor')}`);
    if (style.num('textOpacity', 100) !== 100) {
      spanStyles.push(
        `color: color-mix(in srgb, ${style.str('fontColor')}, transparent ${100 - style.num('textOpacity', 100)}%)`
      );
    }
    if (!style.is('horizontal', true)) divStyles.push('transform: rotate(-90deg)');
    if (spanStyles.length > 0) {
      texts.text = `<span style="${spanStyles.join(';')}">${texts.text}</span>`;
    }
    if (divStyles.length > 0) {
      texts.text = `<div style="${divStyles.join(';')}">${texts.text}</div>`;
    }
  }
};

const attachNodeToParent = (
  node: DiagramElement,
  parent: Parent,
  $geometry: Element,
  { queue, uow }: CellContext
) => {
  if (parent instanceof SimpleDiagramNode) {
    // Need to offset the bounds according to the parent

    const offsetPoint = $geometry.querySelector('mxPoint[as=offset]');

    // TODO: Unclear why the `&& offsetPoint` condition - needed by test6
    const isRelative = $geometry.getAttribute('relative') === '1' && offsetPoint;

    const newBounds = {
      x:
        (isRelative ? node.bounds.x * parent.bounds.w : node.bounds.x) +
        parent.bounds.x +
        (offsetPoint ? xNum(offsetPoint, 'x', 0) : 0),
      y:
        (isRelative ? node.bounds.y * parent.bounds.h : node.bounds.y) +
        parent.bounds.y +
        (offsetPoint ? xNum(offsetPoint, 'y', 0) : 0),
      w: node.bounds.w,
      h: node.bounds.h,
      r: node.bounds.r
    };

    node.setBounds(newBounds, uow);

    if (node instanceof SimpleDiagramEdge) {
      const edge = node;
      edge.waypoints.forEach(wp => {
        edge.moveWaypoint(wp, Point.add(parent.bounds, wp.point), uow);
      });
    }

    if (node.editProps.fill?.color === 'inherit') {
      node.updateProps(props => {
        props.fill!.color = parent.renderProps.fill.color;
      }, uow);
    }
    if (node.editProps.stroke?.color === 'inherit') {
      node.updateProps(props => {
        props.stroke!.color = parent.renderProps.stroke.color;
      }, uow);
    }

    // This needs to be deferred as adding children changes the bounds of the group
    // meaning adding additional children will have the wrong parent bounds to resolve
    // the group local coordinates
    queue.add(() => parent.setChildren([...parent.children, node], uow));
  } else if (parent instanceof RegularLayer) {
    parent.addElement(node, uow);
  } else {
    VERIFY_NOT_REACHED();
  }
};

/**
 * Naming convention for variables are:
 *   - $$abc - collection of XML Elements
 *   - $abc - XML element
 *   - abc - regular value
 */
const parseMxGraphModel = async ($mxGraphModel: Element, diagram: Diagram) => {
  await UnitOfWork.executeAsync(diagram, async uow => {
    const queue = new WorkQueue();

    const $$cells = mustExist(
      $mxGraphModel.getElementsByTagName('root').item(0)
    ).getElementsByTagName('mxCell');

    const $rootCell = $$cells.item(0)!;
    const rootId = $rootCell.getAttribute('id')!;

    // Phase 1 - Determine parent child relationships
    const parentChild = parseParentChildRelations($$cells, rootId);

    // Phase 2 - process all objects (cells)
    const parents = new Map<string, Parent>();
    for (const $cell of xIterElements($$cells)) {
      const $parent = $cell.parentElement!;
      const wrapped = $parent.tagName === 'object' || $parent.tagName === 'UserObject';

      const id = $cell.getAttribute('id') ?? (wrapped ? $parent.getAttribute('id') : newid());
      assert.present(id);

      // Ignore the root
      if (id === rootId) continue;

      const parentId = mustExist($cell.getAttribute('parent'));
      const value = $cell.getAttribute('value');

      const isLayer = parentId === rootId; // 1st level of elements constitutes layers
      const isGroup = parentChild.has(id) && !isLayer;
      const isEdge = $cell.getAttribute('edge') === '1';

      if (isLayer) {
        const layer = new RegularLayer(id, value ?? 'Background', [], diagram);
        diagram.layers.add(layer, uow);
        if ($cell.getAttribute('visible') === '0') {
          diagram.layers.toggleVisibility(layer);
        }

        parents.set(id, layer);
      } else {
        const style = new StyleManager($cell.getAttribute('style') ?? '', isGroup);

        const $geometry = $cell.getElementsByTagName('mxGeometry').item(0)!;
        const bounds = MxGeometry.boundsFrom($geometry);
        bounds.r = Angle.toRad(style.num('rotation', 0));

        const parent = mustExist(parents.get(parentId));

        const layer = parent instanceof RegularLayer ? parent : (parent.layer as RegularLayer);

        const props = parseNodeProps(style, isEdge);
        const texts: NodeTexts = {
          text: hasValue(value) ? value : ''
        };

        const metadata: ElementMetadata = {};
        if (wrapped) {
          metadata.data ??= {};
          metadata.data.customData = parseMetadata($parent);

          texts.text = $parent.getAttribute('label') ?? '';
        }

        parseLabelStyles(texts, style);

        const $els: CellElements = { $cell, $geometry, $parent };
        const ctx: CellContext = { parents, queue, uow };

        let node: DiagramElement | undefined;
        if (isEdge) {
          node = parseEdge(id, props, metadata, style, layer, parents, wrapped, $els, ctx);
        } else if (style.styleName === 'edgeLabel') {
          parseLabelNode(id, props, style, diagram, parentId, mustExist(value), $geometry, ctx);
        } else if (isGroup || style.styleName === 'group') {
          node = await parseGroup(id, bounds, props, metadata, texts, style, layer, $els, ctx);
        } else if (style.styleName === 'text') {
          node = parseText(id, bounds, props, metadata, texts, style, layer);
        } else if (isStencilString(drawioBuiltinShapes[style.shape!] ?? style.shape)) {
          node = await parseStencil(id, bounds, props, metadata, texts, style, layer);
        } else {
          node = await parseShape(id, bounds, props, metadata, texts, style, layer, ctx);
        }

        // Attach all nodes created to their parent (group and/or layer)
        if (node) {
          attachNodeToParent(node, parent, $geometry, ctx);
        }
      }
    }

    // Phase 3 - run all remaining tasks
    queue.run();
  });
};

const XML = 'application/xml';

export const drawioReader = async (contents: string, doc: DiagramDocument): Promise<void> => {
  const start = Date.now();

  const parser = new DOMParser();
  const $doc = parser.parseFromString(contents, XML);

  const $$diagrams = $doc.getElementsByTagName('diagram');

  for (let i = 0; i < $$diagrams.length; i++) {
    const $diagram = $$diagrams.item(i)!;
    const $$children = $diagram.childNodes;

    let $mxGraphModel: Element;
    if ($$children.length === 1 && $$children.item(0).nodeType === Node.TEXT_NODE) {
      const diagramString = await deflate(mustExist($diagram.textContent));
      $mxGraphModel = parser.parseFromString(diagramString, XML).documentElement;
    } else {
      $mxGraphModel = mustExist($diagram.getElementsByTagName('mxGraphModel').item(0));
    }

    const diagram = new Diagram($diagram.getAttribute('id')!, $diagram.getAttribute('name')!, doc);
    doc.addDiagram(diagram);

    await parseMxGraphModel($mxGraphModel, diagram);

    if (diagram.visibleElements().length > 0) {
      const bounds = Box.boundingBox(
        diagram.visibleElements().flatMap(e => {
          return isEdge(e) ? [e.bounds, ...e.children.flatMap(c => c.bounds)] : [e.bounds];
        })
      );

      const w = xNum($mxGraphModel, 'pageWidth', 100);
      const h = xNum($mxGraphModel, 'pageHeight', 100);

      const canvasBounds = { w, h, x: 0, y: 0 };

      while (bounds.x < canvasBounds.x) canvasBounds.x -= w;
      while (bounds.y < canvasBounds.y) canvasBounds.y -= h;
      while (bounds.x + bounds.w > canvasBounds.x + canvasBounds.w) canvasBounds.w += w;
      while (bounds.y + bounds.h > canvasBounds.y + canvasBounds.h) canvasBounds.h += h;

      diagram.bounds = canvasBounds;

      diagram.viewBox.offset = { x: 0, y: 0 };
      diagram.viewBox.zoomLevel = xNum($mxGraphModel, 'pageScale', 1);
    }
  }

  console.log(`Duration: ${Date.now() - start}`);
};

export const _test = {
  parseNodeProps,
  parseMetadata,
  applyRotation
};
