import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { NoOpCRDTMap, NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Diagram, type DiagramCRDT } from '@diagram-craft/model/diagram';

export const createThumbnailDiagramForNode = (
  factory: (diagram: Diagram, layer: RegularLayer) => DiagramNode,
  definitions: Definitions
) => {
  const dest = new Diagram(
    newid(),
    newid(),
    new DiagramDocument(
      definitions.nodeDefinitions,
      definitions.edgeDefinitions,
      true,
      new NoOpCRDTRoot()
    ),
    new NoOpCRDTMap<DiagramCRDT>()
  );

  const uow = UnitOfWork.immediate(dest);

  const layer = new RegularLayer(newid(), newid(), [], dest);
  dest.layers.add(layer, uow);

  const node = factory(dest, layer);
  layer.addElement(node, uow);

  return {
    diagram: dest,
    layer: layer,
    node: node
  };
};
