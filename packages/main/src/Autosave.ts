import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { ProgressCallback } from '@diagram-craft/model/types';
import { CollaborationConfig } from '@diagram-craft/model/collaboration/collaborationConfig';
import type { CRDTRoot } from '@diagram-craft/model/collaboration/crdt';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/types';

const KEY = 'autosave';

let needsSave:
  | {
      url: string | undefined;
      doc: DiagramDocument;
      callback?: (d: SerializedDiagramDocument) => void;
    }
  | undefined = undefined;

export const Autosave = {
  load: async (
    root: CRDTRoot,
    progressCallback: ProgressCallback,
    documentFactory: DocumentFactory,
    diagramFactory: DiagramFactory,
    failSilently = false
  ) => {
    if (!CollaborationConfig.idNoOp) return undefined;

    try {
      const item = localStorage.getItem(KEY);
      if (!item) return undefined;

      const parsed = JSON.parse(item);

      const document = await documentFactory.createDocument(root, parsed.url, progressCallback);
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

  save: async (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ) => {
    if (!CollaborationConfig.idNoOp) return undefined;

    const diagram = await serializeDiagramDocument(doc);
    if (callback) callback(diagram);
    localStorage.setItem(
      KEY,
      JSON.stringify({
        url,
        diagram: diagram
      })
    );
  },

  // TODO: Handle multiple different URLs and docs
  asyncSave: (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ) => {
    needsSave = { url, doc, callback };
  }
};

setInterval(() => {
  if (needsSave) {
    Autosave.save(needsSave.url, needsSave.doc, needsSave.callback);
    needsSave = undefined;
  }
}, 1000);
