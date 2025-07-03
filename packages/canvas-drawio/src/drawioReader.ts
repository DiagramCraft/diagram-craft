import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode, NodeTexts } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DiagramElement, isEdge } from '@diagram-craft/model/diagramElement';
import { FreeEndpoint, PointInNodeEndpoint } from '@diagram-craft/model/endpoint';
import { _p, Point } from '@diagram-craft/geometry/point';
import { assert } from '@diagram-craft/utils/assert';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { clipPath } from '@diagram-craft/model/edgeUtils';
import { assertHAlign, assertVAlign } from '@diagram-craft/model/diagramProps';
import { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { Angle } from '@diagram-craft/geometry/angle';
import { Waypoint } from '@diagram-craft/model/types';
import { Line } from '@diagram-craft/geometry/line';
import { newid } from '@diagram-craft/utils/id';
import {
  parseArrow,
  parseBlockArc,
  parseCloud,
  parseCube,
  parseCurlyBracket,
  parseCylinder,
  parseDelay,
  parseDiamond,
  parseDocument,
  parseEllipse,
  parseHexagon,
  parseImage,
  parseLine,
  parseParallelogram,
  parsePartialRect,
  parseProcess,
  parseRect,
  parseRhombus,
  parseRoundedRect,
  parseStep,
  parseSwimlane,
  parseTable,
  parseTableRow,
  parseTransparent,
  parseTriangle
} from './shapes';
import { registerAzureShapes } from './shapes/azure';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import {
  registerOfficeCloudsShapes,
  registerOfficeCommunicationsShapes,
  registerOfficeConceptShapes,
  registerOfficeDatabasesShapes,
  registerOfficeDevicesShapes,
  registerOfficeSecurityShapes,
  registerOfficeServersShapes,
  registerOfficeServicesShapes,
  registerOfficeSitesShapes,
  registerOfficeUsersShapes
} from './shapes/office';
import { registerCitrixShapes } from './shapes/citrix';
import { registerVeeamShapes } from './shapes/veeam';
import { registerVeeam3dShapes } from './shapes/veeam3d';
import { registerVeeam2dShapes } from './shapes/veeam2d';
import { registerCisco19Shapes } from './shapes/cisco19';
import { registerAWS4Shapes } from './shapes/aws4';
import { registerGCP2Shapes } from './shapes/gcp2/gcp2';
import { registerC4Shapes } from './shapes/c4';
import { registerSalesforceShapes } from './shapes/salesforce';
import { registerUMLShapes } from './shapes/uml/uml';
import { registerAndroidShapes } from './shapes/android/android';
import { StyleManager } from './styleManager';
import { coalesce } from '@diagram-craft/utils/strings';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { xIterElements, xNum } from '@diagram-craft/utils/xml';
import { parseNum } from '@diagram-craft/utils/number';
import { assertRegularLayer, RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

const drawioBuiltinShapes: Partial<Record<string, string>> = {
  actor:
    'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
};

export class WorkQueue {
  queue: [Array<() => void>, Array<() => void>] = [[], []];

  add(work: () => void, priority: 0 | 1 = 0) {
    this.queue[priority].push(work);
  }

  run() {
    this.queue[0].forEach(work => work());
    this.queue[1].forEach(work => work());
  }
}

export type ShapeParser = (
  id: string,
  bounds: Box,
  props: NodeProps,
  metadata: ElementMetadata,
  texts: NodeTexts,
  style: StyleManager,
  layer: Layer,
  queue: WorkQueue
) => Promise<DiagramNode>;

export const shapeParsers: Record<string, ShapeParser> = {
  'hexagon': parseHexagon,
  'step': parseStep,
  'cloud': parseCloud,
  'rect': parseRect,
  'transparent': parseTransparent,
  'partialRectangle': parsePartialRect,
  'delay': parseDelay,
  'rhombus': parseRhombus,
  'parallelogram': parseParallelogram,
  'cylinder': parseCylinder,
  'cylinder3': parseCylinder,
  'process': parseProcess,
  'curlyBracket': parseCurlyBracket,
  'mxgraph.basic.partConcEllipse': parseBlockArc,
  'triangle': parseTriangle,
  'mxgraph.arrows2.arrow': parseArrow,
  'image': parseImage,
  'cube': parseCube,
  'line': parseLine,
  'ellipse': parseEllipse,
  'table': parseTable,
  'tableRow': parseTableRow,
  'document': parseDocument
};

const getParser = (shape: string | undefined): ShapeParser | undefined =>
  shapeParsers[shape as keyof ShapeParser] ??
  shapeParsers[shape?.split('.').slice(0, -1).join('.') as keyof ShapeParser];

type Loader = (
  registry: NodeDefinitionRegistry,
  parsers: Record<string, ShapeParser>
) => Promise<void>;

const loaders: Array<[RegExp, Loader]> = [
  [/^mxgraph\.azure/, registerAzureShapes],
  [/^mxgraph\.office\.communications/, registerOfficeCommunicationsShapes],
  [/^mxgraph\.office\.concepts/, registerOfficeConceptShapes],
  [/^mxgraph\.office\.clouds/, registerOfficeCloudsShapes],
  [/^mxgraph\.office\.databases/, registerOfficeDatabasesShapes],
  [/^mxgraph\.office\.devices/, registerOfficeDevicesShapes],
  [/^mxgraph\.office\.security/, registerOfficeSecurityShapes],
  [/^mxgraph\.office\.servers/, registerOfficeServersShapes],
  [/^mxgraph\.office\.services/, registerOfficeServicesShapes],
  [/^mxgraph\.office\.sites/, registerOfficeSitesShapes],
  [/^mxgraph\.office\.users/, registerOfficeUsersShapes],
  [/^mxgraph\.citrix/, registerCitrixShapes],
  [/^mxgraph\.veeam2/, registerVeeamShapes],
  [/^mxgraph\.veeam\.2d/, registerVeeam2dShapes],
  [/^mxgraph\.veeam\.3d/, registerVeeam3dShapes],
  [/^mxgraph\.cisco19/, registerCisco19Shapes],
  [/^mxgraph\.aws4/, registerAWS4Shapes],
  [/^mxgraph\.gcp2/, registerGCP2Shapes],
  [/^mxgraph\.c4/, registerC4Shapes],
  [/^mxgraph\.salesforce/, registerSalesforceShapes],
  [/^mxgraph\.android/, registerAndroidShapes],
  [
    /^(module|folder|providedRequiredInterface|requiredInterface|uml[A-Z][a-z]+)$/,
    registerUMLShapes
  ]
];

const getLoader = (shape: string | undefined): Loader | undefined => {
  if (!shape) return undefined;
  return loaders.find(([r]) => shape.match(r))?.[1];
};

const load = async (
  loader: Loader,
  registry: NodeDefinitionRegistry,
  alreadyLoaded: Set<Loader>
) => {
  if (alreadyLoaded.has(loader)) return;
  await loader(registry, shapeParsers);
  alreadyLoaded.add(loader);
};

const parseStencil = (shape: string | undefined) => {
  if (!shape) return undefined;

  if (!shape.startsWith('stencil(')) {
    if (getParser(shape) || getLoader(shape)) {
      return undefined;
    } else {
      console.warn(`Unsupported shape ${shape}`);
      return undefined;
    }
  }

  // TODO: Are these still needed
  //if (shape === 'mxgraph.basic.rect') return undefined;
  //if (shape === 'circle3') return undefined;
  //if (shape === 'flexArrow') return undefined;

  return /^stencil\(([^)]+)\)$/.exec(shape)![1];
};

const angleFromDirection = (s: string) => {
  if (s === 'north') return -Math.PI / 2;
  if (s === 'south') return Math.PI / 2;
  if (s === 'east') return 0;
  if (s === 'west') return Math.PI;
  return 0;
};

const arrows: Record<string, keyof typeof ARROW_SHAPES> = {
  'open': 'SQUARE_STICK_ARROW',
  'classic': 'SHARP_ARROW_FILLED',
  'classicThin': 'SHARP_ARROW_THIN_FILLED',
  'oval': 'BALL_FILLED',
  'doubleBlock': 'SQUARE_DOUBLE_ARROW_FILLED',
  'doubleBlock-outline': 'SQUARE_DOUBLE_ARROW_OUTLINE',
  'ERzeroToMany-outline': 'CROWS_FEET_BALL',
  'ERzeroToOne-outline': 'BAR_BALL',
  'ERoneToMany-outline': 'CROWS_FEET_BAR',
  'ERmandOne-outline': 'BAR_DOUBLE',
  'ERone-outline': 'BAR',
  'baseDash-outline': 'BAR_END',
  'halfCircle-outline': 'SOCKET',
  'box-outline': 'BOX_OUTLINE',
  'diamond-outline': 'DIAMOND_OUTLINE',
  'diamondThin-outline': 'DIAMOND_THIN_OUTLINE',
  'diamond': 'DIAMOND_FILLED',
  'diamondThin': 'DIAMOND_THIN_FILLED',
  'circle': 'BALL_FILLED',
  'circle-outline': 'BALL_OUTLINE',
  'circlePlus-outline': 'BALL_PLUS_OUTLINE',
  'oval-outline': 'BALL_OUTLINE',
  'block': 'SQUARE_ARROW_FILLED',
  'blockThin': 'SQUARE_ARROW_THIN_FILLED',
  'block-outline': 'SQUARE_ARROW_OUTLINE',
  'open-outline': 'SQUARE_STICK_ARROW',
  'openAsync-outline': 'SQUARE_STICK_ARROW_HALF_LEFT',
  'async': 'SQUARE_STICK_ARROW_HALF_LEFT_THIN_FILLED',
  'classic-outline': 'SHARP_ARROW_OUTLINE',
  'blockThin-outline': 'SQUARE_ARROW_THIN_OUTLINE',
  'async-outline': 'SQUARE_STICK_ARROW_HALF_LEFT_THIN_OUTLINE',
  'dash-outline': 'SLASH',
  'cross-outline': 'CROSS',
  'openThin-outline': 'SQUARE_STICK_ARROW',
  'manyOptional': 'CROWS_FEET_BALL_FILLED',
  'manyOptional-outline': 'CROWS_FEET_BALL'
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
    props.arrow![t] = {
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

const MxPoint = {
  pointFrom: (offset: Element) => Point.of(xNum(offset, 'x', 0), xNum(offset, 'y', 0))
};

const MxGeometry = {
  boundsFrom: (geometry: Element) => {
    return {
      x: xNum(geometry, 'x', 0),
      y: xNum(geometry, 'y', 0),
      w: xNum(geometry, 'width', 100),
      h: xNum(geometry, 'height', 100),
      r: 0
    };
  }
};

const hasValue = (value: string | undefined | null): value is string => {
  if (!value || value.trim() === '') return false;

  if (value.startsWith('<')) {
    if (value.includes('<img')) return true;
    try {
      const d = new DOMParser().parseFromString(value, 'text/html');
      const text = d.body.textContent;
      return !!text && text.trim() !== '';
    } catch (e) {
      // Ignore
    }
  }
  return true;
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

  const css: string[] = [];

  css.push('font-size: ' + style.num('fontSize', 12) + 'px');
  css.push('font-family: ' + (style.str('fontFamily') ?? 'Helvetica'));
  css.push('direction: ltr');
  css.push('line-height: 120%');
  css.push('color: black');

  $el.innerHTML = value.startsWith('<') ? value : `<span style="${css.join(';')}">${value}</span>`;

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
  bgColor: string,
  uow: UnitOfWork
) => {
  const textNode = new DiagramNode(
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

  // Add text node to any parent group
  if (edge.parent) {
    edge.parent.setChildren([...edge.parent.children, textNode], uow);
  }

  return textNode;
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
    { id: textNode.id, type: 'horizontal', node: textNode, offset, timeOffset },
    uow
  );
};

const POSITIONS: Record<string, Record<string, string>> = {
  left: {
    top: 'nw',
    middle: 'w',
    bottom: 'sw'
  },
  center: {
    top: 'n',
    middle: 'c',
    bottom: 's'
  },
  right: {
    top: 'ne',
    middle: 'e',
    bottom: 'se'
  }
};

const getNodeProps = (style: StyleManager, isEdge: boolean) => {
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

      // @ts-ignore
      position:
        POSITIONS[style.str('labelPosition', 'center')][
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
    inheritStyle: false
  };

  if (props.text!.color === '#') props.text!.color = 'black';

  const fontStyle = parseNum(style.str('fontStyle'), 0);
  props.text!.bold = (fontStyle & 1) !== 0;
  props.text!.italic = (fontStyle & 2) !== 0;
  props.text!.textDecoration = (fontStyle & 4) !== 0 ? 'underline' : 'none';

  props.text!.wrap = style.str('whiteSpace') === 'wrap';
  props.text!.overflow =
    style.str('overflow') === 'hidden' ||
    style.str('overflow') === 'fill' ||
    style.str('overflow') === 'width'
      ? 'hidden'
      : 'visible';

  if (style.str('overflow') === 'fill' || style.str('overflow') === 'width') {
    props.text!.top = 0;
    props.text!.bottom = 0;
    props.text!.left = 0;
    props.text!.right = 0;
  }

  if (
    style.has('gradientColor') &&
    style.str('gradientColor') !== 'none' &&
    style.str('gradientColor') !== 'inherit'
  ) {
    props.fill!.type = 'gradient';
    props.fill!.color2 = style.str('gradientColor');
    props.fill!.gradient = {
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
    const [baseSize, baseGap] = pattern.split(' ').map(s => parseNum(s, 4));
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
    props.shadow = {
      enabled: true,
      color: '#999999',
      x: 3,
      y: 3,
      blur: 3
    };
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

  if (style.get('indicatorShape')) {
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

const attachEdge = (edge: DiagramEdge, $cell: Element, style: StyleManager, uow: UnitOfWork) => {
  const diagram = edge.diagram;

  const source = $cell.getAttribute('source')!;
  if (source) {
    const sourceNode = diagram.nodeLookup.get(source);
    if (sourceNode) {
      edge.setStart(
        new PointInNodeEndpoint(
          sourceNode,
          _p(style.num('exitX', 0.5), style.num('exitY', 0.5)),
          _p(style.num('exitDx', 0), style.num('exitDy', 0)),
          'absolute'
        ),
        uow
      );
    }
  }

  const target = $cell.getAttribute('target')!;
  if (target) {
    const targetNode = diagram.nodeLookup.get(target);
    if (targetNode) {
      edge.setEnd(
        new PointInNodeEndpoint(
          targetNode,
          _p(style.num('entryX', 0.5), style.num('entryY', 0.5)),
          _p(style.num('entryDx', 0), style.num('entryDy', 0)),
          'absolute'
        ),
        uow
      );
    }
  }
};

const readMetadata = ($parent: HTMLElement) => {
  const dest: Record<string, string> = {};
  for (const n of $parent.getAttributeNames()) {
    if (n === 'id' || n === 'label' || n === 'placeholders') continue;

    const value = $parent.getAttribute(n);
    if (value) {
      dest[n] = value;
    }
  }
  return dest;
};

/**
 * Naming convention for variables are:
 *   - $$abc - collection of XML Elements
 *   - $abc - XML element
 *   - abc - regular value
 */
const parseMxGraphModel = async ($el: Element, diagram: Diagram) => {
  const alreadyLoaded = new Set<Loader>();

  const uow = UnitOfWork.immediate(diagram);
  const queue = new WorkQueue();

  const parentChild = new Map<string, string[]>();

  const $$cells = $el.getElementsByTagName('root').item(0)!.getElementsByTagName('mxCell');

  const rootId = $$cells.item(0)!.getAttribute('id')!;

  // Phase 1 - Determine parent child relationships
  for (const $cell of xIterElements($$cells)) {
    const parent = $cell.getAttribute('parent')!;
    if (parent !== rootId) {
      const id = $cell.getAttribute('id')!;
      parentChild.set(parent, [...(parentChild.get(parent) ?? []), id]);
    }
  }

  // Phase 2 - process all objects
  const parents = new Map<string, Layer | DiagramNode | DiagramEdge>();
  for (const $cell of xIterElements($$cells)) {
    const $parent = $cell.parentElement!;
    const isWrappedByObject = $parent!.tagName === 'object' || $parent!.tagName === 'UserObject';

    const id =
      $cell.getAttribute('id')! ?? (isWrappedByObject ? $parent.getAttribute('id') : newid());

    // Ignore the root
    if (id === rootId) continue;

    const parent = $cell.getAttribute('parent')!;
    const value = $cell.getAttribute('value')!;

    // is layer? - first level of elements constitutes layers
    if (parent === rootId) {
      const layer = new RegularLayer(id, coalesce(value, 'Background')!, [], diagram);
      diagram.layers.add(layer, uow);
      if ($cell.getAttribute('visible') === '0') {
        diagram.layers.toggleVisibility(layer);
      }

      parents.set(id, layer);
    } else {
      const style = new StyleManager($cell.getAttribute('style')!, parentChild.has(id));

      const $geometry = $cell.getElementsByTagName('mxGeometry').item(0)!;
      let bounds = MxGeometry.boundsFrom($geometry);
      bounds.r = Angle.toRad(style.num('rotation', 0));

      // TODO: Is parents used for groups or only layers
      let p = parents.get(parent);
      if (!p) {
        const parentNode = diagram.nodeLookup.get(parent);
        if (!parentNode) {
          console.warn(`Parent ${parent} not found for ${id}`);
          continue;
        }

        p = parentNode.layer;
        bounds = {
          ...bounds,
          x: parentNode.bounds.x + bounds.x,
          y: parentNode.bounds.y + bounds.y
        };
      }

      assert.present(p);

      const layer = p instanceof Layer ? p : p!.layer;
      assertRegularLayer(layer);

      const metadata: ElementMetadata = {};

      const props = getNodeProps(style, $cell.getAttribute('edge') === '1');
      const texts: NodeTexts = {
        text: hasValue(value) ? value : ''
      };

      if (isWrappedByObject) {
        metadata.data ??= {};
        metadata.data.customData = readMetadata($parent);

        texts.text = $parent.getAttribute('label') ?? '';
      }

      // We don't support label styles natively, so simulate using a wrapping span. Note, we only do this in case the
      // text itself is not an HTML formatted
      if (!texts.text.startsWith('<') && texts.text !== '') {
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

      const nodes: DiagramElement[] = [];

      const stencil = parseStencil(drawioBuiltinShapes[style.shape!] ?? style.shape);

      if (stencil) {
        props.custom ??= {};
        props.custom.drawio = { shape: btoa(await decode(stencil)) };
        nodes.push(new DiagramNode(id, 'drawio', bounds, layer, props, metadata, texts));
      } else if (style.styleName == 'text') {
        // TODO: We should be able to move these two to the global style parsing/conversion
        if (style.str('strokeColor', 'none') === 'none') {
          props.stroke!.enabled = false;
        }

        if (style.str('fillColor', 'none') === 'none') {
          props.fill!.enabled = false;
        }

        nodes.push(
          new DiagramNode(
            id,
            'rect',
            bounds,
            layer,
            {
              ...props,
              capabilities: {
                ...(props.capabilities ?? {}),
                textGrow: true
              }
            },
            metadata,
            texts
          )
        );
      } else if (style.styleName === 'image' || style.has('image')) {
        nodes.push(await parseImage(id, bounds, props, metadata, texts, style, layer, queue));
      } else if (style.styleName === 'edgeLabel') {
        // Handle free-standing edge labels
        const edge = diagram.edgeLookup.get(parent);
        assert.present(edge);

        const textNode = createLabelNode(id, edge, value, props, '#ffffff', uow);

        // Note: This used to be done with queue.add - unclear why
        attachLabelNode(textNode, edge, $geometry, uow);

        queue.add(() => calculateLabelNodeActualSize(style, textNode, value, uow));
        queue.add(() => edge.invalidate(uow), 1);
      } else if (style.styleName === 'triangle') {
        nodes.push(await parseTriangle(id, bounds, props, metadata, texts, style, layer));
      } else if (style.styleName === 'line') {
        nodes.push(await parseLine(id, bounds, props, metadata, texts, style, layer));
      } else if ($cell.getAttribute('edge') === '1') {
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
        edgeProps.routing ??= {};
        edgeProps.stroke!.lineJoin = 'round';

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

        if (style.is('rounded')) {
          edgeProps.routing!.rounding = 10;
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

            const next = wps[i + 1];
            const midpoint = Line.midpoint(Line.of(wps[i], next));
            waypoints.push({
              point: midpoint,
              controlPoints: {
                cp1: Vector.scale(Point.subtract(wps[i], midpoint), 1),
                cp2: Vector.scale(Point.subtract(wps[i + 1], midpoint), 1)
              }
            });
          } else {
            waypoints.push({ point: wps[i] });
          }
        }

        const edge = new DiagramEdge(
          id,
          source,
          target,
          // @ts-ignore
          props,
          metadata,
          waypoints,
          layer
        );
        nodes.push(edge);
        parents.set(id, edge);

        if (style.is('orthogonal')) {
          edgeProps.type = 'orthogonal';
        }

        // Post-pone attaching the edge to the source and target nodes until all
        // nodes have been processed
        queue.add(() => attachEdge(edge, $cell, style, uow));

        const value = isWrappedByObject
          ? $parent.getAttribute('label')
          : $cell.getAttribute('value');

        if (hasValue(value)) {
          props.stroke!.enabled = false;

          const labelBg = style.str('labelBackgroundColor') ?? 'transparent';

          const textNode = createLabelNode(`${id}-label`, edge, value, props, labelBg, uow);

          queue.add(() => attachLabelNode(textNode, edge, $geometry, uow));
          queue.add(() => calculateLabelNodeActualSize(style, textNode, value, uow));
          queue.add(() => edge.invalidate(uow), 1);
        }
      } else if (parentChild.has(id) || style.styleName == 'group') {
        // Handle groups

        let node: DiagramNode;
        if (style.shape === 'table' || style.shape === 'tableRow') {
          const parser = getParser(style.shape!)!;
          node = await parser(id, bounds, props, metadata, texts, style, layer, queue);
          nodes.push(node);
          // TODO: Support more than stackLayout
        } else if (style.styleName === 'swimlane' && style.str('childLayout') === 'stackLayout') {
          node = await parseSwimlane(id, bounds, props, metadata, texts, style, layer);
          nodes.push(node);
        } else {
          node = new DiagramNode(id, 'group', bounds, layer, props, metadata, texts);
          nodes.push(node);

          if (
            style.styleName != 'group' &&
            (style.str('fillColor') || style.str('strokeColor') || value || style.shape)
          ) {
            // TODO: This is all a bit duplication - we should refactor this
            let bgNode: DiagramNode;
            if (style.shape! in shapeParsers) {
              bgNode = await shapeParsers[style.shape!](
                newid(),
                bounds,
                props,
                metadata,
                texts,
                style,
                layer,
                queue
              );
            } else if (style.shape?.startsWith('mxgraph.')) {
              const registry = diagram.document.nodeDefinitions;

              const loader = getLoader(style.shape);
              if (!loader) {
                console.warn(`No loader found for ${style.shape}`);
                nodes.push(new DiagramNode(id, 'rect', bounds, layer, props, metadata, texts));
                continue;
              }

              if (!registry.hasRegistration(style.shape)) {
                await load(loader, registry, alreadyLoaded);
              }

              const parser = getParser(style.shape!);
              if (parser) {
                bgNode = await parser(newid(), bounds, props, metadata, texts, style, layer, queue);
              } else {
                bgNode = new DiagramNode(
                  newid(),
                  style.shape!,
                  bounds,
                  layer,
                  props,
                  metadata,
                  texts
                );
              }
            } else {
              if (style.is('rounded')) {
                bgNode = new DiagramNode(
                  newid(),
                  'rounded-rect',
                  { ...bounds },
                  layer,
                  {
                    ...props,
                    custom: {
                      roundedRect: {
                        radius: style.num('arcSize', 5)
                      }
                    }
                  },
                  metadata,
                  texts
                );
              } else {
                bgNode = new DiagramNode(
                  newid(),
                  'rect',
                  { ...bounds },
                  layer,
                  props,
                  metadata,
                  texts
                );
              }
            }

            node.addChild(bgNode, uow);
            queue.add(() => {
              bgNode.setBounds(node.bounds, uow);
            });
          }
        }

        parents.set(id, node);
      } else if (style.shape! in shapeParsers) {
        nodes.push(
          await shapeParsers[style.shape!](id, bounds, props, metadata, texts, style, layer, queue)
        );
      } else if (style.shape?.startsWith('mxgraph.') || !!getLoader(style.shape)) {
        const registry = diagram.document.nodeDefinitions;

        const loader = getLoader(style.shape);
        if (!loader) {
          console.warn(`No loader found for ${style.shape}`);
          nodes.push(new DiagramNode(id, 'rect', bounds, layer, props, metadata, texts));
          continue;
        }

        if (!registry.hasRegistration(style.shape!)) {
          await load(loader, registry, alreadyLoaded);
        }

        let newBounds = { ...bounds };
        if (style.str('direction') === 'south') {
          const p = Point.rotateAround(
            Point.add(newBounds, { x: 0, y: newBounds.w }),
            Math.PI / 2,
            Point.add(newBounds, { x: newBounds.h / 2, y: newBounds.w / 2 })
          );

          newBounds = {
            ...newBounds,
            w: newBounds.h,
            h: newBounds.w,
            r: Math.PI / 2,
            x: newBounds.x + (newBounds.x - p.x),
            y: newBounds.y + (newBounds.y - p.y)
          };
        } else if (style.str('direction') === 'north') {
          const p = Point.rotateAround(
            Point.add(newBounds, { x: newBounds.h, y: 0 }),
            -Math.PI / 2,
            Point.add(newBounds, { x: newBounds.h / 2, y: newBounds.w / 2 })
          );

          newBounds = {
            ...newBounds,
            w: newBounds.h,
            h: newBounds.w,
            r: -Math.PI / 2,
            x: newBounds.x + (newBounds.x - p.x),
            y: newBounds.y + (newBounds.y - p.y)
          };
        } else if (style.str('direction') === 'west') {
          newBounds = { ...newBounds, r: Math.PI };
        }

        const parser = getParser(style.shape!);
        if (parser) {
          nodes.push(await parser(id, newBounds, props, metadata, texts, style, layer, queue));
        } else {
          nodes.push(new DiagramNode(id, style.shape!, newBounds, layer, props, metadata, texts));
        }
      } else if (style.styleName === 'ellipse') {
        nodes.push(await parseEllipse(id, bounds, props, metadata, texts, style, layer));
      } else if (style.styleName === 'rhombus') {
        nodes.push(await parseDiamond(id, bounds, props, metadata, texts, style, layer));
      } else {
        if (style.is('rounded')) {
          nodes.push(await parseRoundedRect(id, bounds, props, metadata, texts, style, layer));
        } else {
          nodes.push(new DiagramNode(id, 'rect', bounds, layer, props, metadata, texts));
        }
      }

      // Attach all nodes created to their parent (group and/or layer)
      for (const node of nodes) {
        if (p instanceof DiagramNode) {
          // Need to offset the bounds according to the parent

          const offsetPoint = $geometry.querySelector('mxPoint[as=offset]');

          // TODO: Unclear why the `&& offsetPoint` condition - needed by test6
          const isRelative = $geometry.getAttribute('relative') === '1' && offsetPoint;

          const newBounds = {
            x:
              (isRelative ? node.bounds.x * p.bounds.w : node.bounds.x) +
              p.bounds.x +
              (offsetPoint ? xNum(offsetPoint, 'x', 0) : 0),
            y:
              (isRelative ? node.bounds.y * p.bounds.h : node.bounds.y) +
              p.bounds.y +
              (offsetPoint ? xNum(offsetPoint, 'y', 0) : 0),
            w: node.bounds.w,
            h: node.bounds.h,
            r: node.bounds.r
          };

          node.setBounds(newBounds, uow);

          if (node instanceof DiagramEdge) {
            const edge = node as DiagramEdge;
            edge.waypoints.forEach(wp => {
              edge.moveWaypoint(wp, Point.add(p.bounds, wp.point), uow);
            });
          }

          if (node.editProps.fill?.color === 'inherit') {
            node.updateProps(props => {
              props.fill!.color = p.renderProps.fill!.color;
            }, uow);
          }
          if (node.editProps.stroke?.color === 'inherit') {
            node.updateProps(props => {
              props.stroke!.color = p.renderProps.stroke!.color;
            }, uow);
          }

          // This needs to be deferred as adding children changes the bounds of the group
          // meaning adding additional children will have the wrong parent bounds to resolve
          // the group local coordinates
          queue.add(() => p.setChildren([...p.children, node], uow));
        } else {
          layer.addElement(node, uow);
        }
      }
    }
  }

  // Phase 3 - run all remaining tasks
  queue.run();
};

async function decode(data: string) {
  const binaryContents = atob(data);

  const arr = Uint8Array.from(binaryContents, c => c.charCodeAt(0));

  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(arr);
  writer.close();

  const reader = ds.readable.getReader();
  const output = [];

  let totalSize = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    output.push(value);
    totalSize += value.byteLength;
  }

  const concatenated = new Uint8Array(totalSize);
  let offset = 0;
  for (const array of output) {
    concatenated.set(array, offset);
    offset += array.byteLength;
  }

  return decodeURIComponent(new TextDecoder().decode(concatenated));
}

export const drawioReader = async (contents: string, doc: DiagramDocument): Promise<void> => {
  const start = new Date().getTime();

  const parser = new DOMParser();
  const $doc = parser.parseFromString(contents, 'application/xml');

  const $diagrams = $doc.getElementsByTagName('diagram');

  for (let i = 0; i < $diagrams.length; i++) {
    const $diagram = $diagrams.item(i)!;

    let $mxGraphModel: Element;
    if (
      $diagram.childNodes.length === 1 &&
      $diagram.childNodes.item(0).nodeType === Node.TEXT_NODE
    ) {
      const s = await decode($diagram.textContent!);
      $mxGraphModel = parser.parseFromString(s, 'application/xml').documentElement;
    } else {
      $mxGraphModel = $diagram.getElementsByTagName('mxGraphModel').item(0)!;
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

      const pageWidth = xNum($mxGraphModel, 'pageWidth', 100);
      const pageHeight = xNum($mxGraphModel, 'pageHeight', 100);

      const canvasBounds = {
        w: pageWidth,
        h: pageHeight,
        x: 0,
        y: 0
      };

      while (bounds.x < canvasBounds.x) canvasBounds.x -= pageWidth;
      while (bounds.y < canvasBounds.y) canvasBounds.y -= pageHeight;
      while (bounds.x + bounds.w > canvasBounds.x + canvasBounds.w) canvasBounds.w += pageWidth;
      while (bounds.y + bounds.h > canvasBounds.y + canvasBounds.h) canvasBounds.h += pageHeight;

      diagram.canvas = canvasBounds;

      diagram.viewBox.offset = { x: 0, y: 0 };
      diagram.viewBox.zoomLevel = xNum($mxGraphModel, 'pageScale', 1);
    }
  }

  console.log(`Duration: ${new Date().getTime() - start}`);
};
