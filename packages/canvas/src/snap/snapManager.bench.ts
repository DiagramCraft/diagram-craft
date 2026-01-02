import { bench, describe } from 'vitest';

import { Random } from '@diagram-craft/utils/random';
import { DocumentBuilder } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { SnapManager } from './snapManager';
import { UOW } from '@diagram-craft/model/uow';

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

UOW.execute(d, () => {
  for (let i = 0; i < 1000; i++) {
    (d.activeLayer as RegularLayer).addElement(
      ElementFactory.node(i.toString(), 'rect', randomBox(), d.activeLayer as RegularLayer, {}, {}),
      UOW.uow()
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
