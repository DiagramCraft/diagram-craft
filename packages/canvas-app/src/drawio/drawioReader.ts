import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { parseNum, xNum } from './utils';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { FixedEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { Point } from '@diagram-craft/geometry/point';
import { assert } from '@diagram-craft/utils/assert';
import { LengthOffsetOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { clipPath } from '@diagram-craft/model/edgeUtils';
import { assertHAlign, assertVAlign, HAlign } from '@diagram-craft/model/diagramProps';
import { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { Angle } from '@diagram-craft/geometry/angle';

const drawioBuiltinShapes: Partial<Record<string, string>> = {
  actor:
    'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
};

type Style = Partial<Record<string, string>>;

class WorkQueue {
  queue: Array<() => void> = [];

  add(work: () => void) {
    this.queue.push(work);
  }

  run() {
    this.queue.forEach(work => work());
  }
}

const parseStyle = (style: string) => {
  const parts = style.split(';');
  const result: Style = {};
  for (const part of parts) {
    const [key, ...value] = part.split('=');
    result[key] = value.join('=');
  }
  return result;
};

const parseShape = (shape: string | undefined) => {
  if (shape === 'image') return undefined;
  if (shape === 'mxgraph.basic.rect') return undefined;
  if (shape === 'hexagon') return undefined;
  if (shape === 'parallelogram') return undefined;
  if (shape === 'process') return undefined;
  if (shape === 'mxgraph.arrows2.arrow') return undefined;
  if (shape === 'ellipse') return undefined;
  if (shape === 'circle3') return undefined;
  if (!shape) return undefined;

  if (!shape.startsWith('stencil(')) {
    console.warn(`Unsupported shape ${shape}`);
    return undefined;
  }

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
  'classicThin': 'SHARP_ARROW_FILLED',
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
  'diamondThin-outline': 'DIAMOND_OUTLINE',
  'diamond': 'DIAMOND_FILLED',
  'diamondThin': 'DIAMOND_FILLED',
  'circle-outline': 'BALL_OUTLINE',
  'circlePlus-outline': 'BALL_PLUS_OUTLINE',
  'oval-outline': 'BALL_OUTLINE',
  'block': 'SQUARE_ARROW_FILLED',
  'blockThin': 'SQUARE_ARROW_FILLED',
  'block-outline': 'SQUARE_ARROW_OUTLINE',
  'open-outline': 'SQUARE_STICK_ARROW',
  'openAsync-outline': 'SQUARE_STICK_ARROW_HALF_LEFT',
  'async': 'SQUARE_STICK_ARROW_HALF_LEFT',
  'classic-outline': 'SHARP_ARROW_OUTLINE',
  'blockThin-outline': 'SQUARE_ARROW_OUTLINE',
  'async-outline': 'SQUARE_STICK_ARROW_HALF_LEFT',
  'dash-outline': 'SLASH',
  'cross-outline': 'CROSS'
};

// Based on https://stackoverflow.com/questions/12168909/blob-from-dataurl
const dataURItoBlob = (dataURI: string) => {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  const ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  return new Blob([ab], { type: mimeString });
};

const parseArrow = (t: 'start' | 'end', style: Style, props: EdgeProps) => {
  let type = style[`${t}Arrow`];
  const size = style[`${t}Size`];
  const fill = style[`${t}Fill`];
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
      size: parseNum(size, 6) * 15
    };
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
  style: Style,
  textNode: DiagramNode,
  value: string,
  uow: UnitOfWork
) => {
  const $el = document.createElement('div');
  $el.style.visibility = 'hidden';
  $el.style.position = 'absolute';
  $el.style.width = 'auto';
  document.body.appendChild($el);

  const css: string[] = [];

  css.push('font-size: ' + parseNum(style.fontSize, 12) + 'px');
  css.push('font-family: ' + (style.fontFamily ?? 'sans-serif'));
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
};

const createLabelNode = (
  id: string,
  edge: DiagramEdge,
  text: string,
  props: NodeProps,
  bgColor: string,
  uow: UnitOfWork
) => {
  const textNode = new DiagramNode(id, 'text', edge.bounds, edge.diagram, edge.layer, {
    text: {
      text,
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
  });

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

const getNodeProps = (style: Style) => {
  const align = style.align ?? 'left';
  assertHAlign(align);

  const valign = style.verticalAlign ?? 'middle';
  assertVAlign(valign);

  const props: NodeProps = {
    text: {
      fontSize: parseNum(style.fontSize, 12),
      font: style.fontFamily,
      color: style.fontColor ?? 'black',
      top: parseNum(style.spacingTop, 5) + parseNum(style.spacing, 2),
      bottom: parseNum(style.spacingBottom, 5) + parseNum(style.spacing, 2),
      left: parseNum(style.spacingLeft, 0) + parseNum(style.spacing, 2),
      right: parseNum(style.spacingRight, 0) + parseNum(style.spacing, 2),
      align: align,
      valign: valign
    },
    fill: {
      color: style.fillColor ?? 'white'
    },
    geometry: {
      flipH: style.flipH === '1',
      flipV: style.flipV === '1'
    }
  };

  if (style.fontStyle === '1') {
    props.text!.bold = true;
  } else if (style.fontStyle === '2') {
    props.text!.italic = true;
  } else if (style.fontStyle === '3') {
    props.text!.bold = true;
    props.text!.italic = true;
  }

  if (style.gradientColor && style.gradientColor !== 'none') {
    props.fill!.type = 'gradient';
    props.fill!.color2 = style.gradientColor;
    props.fill!.gradient = {
      type: 'linear',
      direction: angleFromDirection(style.gradientDirection ?? 'south')
    };
  }

  if (style.opacity && style.opacity !== '100') {
    props.effects ??= {};
    props.effects.opacity = parseNum(style.opacity, 100) / 100;
  }

  props.stroke = {
    color: style.strokeColor,
    width: parseNum(style.strokeWidth, 1)
  };

  if (style.edgeStyle === 'orthogonalEdgeStyle') {
    (props as EdgeProps).type = 'orthogonal';
  }

  if (style.dashed === '1') {
    props.stroke.pattern = 'DASHED';
    props.stroke.patternSpacing = parseNum(style.dashPattern, 30 * parseNum(style.strokeWidth, 1));
    props.stroke.patternSize = parseNum(style.dashPattern, 30 * parseNum(style.strokeWidth, 1));
  }

  if (style.shadow === '1') {
    props.shadow = {
      enabled: true,
      color: '#999999',
      x: 3,
      y: 3,
      blur: 3
    };
  }

  return props;
};

const attachEdge = (edge: DiagramEdge, $cell: Element, style: Style, uow: UnitOfWork) => {
  const diagram = edge.diagram;

  const source = $cell.getAttribute('source')!;
  if (source) {
    const sourceNode = diagram.nodeLookup.get(source);
    if (sourceNode) {
      const x = parseNum(style.exitX, 0.5);
      const y = parseNum(style.exitY, 0.5);

      edge.setStart(new FixedEndpoint({ x, y }, sourceNode), uow);
    }
  }

  const target = $cell.getAttribute('target')!;
  if (target) {
    const targetNode = diagram.nodeLookup.get(target);
    if (targetNode) {
      const x = parseNum(style.entryX, 0.5);
      const y = parseNum(style.entryY, 0.5);

      edge.setEnd(new FixedEndpoint({ x, y }, targetNode), uow);
    }
  }
};

const parseMxGraphModel = async ($el: Element, diagram: Diagram) => {
  const uow = UnitOfWork.throwaway(diagram);
  const queue = new WorkQueue();

  const parentChild = new Map<string, string[]>();

  const $cells = $el.getElementsByTagName('root').item(0)!.getElementsByTagName('mxCell');

  const rootId = $cells.item(0)!.getAttribute('id')!;

  // Phase 1 - Determine parent child relationships
  for (let i = 0; i < $cells.length; i++) {
    const $cell = $cells.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;

    const parent = $cell.getAttribute('parent')!;
    if (parent !== '0') {
      if (!parentChild.has(parent)) {
        parentChild.set(parent, []);
      }
      if ($cell.getAttribute('style')?.startsWith('edgeLabel;')) continue;

      parentChild.get(parent)!.push($cell.getAttribute('id')!);
    }
  }

  // Phase 2 - process all objects
  const parents = new Map<string, Layer | DiagramNode | DiagramEdge>();
  for (let i = 0; i < $cells.length; i++) {
    const $cell = $cells.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;

    const parent = $cell.getAttribute('parent')!;
    const id = $cell.getAttribute('id')!;
    const value = $cell.getAttribute('value')!;

    // Ignore the root
    if (id === rootId) continue;

    // is layer?
    if (parent === rootId) {
      const layer = new Layer(id, value! === '' || !value ? 'Background' : value!, [], diagram);
      diagram.layers.add(layer, uow);
      if ($cell.getAttribute('visible') === '0') {
        diagram.layers.toggleVisibility(layer);
      }

      parents.set(id, layer);
    } else {
      const p = parents.get(parent);
      if (!p) {
        console.warn(`Parent ${parent} not found for ${id}`);
        continue;
      }

      assert.present(p);

      const layer = p instanceof Layer ? p : p!.layer;

      const $geometry = $cell.getElementsByTagName('mxGeometry').item(0)!;

      const $style = $cell.getAttribute('style')!;
      const style = parseStyle($style);

      const bounds = MxGeometry.boundsFrom($geometry);

      const props = getNodeProps(style);
      props.text!.text = hasValue(value) ? value : '';

      if ('rotation' in style) {
        bounds.r = Angle.toRad(parseNum(style.rotation, 0));
      }

      const nodes: DiagramElement[] = [];

      const shape = parseShape(drawioBuiltinShapes[style.shape!] ?? style.shape);

      if (shape) {
        props.drawio = { shape: btoa(await decode(shape)) };
        nodes.push(new DiagramNode(id, 'drawio', bounds, diagram, layer, props));
      } else if ($style.startsWith('text;')) {
        // Default spacing for text nodes are a bit different, so we need to adjust
        props.text!.top = parseNum(style.spacingTop, 0) + parseNum(style.spacing, 2);
        props.text!.bottom = parseNum(style.spacingBottom, 0) + parseNum(style.spacing, 2);

        nodes.push(new DiagramNode(id, 'text', bounds, diagram, layer, props));
      } else if ($style.startsWith('edgeLabel;')) {
        // Handle free-standing edge labels
        const edge = diagram.edgeLookup.get(parent);
        assert.present(edge);

        const textNode = createLabelNode(id, edge, value, props, '#ffffff', uow);
        nodes.push(textNode);

        queue.add(() => attachLabelNode(textNode, edge, $geometry, uow));
        queue.add(() => calculateLabelNodeActualSize(style, textNode, value, uow));
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

        const waypoints = Array.from(
          $geometry.getElementsByTagName('Array').item(0)?.getElementsByTagName('mxPoint') ?? []
        ).map($p => ({ point: MxPoint.pointFrom($p) }));

        parseArrow('start', style, props);
        parseArrow('end', style, props);

        const edge = new DiagramEdge(id, source, target, props, waypoints, diagram, layer);
        nodes.push(edge);
        parents.set(id, edge);

        // Post-pone attaching the edge to the source and target nodes until all
        // nodes have been processed
        queue.add(() => attachEdge(edge, $cell, style, uow));

        const value = $cell.getAttribute('value');
        if (hasValue(value)) {
          props.stroke!.enabled = false;

          const labelBg = style.labelBackgroundColor ?? 'transparent';
          const textNode = createLabelNode(`${id}-label`, edge, value, props, labelBg, uow);
          nodes.push(textNode);

          queue.add(() => attachLabelNode(textNode, edge, $geometry, uow));
          queue.add(() => calculateLabelNodeActualSize(style, textNode, value, uow));
        }
      } else if (parentChild.has(id)) {
        // Handle groups
        const node = new DiagramNode(id, 'group', bounds, diagram, layer, props);
        nodes.push(node);
        parents.set(id, node);
      } else if (style.shape === 'image' || 'image' in style) {
        const image = style.image ?? '';

        props.fill!.type = 'image';
        props.text!.valign = 'top';
        props.text!.align = 'center';

        if (!style.imageBorder) {
          props.stroke!.enabled = false;
        } else {
          props.stroke!.color = style.imageBorder;
        }

        if (image.startsWith('data:')) {
          const blob = dataURItoBlob(image);
          const attachment = await diagram.document.attachments.addAttachment(blob);

          props.fill!.image = {
            id: attachment.hash,
            fit: 'contain'
          };
        } else {
          props.fill!.image = {
            url: image,
            fit: 'contain'
          };
        }

        nodes.push(new DiagramNode(id, 'drawioImage', bounds, diagram, layer, props));
      } else if ('ellipse' in style || style.shape === 'ellipse') {
        props.text!.align = (style.align ?? 'center') as HAlign;
        nodes.push(new DiagramNode(id, 'circle', bounds, diagram, layer, props));
      } else if ('rhombus' in style) {
        nodes.push(new DiagramNode(id, 'diamond', bounds, diagram, layer, props));
      } else if (style.shape === 'parallelogram') {
        props.parallelogram = {
          slant: parseNum(style.size, 20)
        };
        nodes.push(new DiagramNode(id, 'parallelogram', bounds, diagram, layer, props));
      } else if (style.shape === 'hexagon') {
        props.hexagon = {
          size: parseNum(style.size, 25)
        };
        nodes.push(new DiagramNode(id, 'hexagon', bounds, diagram, layer, props));
      } else if (style.shape === 'cylinder3') {
        props.shapeCylinder = {
          size: parseNum(style.size, 50) * 2
        };
        nodes.push(new DiagramNode(id, 'cylinder', bounds, diagram, layer, props));
      } else if (style.shape === 'process') {
        props.process = {
          size: parseNum(style.size, 0.125) * 100
        };
        nodes.push(new DiagramNode(id, 'process', bounds, diagram, layer, props));
      } else if ('triangle' in style) {
        nodes.push(new DiagramNode(id, 'triangle', bounds, diagram, layer, props));
      } else if (style.shape === 'mxgraph.arrows2.arrow') {
        let type = 'arrow-right';
        if (style.direction === 'north') {
          type = 'arrow-up';
        } else if (style.direction === 'south') {
          type = 'arrow-down';
        }

        props.shapeArrow = {};
        props.shapeArrow.notch = parseNum(style.notch, 0);
        props.shapeArrow.y = parseNum(style.dy, 0.2) * 50;
        props.shapeArrow.x = parseNum(style.dx, 20);

        nodes.push(new DiagramNode(id, type, bounds, diagram, layer, props));
      } else {
        if (style.rounded === '1') {
          props.roundedRect = {
            radius: (parseNum(style.arcSize, 10) * Math.min(bounds.w, bounds.h)) / 100
          };
          nodes.push(new DiagramNode(id, 'rounded-rect', bounds, diagram, layer, props));
        } else {
          nodes.push(new DiagramNode(id, 'rect', bounds, diagram, layer, props));
        }
      }

      // Attach all nodes created to their parent (group and/or layer)
      for (const node of nodes) {
        if (p instanceof DiagramNode) {
          // Need to offset the bounds according to the parent

          const newBounds = {
            x: node.bounds.x + p.bounds.x,
            y: node.bounds.y + p.bounds.y,
            w: node.bounds.w,
            h: node.bounds.h,
            r: 0
          };

          node.setBounds(newBounds, uow);

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
  // eslint-disable-next-line no-constant-condition
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

export const drawioReader = async (
  contents: string,
  documentFactory: DocumentFactory,
  // @ts-ignore
  diagramFactor: DiagramFactory<Diagram>
): Promise<DiagramDocument> => {
  const start = new Date().getTime();

  const doc = documentFactory();

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

    const bounds = Box.boundingBox(diagram.visibleElements().map(e => e.bounds));

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

  console.log(`Duration: ${new Date().getTime() - start}`);

  return doc;
};
