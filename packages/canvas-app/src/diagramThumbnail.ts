import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { NoOpCRDTMap, NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Diagram, type DiagramCRDT } from '@diagram-craft/model/diagram';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { StencilElements } from '@diagram-craft/model/stencilRegistry';

export const createStencilDiagram = (defs: Registry) => {
  const id = newid();
  const doc = new DiagramDocument(defs, true, new NoOpCRDTRoot());
  const d = new Diagram(id, id, doc, new NoOpCRDTMap<DiagramCRDT>());

  const layer = new RegularLayer(newid(), newid(), [], d);
  UnitOfWork.executeSilently(d, uow => d.layers.add(layer, uow));

  return { diagram: d, layer };
};

export const createThumbnail = (
  factory: (
    diagram: Diagram,
    layer: RegularLayer,
    uow: UnitOfWork
  ) => StencilElements | Array<DiagramElement>,
  definitions: Registry,
  opts?: { padding: number }
) => {
  const { diagram, layer } = createStencilDiagram(definitions);

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

    for (const el of elements) {
      layer.addElement(el, uow);
      if (isNode(el)) el.invalidateAnchors(uow);
    }

    const padding = opts?.padding ?? 0;
    diagram.viewBox.dimensions = Box.grow(bounds, 2 * padding);
    diagram.viewBox.offset = { x: -padding, y: -padding };

    return { diagram, layer, elements, bounds };
  });
};
