import {
  deserializeDiagramDocument,
  DiagramFactory,
  DocumentFactory
} from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';

export const Autosave = {
  load: async (documentFactory: DocumentFactory, diagramFactory: DiagramFactory<Diagram>) =>
    localStorage.getItem('autosave')
      ? await deserializeDiagramDocument(
          JSON.parse(localStorage.getItem('autosave')!),
          documentFactory,
          diagramFactory
        )
      : undefined,

  clear: () => localStorage.removeItem('autosave'),

  save: async (doc: DiagramDocument) => {
    localStorage.setItem('autosave', JSON.stringify(await serializeDiagramDocument(doc)));
  }
};
