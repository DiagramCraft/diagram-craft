import type { Stencil } from './stencilRegistry';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
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

        const bounds = Box.asReadWrite(Box.boundingBox(elements.map(e => e.bounds)));

        bounds.x -= (stencil as Stencil).settings?.marginLeft ?? 0;
        bounds.w += (stencil as Stencil).settings?.marginLeft ?? 0;

        bounds.y -= (stencil as Stencil).settings?.marginTop ?? 0;
        bounds.h += (stencil as Stencil).settings?.marginTop ?? 0;

        bounds.w += (stencil as Stencil).settings?.marginRight ?? 0;
        bounds.h += (stencil as Stencil).settings?.marginBottom ?? 0;

        return { elements, bounds: WritableBox.asBox(bounds), diagram, layer };
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
