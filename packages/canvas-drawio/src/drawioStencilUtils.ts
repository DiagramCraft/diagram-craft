import { Stencil } from '@diagram-craft/model/stencilRegistry';
import { assertDrawioShapeNodeDefinition } from './node-types/DrawioShape.nodeType';
import { newid } from '@diagram-craft/utils/id';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { DrawioStencil } from './drawioStencilLoader';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilUtils } from '@diagram-craft/model/stencilUtils';

export const toRegularStencil = (drawio: DrawioStencil): Stencil => {
  const mkNode = (registry: Registry) => {
    const { diagram, layer } = StencilUtils.makeDiagram(registry);

    const type = 'drawio';

    const def = diagram.document.registry.nodes.get(type);
    assertDrawioShapeNodeDefinition(def);

    return UnitOfWork.execute(diagram, uow => {
      const node = ElementFactory.node(newid(), type, Box.unit(), layer, drawio.props, {});
      const size = def.getSize(node);

      node.setBounds({ x: 0, y: 0, w: size.w, h: size.h, r: 0 }, uow);

      layer.addElement(node, uow);

      return { elements: [node], bounds: node.bounds, diagram, layer };
    });
  };
  return {
    id: drawio.key,
    name: drawio.key,
    elementsForPicker: mkNode,
    elementsForCanvas: mkNode,
    type: 'drawioXml'
  };
};
