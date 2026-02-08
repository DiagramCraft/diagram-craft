import type { Stencil } from './stencilRegistry';
import { type Diagram, DocumentBuilder } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from './diagramDocument';
import { NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Box } from '@diagram-craft/geometry/box';

// biome-ignore lint/suspicious/noExplicitAny: false positive
export const loadStencilsFromYaml = (stencils: any) => {
  const dest: Array<Stencil> = [];
  for (const stencil of stencils.stencils) {
    const mkNode = (diagram: Diagram) => {
      const { layer } = DocumentBuilder.empty(
        newid(),
        stencil.name,
        new DiagramDocument(diagram.document.registry, true, new NoOpCRDTRoot())
      );

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
      elementsForPicker: mkNode,
      elementsForCanvas: mkNode,
      type: 'yaml'
    });
  }
  return dest;
};
