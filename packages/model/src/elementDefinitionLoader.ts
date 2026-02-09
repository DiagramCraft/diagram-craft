import type { Stencil } from './stencilRegistry';
import { type Diagram } from './diagram';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box } from '@diagram-craft/geometry/box';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

// biome-ignore lint/suspicious/noExplicitAny: false positive
export const loadStencilsFromYaml = (stencils: any) => {
  const dest: Array<Stencil> = [];
  for (const stencil of stencils.stencils) {
    const mkNode = (diagram: Diagram) => {
      const layer = diagram.activeLayer as RegularLayer;

      return UnitOfWork.execute(diagram, uow => {
        const elements = deserializeDiagramElements(
          stencil.node ? [stencil.node] : stencil.elements,
          layer,
          uow,
          undefined,
          new ElementLookup<DiagramNode>(),
          new ElementLookup<DiagramEdge>()
        );
        elements.forEach(e => layer.addElement(e, uow));

        return { elements: elements, bounds: Box.boundingBox(elements.map(e => e.bounds)) };
      });
    };
    dest.push({
      id: stencil.id,
      name: stencil.name,
      styles: stencil.styles,
      settings: stencil.settings,
      elementsForPicker: mkNode,
      elementsForCanvas: mkNode,
      type: 'yaml'
    });
  }
  return dest;
};
