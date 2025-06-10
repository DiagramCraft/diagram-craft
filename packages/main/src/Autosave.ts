import {
  deserializeDiagramDocument,
  DiagramFactory,
  DocumentFactory
} from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { ProgressCallback } from '@diagram-craft/model/types';

const KEY = 'autosave';

let needsSave: { url: string | undefined; doc: DiagramDocument } | undefined = undefined;

export const Autosave = {
  load: async (
    progressCallback: ProgressCallback,
    documentFactory: DocumentFactory,
    diagramFactory: DiagramFactory<Diagram>,
    failSilently = false
  ) => {
    try {
      const item = localStorage.getItem(KEY);
      if (!item) return undefined;

      const parsed = JSON.parse(item);

      const document = await documentFactory(parsed.url, progressCallback);
      await deserializeDiagramDocument(parsed.diagram, document, diagramFactory);
      await document.load();

      return {
        url: parsed.url,
        document
      };
    } catch (e) {
      if (!failSilently) throw e;

      console.warn('Failed to load autosaved document', e);
      Autosave.clear();
    }
  },

  clear: () => localStorage.removeItem(KEY),

  exists: () => !!localStorage.getItem(KEY),

  save: async (url: string | undefined, doc: DiagramDocument) => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        url,
        diagram: await serializeDiagramDocument(doc)
      })
    );
  },

  // TODO: Handle multiple different URLs and docs
  asyncSave: (url: string | undefined, doc: DiagramDocument) => {
    needsSave = { url, doc };
  }
};

setInterval(() => {
  if (needsSave) {
    Autosave.save(needsSave.url, needsSave.doc);
    needsSave = undefined;
  }
}, 1000);
