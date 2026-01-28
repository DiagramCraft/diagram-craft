import { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';
import { newid } from '@diagram-craft/utils/id';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { NoOpCRDTMap, NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { Diagram, type DiagramCRDT } from '@diagram-craft/model/diagram';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';

const createDiagram = (defs: Definitions) => {
  const id = newid();
  return new Diagram(
    id,
    id,
    new DiagramDocument(defs.nodeDefinitions, defs.edgeDefinitions, true, new NoOpCRDTRoot()),
    new NoOpCRDTMap<DiagramCRDT>()
  );
};

export const createThumbnail = (
  factory: (diagram: Diagram, layer: RegularLayer, uow: UnitOfWork) => DiagramElement[],
  definitions: Definitions
) => {
  const diagram = createDiagram(definitions);

  return UnitOfWork.execute(diagram, uow => {
    const layer = new RegularLayer(newid(), newid(), [], diagram);
    diagram.layers.add(layer, uow);

    const els = factory(diagram, layer, uow);
    for (const el of els) {
      layer.addElement(el, uow);
      if (isNode(el)) el.invalidateAnchors(uow);
    }

    return { diagram, layer, elements: els };
  });
};
