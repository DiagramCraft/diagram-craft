import type { Stencil } from './stencilRegistry';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box } from '@diagram-craft/geometry/box';
import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilUtils } from '@diagram-craft/model/stencilUtils';

// biome-ignore lint/suspicious/noExplicitAny: false positive
export const loadStencilsFromYaml = (stencils: any) => {
  const dest: Array<Stencil> = [];
  for (const stencil of stencils.stencils) {
    const mkNode = (registry: Registry) => {
      const { diagram, layer } = StencilUtils.makeDiagram(registry);

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

        const bounds = Box.boundingBox(elements.map(e => e.bounds));
        return { elements, bounds, diagram, layer };
      });
    };
    dest.push({
      id: stencil.id,
      name: stencil.name,
      styles: stencil.styles,
      settings: stencil.settings,
      forPicker: mkNode,
      forCanvas: mkNode,
      type: 'yaml'
    });
  }
  return dest;
};
