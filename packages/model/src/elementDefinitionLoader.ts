import type { Stencil } from './elementDefinitionRegistry';
import { type Diagram, DocumentBuilder } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from './diagramDocument';
import { NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';
import { ElementLookup } from '@diagram-craft/model/elementLookup';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';

// biome-ignore lint/suspicious/noExplicitAny: false positive
export const loadStencilsFromYaml = (stencils: any) => {
  const dest: Array<Stencil> = [];
  for (const stencil of stencils.stencils) {
    const mkNode = (diagram: Diagram) => {
      const { layer } = DocumentBuilder.empty(
        newid(),
        stencil.name,
        new DiagramDocument(
          diagram.document.nodeDefinitions,
          diagram.document.edgeDefinitions,
          true,
          new NoOpCRDTRoot()
        )
      );

      return UnitOfWork.execute(diagram, uow => {
        const node = deserializeDiagramElements(
          [stencil.node],
          layer,
          uow,
          new ElementLookup<DiagramNode>(),
          new ElementLookup<DiagramEdge>()
        )[0] as DiagramNode;
        layer.addElement(node, uow);

        return node;
      });
    };
    dest.push({
      id: stencil.id,
      name: stencil.name,
      node: mkNode,
      canvasNode: mkNode
    });
  }
  return dest;
};
