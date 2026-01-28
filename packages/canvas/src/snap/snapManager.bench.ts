import { bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { SnapManager } from './snapManager';
import { StencilRegistry } from '@diagram-craft/model/elementDefinitionRegistry';

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

const stencilRegistry = new StencilRegistry();
const { diagram: d } = DocumentBuilder.empty(
  '1',
  '1',
  new DiagramDocument(defaultNodeRegistry(stencilRegistry), defaultEdgeRegistry(stencilRegistry))
);

UnitOfWork.execute(d, uow => {
  for (let i = 0; i < 1000; i++) {
    (d.activeLayer as RegularLayer).addElement(
      ElementFactory.node(i.toString(), 'rect', randomBox(), d.activeLayer as RegularLayer, {}, {}),
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
