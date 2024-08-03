import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARROW_SHAPES } from '@diagram-craft/canvas/arrowShapes';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { newid } from '@diagram-craft/utils/id';
import { AnchorEndpoint, FreeEndpoint } from '@diagram-craft/model/endpoint';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { registerUMLShapes } from '@diagram-craft/canvas-drawio/shapes/uml/uml';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { Scale } from '@diagram-craft/geometry/transform';

const SIZES = [50, 80, 100, 120, 150];
const WIDTHS = [1, 2, 3, 4, 5];

const writeArrow = (
  arrow: keyof typeof ARROW_SHAPES,
  y: number,
  layer: Layer,
  diagram: Diagram
) => {
  const n = new DiagramNode(
    newid(),
    'text',
    {
      x: 10,
      y: y,
      w: 300,
      h: 20,
      r: 0
    },
    diagram,
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
  layer.addElement(n, UnitOfWork.immediate(diagram));

  y += 30;
  for (let w = 0; w < WIDTHS.length; w++) {
    for (let s = 0; s < SIZES.length; s++) {
      const edge = new DiagramEdge(
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
        diagram,
        layer
      );
      layer.addElement(edge, UnitOfWork.immediate(diagram));
    }
  }

  for (let s = 0; s < SIZES.length; s++) {
    const n = new DiagramNode(
      newid(),
      'rect',
      {
        x: 10 + 670,
        y: y + s * 30 - 15,
        w: 20,
        h: 30,
        r: 0
      },
      diagram,
      layer,
      {
        anchors: {
          type: 'none'
        }
      },
      {},
      { text: '' }
    );
    layer.addElement(n, UnitOfWork.immediate(diagram));

    const edge = new DiagramEdge(
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
      diagram,
      layer
    );
    layer.addElement(edge, UnitOfWork.immediate(diagram));

    layer.stackModify([n], 10, UnitOfWork.immediate(diagram));
  }
};

const arrowsTestFile = async () => {
  const document = new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry());

  const diagram = new Diagram('arrows', 'Arrows', document);
  document.addDiagram(diagram);

  const layer = new Layer('default', 'Default', [], diagram);
  diagram.layers.add(layer, UnitOfWork.immediate(diagram));

  let y = 10;

  for (const arrow of Object.keys(ARROW_SHAPES)) {
    writeArrow(arrow, y, layer, diagram);
    y += 200;
    //if (y > 2000) break;
  }

  diagram.canvas = {
    x: 0,
    y: 0,
    w: 1000,
    h: y + 200
  };

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'public', 'sample', 'arrows.json'),
    JSON.stringify(await serializeDiagramDocument(document), undefined, '  ')
  );
};

const writeShape = (
  shape: string,
  factory: (diagram: Diagram) => DiagramNode,
  y: number,
  layer: Layer,
  diagram: Diagram
) => {
  const n = new DiagramNode(
    newid(),
    'text',
    {
      x: 10,
      y: y,
      w: 300,
      h: 20,
      r: 0
    },
    diagram,
    layer,
    {
      text: {
        align: 'left'
      }
    },
    {},
    {
      text: shape
    },
    []
  );
  layer.addElement(n, UnitOfWork.immediate(diagram));

  y += 30;
  let x = 10;

  const uow = new UnitOfWork(diagram, false, false);

  const xDiff = 110;

  const n1 = factory(diagram).duplicate(undefined, `${shape}-1`);
  n1.transform([new Scale(100 / n1.bounds.w, 100 / n1.bounds.h)], uow);
  n1.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n1.invalidateAnchors(uow);
  layer.addElement(n1, uow);

  x += xDiff;

  const n2 = factory(diagram).duplicate(undefined, `${shape}-2`);
  n2.transform([new Scale(100 / n2.bounds.w, 100 / n2.bounds.h)], uow);
  n2.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n2.setText('With Text', uow);
  n2.invalidateAnchors(uow);
  layer.addElement(n2, uow);
  x += xDiff;

  const n3 = factory(diagram).duplicate(undefined, `${shape}-3`);
  n3.transform([new Scale(100 / n3.bounds.w, 100 / n3.bounds.h)], uow);
  n3.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n3.updateProps(p => {
    p.fill ??= {};
    p.fill.color = '#ffffcc';
  }, uow);
  n3.invalidateAnchors(uow);
  layer.addElement(n3, uow);
  x += xDiff;

  const n4 = factory(diagram).duplicate(undefined, `${shape}-4`);
  n4.transform([new Scale(100 / n4.bounds.w, 100 / n4.bounds.h)], uow);
  n4.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n4.updateProps(p => {
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
  n4.invalidateAnchors(uow);
  layer.addElement(n4, uow);
  x += xDiff;

  const n5 = factory(diagram).duplicate(undefined, `${shape}-5`);
  n5.transform([new Scale(100 / n5.bounds.w, 100 / n5.bounds.h)], uow);
  n5.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n5.updateProps(p => {
    p.fill ??= {};
    p.fill.color = 'white';

    p.effects = {
      rounding: true,
      roundingAmount: 10
    };
  }, uow);
  n5.invalidateAnchors(uow);
  layer.addElement(n5, uow);
  x += xDiff;

  const n6 = factory(diagram).duplicate(undefined, `${shape}-6`);
  n6.transform([new Scale(100 / n6.bounds.w, 100 / n6.bounds.h)], uow);
  n6.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n6.updateProps(p => {
    p.fill ??= {};
    p.fill.color = 'white';

    p.effects = {
      sketch: true
    };
  }, uow);
  n6.invalidateAnchors(uow);
  layer.addElement(n6, uow);
  x += xDiff;

  const n7 = factory(diagram).duplicate(undefined, `${shape}-7`);
  n7.transform([new Scale(100 / n7.bounds.w, 100 / n7.bounds.h)], uow);
  n7.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n7.updateProps(p => {
    p.fill ??= {};
    p.fill.color = 'lightblue';

    p.effects = {
      sketch: true,
      sketchFillType: 'fill'
    };
  }, uow);
  n7.invalidateAnchors(uow);
  layer.addElement(n7, uow);
  x += xDiff;

  const n8 = factory(diagram).duplicate(undefined, `${shape}-8`);
  n8.transform([new Scale(100 / n8.bounds.w, 100 / n8.bounds.h)], uow);
  n8.setBounds({ x: x, y: y, w: 100, h: 100, r: 0 }, uow);
  n8.updateProps(p => {
    p.fill ??= {};
    p.fill.color = 'lightblue';

    p.effects = {
      sketch: true,
      sketchFillType: 'hachure'
    };
  }, uow);
  n8.invalidateAnchors(uow);
  layer.addElement(n8, uow);
  x += xDiff + 50;

  const rotation = Math.PI / 6;
  const n9 = factory(diagram).duplicate(undefined, `${shape}-9`);
  n9.transform([new Scale(100 / n9.bounds.w, 100 / n9.bounds.h)], uow);
  n9.setBounds({ x: x, y: y, w: 100, h: 100, r: rotation }, uow);
  n9.setText('With Text', uow);
  n9.invalidateAnchors(uow);
  layer.addElement(n9, uow);
  x += xDiff;

  n9.anchors.forEach(a => {
    if (a.type === 'point') {
      const start = n9._getAnchorPosition(a.id);
      const dest = Point.add(start, Vector.fromPolar((a.normal ?? 0) + rotation, 20));
      const e = new DiagramEdge(
        newid(),
        new AnchorEndpoint(n9, a.id),
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
        diagram,
        layer
      );
      layer.addElement(e, UnitOfWork.immediate(diagram));
    } else if (a.type === 'edge') {
      const offset = Vector.scale(Vector.from(a.start, a.end!), 0.5);
      const start = n9._getPositionInBounds(Point.add(a.start, offset));
      const dest = Point.add(start, Vector.fromPolar((a.normal ?? 0) + rotation, 20));
      const e = new DiagramEdge(
        newid(),
        new AnchorEndpoint(n9, a.id, offset),
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
        diagram,
        layer
      );
      layer.addElement(e, UnitOfWork.immediate(diagram));
    }
  });
};

const shapesTestFile = async (
  nodeDefinitions: NodeDefinitionRegistry,
  pkg: string,
  file: string
) => {
  const document = new DiagramDocument(nodeDefinitions, defaultEdgeRegistry());

  const diagram = new Diagram('shapes', 'Shapes', document);
  document.addDiagram(diagram);

  const layer = new Layer('default', 'Default', [], diagram);
  diagram.layers.add(layer, UnitOfWork.immediate(diagram));

  let y = 10;

  for (const stencil of nodeDefinitions.stencilRegistry.get(pkg)!.stencils) {
    if (stencil.id === 'table' || stencil.id === 'container') continue;
    writeShape(stencil.name ?? stencil.id, stencil.node, y, layer, diagram);
    y += 200;
  }

  diagram.canvas = {
    x: 0,
    y: 0,
    w: 1200,
    h: y + 200
  };

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'public', 'sample', file),
    JSON.stringify(await serializeDiagramDocument(document), undefined, '  ')
  );
};

const nodeDefinitions = defaultNodeRegistry();
await registerUMLShapes(nodeDefinitions);

arrowsTestFile();
shapesTestFile(nodeDefinitions, 'default', 'shapes.json');
shapesTestFile(nodeDefinitions, 'uml', 'shapes-uml.json');
