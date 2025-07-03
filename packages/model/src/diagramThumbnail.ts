import { Layer } from './diagramLayer';
import { DiagramNode } from './diagramNode';
import { Definitions } from './elementDefinitionRegistry';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from './diagramDocument';
import { NoOpCRDTMap, NoOpCRDTRoot } from './collaboration/noopCrdt';
import { UnitOfWork } from './unitOfWork';
import { RegularLayer } from './diagramLayerRegular';
import { Diagram, type DiagramCRDT } from './diagram';

export const createThumbnailDiagramForNode = (
  factory: (diagram: Diagram, layer: Layer) => DiagramNode,
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
