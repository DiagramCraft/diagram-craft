import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { parseNum, xNum } from './utils';
import { Box } from '@diagram-craft/geometry/box';

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

const parseMxGraphModel = async ($el: Element, diagram: Diagram) => {
  const uow = UnitOfWork.throwaway(diagram);

  const parentChild = new Map<string, string[]>();
  const parents = new Map<string, Layer | DiagramNode>();

  const $cells = $el.getElementsByTagName('root').item(0)!.getElementsByTagName('mxCell');

  for (let i = 0; i < $cells.length; i++) {
    const $cell = $cells.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;

    const parent = $cell.getAttribute('parent')!;
    if (parent !== '0') {
      if (!parentChild.has(parent)) {
        parentChild.set(parent, []);
      }
      parentChild.get(parent)!.push($cell.getAttribute('id')!);
    }
  }

  for (let i = 0; i < $cells.length; i++) {
    const $cell = $cells.item(i)!;
    if ($cell.nodeType !== Node.ELEMENT_NODE) continue;

    const parent = $cell.getAttribute('parent')!;
    const id = $cell.getAttribute('id')!;

    if (parent === '0') {
      const layer = new Layer(
        id,
        $cell.getAttribute('value')! === '' ? 'Background' : $cell.getAttribute('value')!,
        [],
        diagram
      );
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

      const style = parseStyle($cell.getAttribute('style')!);

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
        top: parseNum(style.spacingTop, 7),
        bottom: parseNum(style.spacingBottom, 7),
        left: parseNum(style.spacingLeft, 0),
        right: parseNum(style.spacingRight, 0),
        align: (style.align || 'center') as 'left' | 'center' | 'right',
        valign: (style.verticalAlign || 'middle') as 'top' | 'middle' | 'bottom'
      };
      props.fill = {
        color: style.fillColor
      };
      props.stroke = {
        color: style.strokeColor
      };
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

      let node: DiagramNode | undefined = undefined;

      const shape = parseShape(style.shape);
      if (shape) {
        const s = await decode(shape!);

        props.drawio = {
          shape: btoa(s)
        };

        node = new DiagramNode(id, 'drawio', bounds, diagram, layer, props);
      } else if (parentChild.has(id)) {
        node = new DiagramNode(id, 'group', bounds, diagram, layer, props);
        parents.set(id, node);
      } else if ($geometry.getElementsByTagName('mxPoint').length > 0) {
        // This is a path, ignore for now
      } else {
        // Fallback on rect

        node = new DiagramNode(id, 'rect', bounds, diagram, layer, props);
      }

      if (node) {
        if (p instanceof DiagramNode) {
          // Need to offset the bounds according to the parent

          node.setBounds(
            {
              x: bounds.x + p.bounds.x,
              y: bounds.y + p.bounds.y,
              w: bounds.w,
              h: bounds.h,
              r: 0
            },
            uow
          );

          p.addChild(node, uow);
        } else {
          layer.addElement(node, uow);
        }
      }
    }
  }
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

  diagram.canvas = {
    w: Math.max(bounds.w + 40, xNum($mxGraphModel, 'pageWidth', 100)),
    h: Math.max(bounds.h + 40, xNum($mxGraphModel, 'pageHeight', 100)),
    x: 0,
    y: 0
  };

  diagram.viewBox.offset = { x: 0, y: 0 };
  diagram.viewBox.zoomLevel = xNum($mxGraphModel, 'pageScale', 1);

  return doc;
};
