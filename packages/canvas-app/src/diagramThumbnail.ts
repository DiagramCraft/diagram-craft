import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { StencilElements } from '@diagram-craft/model/stencilRegistry';
import { StencilUtils } from '@diagram-craft/model/stencilUtils';

export const createThumbnail = (
  factory: (
    diagram: Diagram,
    layer: RegularLayer,
    uow: UnitOfWork
  ) => StencilElements | Array<DiagramElement>,
  definitions: Registry,
  opts?: { padding: number }
) => {
  const { diagram, layer } = StencilUtils.makeDiagram(definitions);

  return UnitOfWork.executeSilently(diagram, uow => {
    const ret = factory(diagram, layer, uow);
    let elements: Array<DiagramElement>;
    let bounds: Box;
    if ('bounds' in ret) {
      bounds = ret.bounds;
      elements = ret.elements;
    } else {
      elements = ret;
      bounds = Box.boundingBox(elements.map(e => e.bounds));
    }

    elements.filter(isNode).forEach(e => e.invalidateAnchors(uow));

    const padding = opts?.padding ?? 0;
    diagram.viewBox.dimensions = Box.grow(bounds, 2 * padding);
    diagram.viewBox.offset = { x: -padding, y: -padding };

    return { diagram, layer, elements, bounds };
  });
};

export const createThumbnail2 = (
  factory: (registry: Registry) => StencilElements,
  definitions: Registry,
  opts?: { padding: number }
) => {
  const { elements, diagram, bounds, layer } = factory(definitions);

  return UnitOfWork.executeSilently(diagram, uow => {
    elements.filter(isNode).forEach(e => e.invalidateAnchors(uow));

    const padding = opts?.padding ?? 0;
    diagram.viewBox.dimensions = Box.grow(bounds, 2 * padding);
    diagram.viewBox.offset = { x: -padding, y: -padding };

    return { diagram, layer, elements, bounds };
  });
};
