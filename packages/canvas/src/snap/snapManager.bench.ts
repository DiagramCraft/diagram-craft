import { bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { EdgeDefinitionRegistry } from '@diagram-craft/model/edgeDefinitionRegistry';
import { NodeDefinitionRegistry } from '@diagram-craft/model/nodeDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { StencilRegistry } from '@diagram-craft/model/stencilRegistry';
import { SimpleEdgeDefinition } from '../components/BaseEdgeComponent';
import { RectNodeDefinition } from '../node-types/Rect.nodeType';
import { SnapManager } from './snapManager';

const r = new Random(123456);

const randomBox = () => {
  return {
    x: Math.round(r.nextFloat() * 1000),
    y: Math.round(r.nextFloat() * 1000),
    w: Math.round(r.nextFloat() * 100) + 1,
    h: Math.round(r.nextFloat() * 100) + 1,
    r: 0
  };
};

const opts = { time: 2000 };

const nodeRegistry = new NodeDefinitionRegistry();
nodeRegistry.register(new RectNodeDefinition());

const edgeRegistry = new EdgeDefinitionRegistry(new SimpleEdgeDefinition());

const { diagram: d } = DocumentBuilder.empty(
  '1',
  '1',
  new DiagramDocument({
    nodes: nodeRegistry,
    edges: edgeRegistry,
    stencils: new StencilRegistry()
  })
);

UnitOfWork.execute(d, uow => {
  for (let i = 0; i < 1000; i++) {
    (d.activeLayer as RegularLayer).addElement(
      ElementFactory.node({
        id: i.toString(),
        bounds: randomBox(),
        layer: d.activeLayer as RegularLayer
      }),
      uow
    );
  }
});

describe('snapManager', () => {
  const snapManager = SnapManager.create(d);
  bench(
    'snapManager',
    () => {
      snapManager.snapMove(randomBox());
    },
    opts
  );
});
