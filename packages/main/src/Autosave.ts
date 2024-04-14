import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { SerializedDiagram } from '@diagram-craft/model/serialization/types';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';

export const Autosave = {
  load: (factory: (d: SerializedDiagram) => Diagram) =>
    localStorage.getItem('autosave')
      ? deserializeDiagramDocument(JSON.parse(localStorage.getItem('autosave')!), factory)
      : undefined,

  clear: () => localStorage.removeItem('autosave'),

  save: (doc: DiagramDocument) => {
    localStorage.setItem('autosave', JSON.stringify(serializeDiagramDocument(doc)));
  }
};
