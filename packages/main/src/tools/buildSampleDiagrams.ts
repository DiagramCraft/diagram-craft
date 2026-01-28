import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram, DocumentBuilder } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { newid } from '@diagram-craft/utils/id';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { registerUMLShapes } from '@diagram-craft/canvas-drawio/shapes/uml/canvas-drawio-stencil-uml-loader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { Scale } from '@diagram-craft/geometry/transform';
import { Extent } from '@diagram-craft/geometry/extent';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { safeSplit } from '@diagram-craft/utils/safe';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { getTypedKeys } from '@diagram-craft/utils/object';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';

const SIZES = [50, 80, 100, 120, 150];
const WIDTHS = [1, 2, 3, 4, 5];

const writeArrow = (
  arrow: keyof typeof ARROW_SHAPES,
  y: number,
  layer: RegularLayer,
  diagram: Diagram
) => {
  const n = ElementFactory.node(
    newid(),
    'text',
    {
      x: 10,
      y: y,
      w: 300,
      h: 20,
      r: 0
    },
    layer,
    {
      text: {
        align: 'left'
      }
    },
    {},
    {
      text: arrow
    },
    []
  );
  UnitOfWork.execute(diagram, uow => (layer as RegularLayer).addElement(n, uow));

  y += 30;
  for (let w = 0; w < WIDTHS.length; w++) {
    for (let s = 0; s < SIZES.length; s++) {
      const edge = ElementFactory.edge(
        newid(),
        new FreeEndpoint({ x: 10 + w * 110, y: y + s * 30 }),
        new FreeEndpoint({ x: 80 + w * 110, y: y + s * 30 }),
        {
          arrow: {
            end: { size: SIZES[s], type: arrow }
          },
          stroke: {
            width: WIDTHS[w]
          },
          fill: {
            color: 'black'
          },
          lineHops: {
            type: 'none'
          }
        },
        {},
        [],
        layer
      );
      UnitOfWork.execute(diagram, uow => (layer as RegularLayer).addElement(edge, uow));
    }
  }

  for (let s = 0; s < SIZES.length; s++) {
    const n = ElementFactory.node(
      newid(),
      'rect',
      {
        x: 10 + 670,
        y: y + s * 30 - 15,
        w: 20,
        h: 30,
        r: 0
      },
      layer,
      {
        anchors: {
          type: 'none'
        }
      },
      {},
      { text: '' }
    );
    UnitOfWork.execute(diagram, uow => (layer as RegularLayer).addElement(n, uow));

    const edge = ElementFactory.edge(
      newid(),
      new FreeEndpoint({ x: 10 + 600, y: y + s * 30 }),
      new AnchorEndpoint(n, 'c'),
      {
        arrow: {
          end: { size: SIZES[s], type: arrow }
        },
        stroke: {
          width: 1
        },
        fill: {
          color: 'black'
        },
        lineHops: {
          type: 'none'
        }
      },
      {},
      [],
      layer
    );
    UnitOfWork.execute(diagram, uow => (layer as RegularLayer).addElement(edge, uow));

    UnitOfWork.execute(diagram, uow => layer.stackModify([n], 10, uow));
  }
};

const arrowsTestFile = async () => {
  const document = new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry());

  const { diagram, layer } = DocumentBuilder.empty('arrows', 'Arrows', document);

  let y = 10;

  for (const arrow of getTypedKeys(ARROW_SHAPES)) {
    writeArrow(arrow, y, layer, diagram);
    y += 200;
    //if (y > 2000) break;
  }

  UnitOfWork.executeSilently(diagram, uow =>
    diagram.setBounds(
      {
        x: 0,
        y: 0,
        w: 1000,
        h: y + 200
      },
      uow
    )
  );

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'public', 'sample', 'arrows.json'),
    JSON.stringify(await serializeDiagramDocument(document), undefined, '  ')
  );
};

type ShapeOpts = {
  yDiff: number;
  xDiff: number;
  startX: number;
  dimensions: Extent;
  shapesPerLine: number;
};

const SHAPES_DEFS = [
  (_n: DiagramNode, _uow: UnitOfWork) => {
    return 'default';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.setText('With Text', uow);
    return 'with text';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.updateProps(p => {
      p.fill ??= {};
      p.fill.color = '#ffffcc';
    }, uow);
    return 'with fill';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.updateProps(p => {
      p.fill ??= {};
      p.fill.color = 'white';

      p.shadow = {
        enabled: true,
        color: 'black',
        blur: 5,
        x: 5,
        y: 5
      };
    }, uow);
    return 'with shadow';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.updateProps(p => {
      p.fill ??= {};
      p.fill.color = 'white';

      p.effects = {
        rounding: true,
        roundingAmount: 10
      };
    }, uow);
    return 'with rounding';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.updateProps(p => {
      p.fill ??= {};
      p.fill.color = 'white';

      p.effects = {
        sketch: true
      };
    }, uow);
    return 'sketch';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.updateProps(p => {
      p.fill ??= {};
      p.fill.color = 'lightblue';

      p.effects = {
        sketch: true,
        sketchFillType: 'fill'
      };
    }, uow);
    return 'sketch-fill';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    n.updateProps(p => {
      p.fill ??= {};
      p.fill.color = 'lightblue';

      p.effects = {
        sketch: true,
        sketchFillType: 'hachure'
      };
    }, uow);
    return 'sketch-hachure';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    const rotation = Math.PI / 6;
    n.setBounds({ ...n.bounds, r: rotation }, uow);
    n.setText('With Text', uow);
    n.invalidateAnchors(uow);
    n.anchors.forEach(a => {
      assertRegularLayer(n.layer);
      if (a.type === 'point') {
        const start = n._getAnchorPosition(a.id);
        const dest = Point.add(start, Vector.fromPolar((a.normal ?? 0) + rotation, 20));
        const e = ElementFactory.edge(
          newid(),
          new AnchorEndpoint(n, a.id),
          new FreeEndpoint(dest),
          {
            stroke: {
              color: 'pink'
            },
            lineHops: {
              type: 'none'
            }
          },
          {},
          [],
          n.layer
        );
        UnitOfWork.execute(n.diagram, uow => (n.layer as RegularLayer).addElement(e, uow));
      } else if (a.type === 'edge') {
        const offset = Vector.scale(Vector.from(a.start, a.end!), 0.5);
        const start = n._getPositionInBounds(Point.add(a.start, offset));
        const dest = Point.add(start, Vector.fromPolar((a.normal ?? 0) + rotation, 20));
        const e = ElementFactory.edge(
          newid(),
          new AnchorEndpoint(n, a.id, offset),
          new FreeEndpoint(dest),
          {
            stroke: {
              color: 'green'
            },
            lineHops: {
              type: 'none'
            }
          },
          {},
          [],
          n.layer
        );
        UnitOfWork.execute(n.diagram, uow => (n.layer as RegularLayer).addElement(e, uow));
      }
    });
    return 'rotated-primary-anchors';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    const rotation = Math.PI / 6;
    n.setBounds({ ...n.bounds, r: rotation }, uow);
    n.setText('With Text', uow);
    n.updateProps(p => {
      p.debug = {
        boundingPath: true
      };
    }, uow);
    return 'bounding-path';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    const rotation = Math.PI / 6;
    n.setBounds({ ...n.bounds, r: rotation }, uow);
    n.setText('With Text', uow);
    n.updateProps(p => {
      p.debug = {
        anchors: true
      };
      p.anchors = {
        type: 'shape-defaults'
      };
    }, uow);
    return 'anchor-defaults';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    const rotation = Math.PI / 6;
    n.setBounds({ ...n.bounds, r: rotation }, uow);
    n.setText('With Text', uow);
    n.updateProps(p => {
      p.debug = {
        anchors: true
      };
      p.anchors = {
        type: 'per-edge',
        perEdgeCount: 2
      };
    }, uow);
    return 'anchor-per-edge';
  },
  (n: DiagramNode, uow: UnitOfWork) => {
    const rotation = Math.PI / 6;
    n.setBounds({ ...n.bounds, r: rotation }, uow);
    n.setText('With Text', uow);
    n.updateProps(p => {
      p.debug = {
        anchors: true
      };
      p.anchors = {
        type: 'directions',
        directionsCount: 4
      };
    }, uow);
    return 'anchor-per-direction';
  }
];

const writeShape = (
  shape: string,
  factory: (diagram: Diagram) => DiagramElement,
  y: number,
  layer: RegularLayer,
  diagram: Diagram,
  { xDiff, yDiff, startX, dimensions, shapesPerLine }: ShapeOpts
): { x: number; y: number } => {
  const n = ElementFactory.node(
    newid(),
    'text',
    {
      x: startX,
      y: y,
      w: 300,
      h: 20,
      r: 0
    },
    layer,
    {
      text: {
        align: 'left',
        bold: true
      }
    },
    {},
    {
      text: shape
    },
    []
  );
  UnitOfWork.execute(diagram, uow => (layer as RegularLayer).addElement(n, uow));

  y += 70;
  let maxX = startX;
  let x = startX;

  UnitOfWork.execute(diagram, uow => {
    for (let i = 0; i < SHAPES_DEFS.length; i++) {
      const def = SHAPES_DEFS[i]!;
      const el = factory(diagram).duplicate(undefined, `${shape}-${i}`);
      if (!isNode(el)) throw new Error('Expected node');

      el.transform([new Scale(dimensions.w / el.bounds.w, dimensions.h / el.bounds.h)], uow);
      el.setBounds({ x: x, y: y, ...dimensions, r: 0 }, uow);
      const name = def(el, uow);
      el.invalidateAnchors(uow);
      layer.addElement(el, uow);

      const label = ElementFactory.node(
        `${shape}-${i}-label`,
        'text',
        {
          x: x,
          y: y - 45,
          w: 300,
          h: 20,
          r: 0
        },
        layer,
        {
          text: {
            align: 'left'
          }
        },
        {},
        {
          text: name
        },
        []
      );
      layer.addElement(label, uow);

      x += xDiff;
      maxX = Math.max(maxX, x);

      if (i % shapesPerLine === shapesPerLine - 1) {
        x = startX;
        y += yDiff;
      }
    }
  });

  return { x: maxX, y: y + 150 };
};

const shapesTestFile = async (
  nodeDefinitions: NodeDefinitionRegistry,
  pkg: string,
  file: string,
  opts: ShapeOpts = {
    xDiff: 160,
    yDiff: 200,
    startX: 10,
    dimensions: { w: 100, h: 100 },
    shapesPerLine: Number.MAX_SAFE_INTEGER
  }
) => {
  const document = new DiagramDocument(nodeDefinitions, defaultEdgeRegistry());

  const { diagram, layer } = DocumentBuilder.empty('shapes', 'Shapes', document);

  if (pkg.startsWith('pkg:')) {
    let y = 10;

    for (const stencil of nodeDefinitions.stencilRegistry.get(pkg.slice(4)).stencils) {
      if (stencil.id === 'table' || stencil.id === 'container') continue;
      writeShape(stencil.name ?? stencil.id, stencil.node, y, layer, diagram, opts);
      y += opts.yDiff;
    }

    UnitOfWork.executeSilently(diagram, uow =>
      diagram.setBounds(
        {
          x: 0,
          y: 0,
          w: 2100,
          h: y + opts.yDiff
        },
        uow
      )
    );
  } else {
    const [, p, shape] = safeSplit(pkg, ':', 3);

    let x = 0;
    let y = 10;
    for (const stencil of nodeDefinitions.stencilRegistry.get(p).stencils) {
      if (stencil.id === shape) {
        const ret = writeShape(stencil.name ?? stencil.id, stencil.node, y, layer, diagram, opts);
        x = ret.x;
        y = ret.y;
        break;
      }
    }

    UnitOfWork.executeSilently(diagram, uow =>
      diagram.setBounds(
        {
          x: 0,
          y: 0,
          w: x + 20,
          h: y + opts.yDiff
        },
        uow
      )
    );
  }

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'public', 'sample', file),
    JSON.stringify(await serializeDiagramDocument(document), undefined, '  ')
  );
};

const nodeDefinitions = defaultNodeRegistry();
await registerUMLShapes(nodeDefinitions);

arrowsTestFile();
shapesTestFile(nodeDefinitions, 'pkg:default', 'shapes.json');
shapesTestFile(nodeDefinitions, 'pkg:arrow', 'shapes-arrow.json');
shapesTestFile(nodeDefinitions, 'pkg:uml', 'shapes-uml.json');
shapesTestFile(nodeDefinitions, 'shape:default:table', 'shape-default-table.json', {
  xDiff: 300,
  yDiff: 250,
  startX: 50,
  dimensions: {
    w: 200,
    h: 150
  },
  shapesPerLine: 5
});
