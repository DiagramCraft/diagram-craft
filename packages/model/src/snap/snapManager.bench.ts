import { bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { DocumentBuilder } from '../diagram';
import { DiagramDocument } from '../diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { UnitOfWork } from '../unitOfWork';
import { RegularLayer } from '../diagramLayerRegular';
import { DiagramNode } from '../diagramNode';

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

const { diagram: d } = DocumentBuilder.empty(
  '1',
  '1',
  new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry())
);

UnitOfWork.execute(d, uow => {
  for (let i = 0; i < 1000; i++) {
    (d.activeLayer as RegularLayer).addElement(
      new DiagramNode(i.toString(), 'rect', randomBox(), d, d.activeLayer, {}, {}),
      uow
    );
  }
});

describe('snapManager', () => {
  const snapManager = d.createSnapManager();
  bench(
    'snapManager',
    () => {
      snapManager!.snapMove(randomBox());
    },
    opts
  );
});
