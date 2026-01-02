import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { NoOpCRDTMap, NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Diagram, type DiagramCRDT } from '@diagram-craft/model/diagram';
import type { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { UOW } from '@diagram-craft/model/uow';

const createDiagram = (defs: Definitions) => {
  const id = newid();
  return new Diagram(
    id,
    id,
    new DiagramDocument(defs.nodeDefinitions, defs.edgeDefinitions, true, new NoOpCRDTRoot()),
    new NoOpCRDTMap<DiagramCRDT>()
  );
};

export const createThumbnailForNode = (
  factory: (diagram: Diagram, layer: RegularLayer) => DiagramNode,
  definitions: Definitions
) => {
  const diagram = createDiagram(definitions);
  return UOW.execute(diagram, () => {
    const layer = new RegularLayer(newid(), newid(), [], diagram);
    diagram.layers.add(layer, UOW.uow());

    const node = factory(diagram, layer);
    layer.addElement(node, UOW.uow());

    return { diagram, layer, node };
  });
};

export const createThumbnailForEdge = (
  factory: (diagram: Diagram, layer: RegularLayer) => DiagramEdge,
  definitions: Definitions
) => {
  const diagram = createDiagram(definitions);
  return UOW.execute(diagram, () => {
    const layer = new RegularLayer(newid(), newid(), [], diagram);
    diagram.layers.add(layer, UOW.uow());

    const edge = factory(diagram, layer);
    layer.addElement(edge, UOW.uow());

    return { diagram, layer, edge };
  });
};
