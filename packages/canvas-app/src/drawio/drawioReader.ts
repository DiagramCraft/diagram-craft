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

const parseStyle = (style: string) => {
  const parts = style.split(';');
  const result: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...value] = part.split('=');
    result[key] = value.join('=');
  }
  return result;
};

const parseShape = (shape: string | undefined) => {
  if (!shape) return undefined;
  return /^stencil\(([^)]+)\)$/.exec(shape)![1];
};

const angleFromDirection = (s: string) => {
  if (s === 'north') return -Math.PI / 2;
  if (s === 'south') return Math.PI / 2;
  if (s === 'east') return 0;
  if (s === 'west') return Math.PI;
  return 0;
};

class WorkQueue {
  queue: Array<() => void> = [];

  add(work: () => void) {
    this.queue.push(work);
  }

  run() {
    for (const work of this.queue) {
      work();
    }
  }
}

const parseArrow = (t: 'start' | 'end', style: Record<string, string>, props: NodeProps) => {
  const type = style[`${t}Arrow`];
  const size = style[`${t}Size`];
  if (type && type !== 'none') {
    if (type !== 'open') {
      console.warn(`Arrow type ${type} not yet supported`);
    }

    (props as EdgeProps).arrow ??= {};
    (props as EdgeProps).arrow!.end = {
      type: 'SQUARE_STICK_ARROW',
      size: parseNum(size, 3) * 15
    };
  }
};

const pointFromMxPoint = (offset: Element) => {
  return Point.of(xNum(offset, 'x', 0), xNum(offset, 'y', 0));
};

const hasValue = (value: string) => {
  if (value.startsWith('<')) {
    try {
      const d = new DOMParser().parseFromString(value, 'text/html');
      const text = d.body.textContent;
      return text && text.trim() !== '';
    } catch (e) {
      // Ignore
    }
  }
  return true;
};

const makeLabelNodeResizer =
  (style: Record<string, string>, textNode: DiagramNode, value: string, uow: UnitOfWork) => () => {
    const $el = document.createElement('div');
    $el.style.visibility = 'hidden';
    $el.style.position = 'absolute';
    $el.style.width = 'auto';
    document.body.appendChild($el);

    const css: string[] = [];

    css.push('font-size: ' + parseNum(style.fontSize, 12) + 'px');
    css.push('font-family: ' + (style.fontFamily ?? 'sans-serif'));
    css.push('direction: ltr');
    css.push('letter-spacing: 0px');
    css.push('line-height: 120%');
    css.push('color: black');

    $el.innerHTML = `<span style="${css.join(';')}">${value}</span>`;

    textNode.setBounds(
      {
        x: textNode.bounds.x,
        y: textNode.bounds.y,
        w: $el.offsetWidth + 1,
        h: $el.offsetHeight,
        r: 0
      },
      uow
    );
  };

const parseMxGraphModel = async ($el: Element, diagram: Diagram) => {
  const uow = UnitOfWork.throwaway(diagram);
  const queue = new WorkQueue();

  const parentChild = new Map<string, string[]>();
  const parents = new Map<string, Layer | DiagramNode | DiagramEdge>();

  const $cells = $el.getElementsByTagName('root').item(0)!.getElementsByTagName('mxCell');

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

  for (let i = 0; i < $cells.length; i++) {
    const $cell = $cells.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;

    const parent = $cell.getAttribute('parent')!;
    const id = $cell.getAttribute('id')!;

    if (parent === '0') {
      const val = $cell.getAttribute('value');
      const layer = new Layer(id, val! === '' || !val ? 'Background' : val!, [], diagram);
      diagram.layers.add(layer, uow);
      if ($cell.getAttribute('visible') === '0') {
        diagram.layers.toggleVisibility(layer);
      }

      parents.set(id, layer);
    } else {
      const p = parents.get(parent);
      if (!p) continue;

      const layer = p instanceof Layer ? p : p!.layer;

      const $geometry = $cell.getElementsByTagName('mxGeometry').item(0)!;

      const $style = $cell.getAttribute('style')!;
      const style = parseStyle($style);

      const bounds = {
        x: xNum($geometry, 'x', 0),
        y: xNum($geometry, 'y', 0),
        w: xNum($geometry, 'width', 100),
        h: xNum($geometry, 'height', 100),
        r: 0
      };

      const props: NodeProps = {};

      const value = $cell.getAttribute('value')!;

      props.text = {
        text: value ? value : '',
        fontSize: parseNum(style.fontSize, 12),
        font: style.fontFamily,
        color: style.fontColor,
        top: parseNum(style.spacingTop, 5) + parseNum(style.spacing, 2),
        bottom: parseNum(style.spacingBottom, 5) + parseNum(style.spacing, 2),
        left: parseNum(style.spacingLeft, 0) + parseNum(style.spacing, 2),
        right: parseNum(style.spacingRight, 0) + parseNum(style.spacing, 2),
        align: (style.align || 'center') as 'left' | 'center' | 'right',
        valign: (style.verticalAlign || 'middle') as 'top' | 'middle' | 'bottom'
      };

      if (style.fontStyle === '1') {
        props.text.bold = true;
      } else if (style.fontStyle === '2') {
        props.text.italic = true;
      } else if (style.fontStyle === '3') {
        props.text.bold = true;
        props.text.italic = true;
      }

      props.fill = {
        color: style.fillColor
      };

      if (style.gradientColor && style.gradientColor !== 'none') {
        props.fill.type = 'gradient';
        props.fill.color2 = style.gradientColor;
        props.fill.gradient = {
          type: 'linear',
          direction: angleFromDirection(style.gradientDirection ?? 'south')
        };
      }

      if (style.opacity && style.opacity !== '100') {
        props.effects ??= {};
        props.effects.opacity = parseNum(style.opacity, 100) / 100;
      }

      props.stroke = {
        color: style.strokeColor
      };

      if (style.dashed === '1') {
        props.stroke.pattern = 'DASHED';
        props.stroke.patternSpacing = parseNum(style.dashPattern, 30);
        props.stroke.patternSize = parseNum(style.dashPattern, 30);
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

      props.geometry = {
        flipH: style.flipH === '1',
        flipV: style.flipV === '1'
      };

      let node: DiagramElement | undefined = undefined;

      let shape: string | undefined = undefined;

      if (style.shape === 'actor') {
        shape = parseShape(
          'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
        );
      } else {
        shape = parseShape(style.shape);
      }

      if (shape) {
        const s = await decode(shape!);
        props.drawio = { shape: btoa(s) };
        node = new DiagramNode(id, 'drawio', bounds, diagram, layer, props);
      } else if ($style.startsWith('text;')) {
        props.text.top = parseNum(style.spacingTop, 0) + parseNum(style.spacing, 2);
        props.text.bottom = parseNum(style.spacingBottom, 0) + parseNum(style.spacing, 2);
        props.text.left = parseNum(style.spacingLeft, 0) + parseNum(style.spacing, 2);
        props.text.right = parseNum(style.spacingRight, 0) + parseNum(style.spacing, 2);
        node = new DiagramNode(id, 'text', bounds, diagram, layer, props);
      } else if ($style.startsWith('edgeLabel;')) {
        // Find edge
        const edgeId = $cell.getAttribute('parent')!;
        const edge = diagram.edgeLookup.get(edgeId);

        assert.present(edge);

        const textNode = new DiagramNode(
          id,
          'text',
          {
            x: edge.bounds.x,
            y: edge.bounds.w,
            w: 5,
            h: 100,
            r: 0
          },
          diagram,
          layer,
          {
            text: {
              text: $cell.getAttribute('value') ?? '',
              align: 'center',
              fontSize: parseNum(style.fontSize, 12)
            },
            fill: {
              enabled: true,
              type: 'solid',
              color: 'white'
            }
          }
        );

        // Add text node to any parent group
        if (edge.parent) {
          edge.parent.setChildren([...edge.parent.children, textNode], uow);
        }

        edge.layer.addElement(textNode, uow);

        const xOffset = (xNum($geometry, 'x', 0) + 1) / 2;

        const offset = Array.from($geometry.getElementsByTagName('mxPoint')).find(
          e => e.getAttribute('as') === 'offset'
        );
        edge.addLabelNode(
          {
            id,
            type: 'horizontal',
            node: textNode,
            offset: offset
              ? // TODO: add or subtract here depends on the direction of the arrow at this point
                Point.add(pointFromMxPoint(offset), {
                  x: 0,
                  y: xNum($geometry, 'y', 0)
                })
              : Point.ORIGIN,
            timeOffset: xOffset
          },
          uow
        );

        // TODO: Need to add font size to make this work properly
        queue.add(makeLabelNodeResizer(style, textNode, value, uow));
      } else if ($geometry.getElementsByTagName('mxPoint').length > 0) {
        const points = Array.from($geometry.getElementsByTagName('mxPoint')).map($p => {
          return {
            x: xNum($p, 'x', 0),
            y: xNum($p, 'y', 0),
            as: $p.getAttribute('as')
          };
        });

        parseArrow('start', style, props);
        parseArrow('end', style, props);

        const sourcePoint = points.find(p => p.as === 'sourcePoint');
        const targetPoint = points.find(p => p.as === 'targetPoint');

        const source = $cell.getAttribute('source')!;
        const target = $cell.getAttribute('target')!;

        const waypoints = Array.from(
          $geometry.getElementsByTagName('Array').item(0)?.getElementsByTagName('mxPoint') ?? []
        ).map($p => {
          return {
            point: {
              x: xNum($p, 'x', 0),
              y: xNum($p, 'y', 0)
            }
          };
        });

        node = new DiagramEdge(
          id,
          new FreeEndpoint(sourcePoint ?? Point.ORIGIN),
          new FreeEndpoint(targetPoint ?? Point.ORIGIN),
          props,
          waypoints ?? [],
          diagram,
          layer
        );

        const value = $cell.getAttribute('value');
        if (value && value !== '' && hasValue(value)) {
          const textNode = new DiagramNode(
            id + '-label',
            'text',
            {
              x: node.bounds.x,
              y: node.bounds.w,
              w: 5,
              h: 100,
              r: 0
            },
            diagram,
            layer,
            {
              text: {
                text: $cell.getAttribute('value') ?? '',
                align: 'center',
                fontSize: parseNum(style.fontSize, 12)
              },
              fill: {
                enabled: true,
                type: 'solid',
                color: style.labelBackgroundColor ?? 'transparent'
              }
            }
          );

          // Add text node to any parent group
          if (node.parent) {
            node.parent.setChildren([...node.parent.children, textNode], uow);
          }

          queue.add(() => {
            node!.layer.addElement(textNode, uow);
          });
          queue.add(makeLabelNodeResizer(style, textNode, value, uow));

          const xOffset = (xNum($geometry, 'x', 0) + 1) / 2;

          const offset = Array.from($geometry.getElementsByTagName('mxPoint')).find(
            e => e.getAttribute('as') === 'offset'
          );
          (node as DiagramEdge).addLabelNode(
            {
              id: id + '-label',
              type: 'horizontal',
              node: textNode,
              offset: offset
                ? // TODO: add or subtract here depends on the direction of the arrow at this point
                  Point.subtract(pointFromMxPoint(offset), {
                    x: 0,
                    y: xNum($geometry, 'y', 0)
                  })
                : Point.ORIGIN,
              timeOffset: xOffset
            },
            uow
          );
        }

        queue.add(() => {
          const edge = node! as DiagramEdge;

          if (source) {
            const sourceNode = diagram.nodeLookup.get(source);
            if (sourceNode) {
              const exitX = Number(style.exitX ?? 0.5);
              const exitY = Number(style.exitY ?? 0.5);

              edge.setStart(
                new FixedEndpoint(
                  {
                    x: exitX,
                    y: exitY
                  },
                  sourceNode
                ),
                uow
              );
            }
          }

          if (target) {
            const targetNode = diagram.nodeLookup.get(target);
            if (targetNode) {
              const entryX = Number(style.entryX ?? 0.5);
              const entryY = Number(style.entryY ?? 0.5);

              edge.setEnd(
                new FixedEndpoint(
                  {
                    x: entryX,
                    y: entryY
                  },
                  targetNode
                ),
                uow
              );
            }
          }
        });

        parents.set(id, node as DiagramEdge);
      } else if (parentChild.has(id)) {
        node = new DiagramNode(id, 'group', bounds, diagram, layer, props);
        parents.set(id, node as DiagramNode);
      } else {
        // Fallback on rect

        node = new DiagramNode(id, 'rect', bounds, diagram, layer, props);
      }

      if (node) {
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
          queue.add(() => {
            p.setChildren([...p.children, node], uow);
          });
        } else {
          layer.addElement(node, uow);
        }
      }
    }
  }

  queue.run();
};

async function decode(data: string) {
  const binaryContents = atob(data);

  const arr = Uint8Array.from(binaryContents, function (c) {
    return c.charCodeAt(0);
  });

  const output: Uint8Array[] = [];

  const ds = new DecompressionStream('deflate-raw');

  const writer = ds.writable.getWriter();
  writer.write(arr);
  writer.close();

  const reader = ds.readable.getReader();

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
  diagramFactor: DiagramFactory<Diagram>
): Promise<DiagramDocument> => {
  const start = new Date().getTime();

  const parser = new DOMParser();
  const $doc = parser.parseFromString(contents, 'application/xml');

  const $diagram = $doc.getElementsByTagName('diagram').item(0)!;

  const s = await decode($diagram.textContent!);
  const $mxGraphModel = parser.parseFromString(s, 'application/xml').documentElement;

  const doc = documentFactory();
  const diagram = new Diagram('1', $diagram.getAttribute('name')!, doc);
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

  console.log(`Duration: ${new Date().getTime() - start}`);

  return doc;
};
