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

const writeShape = (shape: string, y: number, layer: Layer, diagram: Diagram) => {
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

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {},
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {},
      {},
      {
        text: 'With Text'
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {
        fill: {
          color: '#ffffcc'
        }
      },
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {
        fill: {
          color: 'white'
        },
        shadow: {
          enabled: true,
          color: 'black',
          blur: 5,
          x: 5,
          y: 5
        }
      },
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {
        fill: {
          color: 'white'
        },
        effects: {
          rounding: true,
          roundingAmount: 10
        }
      },
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {
        fill: {
          color: 'white'
        },
        effects: {
          sketch: true
        }
      },
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;

  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {
        fill: {
          color: 'lightblue'
        },
        effects: {
          sketch: true,
          sketchFillType: 'fill'
        }
      },
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );
  x += 110;
  /*
  layer.addElement(
    new DiagramNode(
      newid(),
      shape,
      { x: x, y: y, w: 100, h: 100, r: 0 },
      diagram,
      layer,
      {
        fill: {
          color: 'lightblue'
        },
        effects: {
          sketch: true,
          sketchFillType: 'hachure'
        }
      },
      {},
      {
        text: ''
      },
      []
    ),
    UnitOfWork.immediate(diagram)
  );*/
};

const shapesTestFile = async () => {
  const nodeDefinitions = defaultNodeRegistry();
  const document = new DiagramDocument(nodeDefinitions, defaultEdgeRegistry());

  const diagram = new Diagram('shapes', 'Shapes', document);
  document.addDiagram(diagram);

  const layer = new Layer('default', 'Default', [], diagram);
  diagram.layers.add(layer, UnitOfWork.immediate(diagram));

  let y = 10;

  for (const shape of nodeDefinitions.list()) {
    if (
      shape === 'table' ||
      shape === 'tableRow' ||
      shape === 'group' ||
      shape === 'container' ||
      shape === 'swimlane' ||
      shape === 'generic-path'
    )
      continue;
    writeShape(shape, y, layer, diagram);
    y += 200;
  }

  diagram.canvas = {
    x: 0,
    y: 0,
    w: 1000,
    h: y + 200
  };

  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'public', 'sample', 'shapes.json'),
    JSON.stringify(await serializeDiagramDocument(document), undefined, '  ')
  );
};

arrowsTestFile();
shapesTestFile();
