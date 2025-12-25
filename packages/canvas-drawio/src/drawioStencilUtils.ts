import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { Diagram } from '@diagram-craft/model/diagram';
import { assertDrawioShapeNodeDefinition } from './DrawioShape.nodeType';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { DrawioStencil } from './drawioStencilLoader';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { getParser } from './drawioShapeParsers';
import { getLoader } from './drawioDefaults';

export const toRegularStencil = (drawio: DrawioStencil): Stencil => {
  const mkNode = ($d: Diagram) => {
    const type = 'drawio';

    const def = $d.document.nodeDefinitions.get(type);
    assertDrawioShapeNodeDefinition(def);

    const layer = $d.activeLayer;
    assertRegularLayer(layer);

    const n = ElementFactory.node(newid(), type, Box.unit(), layer, drawio.props, {});

    const size = def.getSize(n);
    n.setBounds({ x: 0, y: 0, w: size.w, h: size.h, r: 0 }, UnitOfWork.immediate($d));

    return n;
  };
  return {
    id: drawio.key,
    name: drawio.key,
    node: mkNode,
    canvasNode: mkNode
  };
};

export const isStencil = (shape: string | undefined) => {
  return shape?.startsWith('stencil(');
};

export const parseStencilString = (shape: string | undefined) => {
  if (!shape) return undefined;

  if (!shape.startsWith('stencil(')) {
    if (getParser(shape) || getLoader(shape)) {
      return undefined;
    } else {
      console.warn(`Unsupported shape ${shape}`);
      return undefined;
    }
  }

  return /^stencil\(([^)]+)\)$/.exec(shape)![1];
};
