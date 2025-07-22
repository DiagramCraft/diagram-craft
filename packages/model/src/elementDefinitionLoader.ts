import type { Stencil } from './elementDefinitionRegistry';
import { type Diagram, DocumentBuilder } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from './diagramDocument';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';
import { deserializeDiagramElements } from './serialization/deserialize';
import type { DiagramNode } from './diagramNode';
import { UnitOfWork } from './unitOfWork';

// eslint-disable-next-line
export const loadStencilsFromYaml = (stencils: any) => {
  const dest: Array<Stencil> = [];
  for (const stencil of stencils.stencils) {
    const mkNode = (diagram: Diagram) => {
      const { diagram: dest, layer } = DocumentBuilder.empty(
        newid(),
        stencil.name,
        new DiagramDocument(
          diagram.document.nodeDefinitions,
          diagram.document.edgeDefinitions,
          true,
          new NoOpCRDTRoot()
        )
      );

      const node = deserializeDiagramElements([stencil.node], dest, layer)[0] as DiagramNode;
      layer.addElement(node, UnitOfWork.immediate(diagram));

      return node;
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
