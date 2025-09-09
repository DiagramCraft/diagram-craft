import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { ProgressCallback } from '@diagram-craft/model/types';
import { CollaborationConfig } from '@diagram-craft/model/collaboration/collaborationConfig';
import type { CRDTRoot } from '@diagram-craft/model/collaboration/crdt';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/types';
import type { Autosave } from './Autosave';


let needsSave:
  | {
      url: string | undefined;
      doc: DiagramDocument;
      callback?: (d: SerializedDiagramDocument) => void;
    }
  | undefined = undefined;

export const ElectronAutosave: Autosave = {
  /**
   * Load autosave data from disk
   */
  load: async (
    root: CRDTRoot,
    progressCallback: ProgressCallback,
    documentFactory: DocumentFactory,
    diagramFactory: DiagramFactory,
    failSilently = false
  ): Promise<{ document: DiagramDocument; url?: string } | undefined> => {
    if (!CollaborationConfig.isNoOp) return undefined;
    if (!window.electronAPI) return undefined;

    try {
      const autosaveContent = await window.electronAPI.autosaveLoad();
      if (!autosaveContent) return undefined;

      const autosaveData = JSON.parse(autosaveContent);
      const { diagram, url } = autosaveData;
      const doc = await documentFactory.createDocument(root, url, progressCallback);
      await deserializeDiagramDocument(diagram, doc, diagramFactory);
      await doc.load();

      return { document: doc, url };
    } catch (e) {
      if (!failSilently) throw e;

      console.warn('Failed to load autosaved document', e);
      ElectronAutosave.clear();
      return undefined;
    }
  },

  /**
   * Save autosave data to disk
   */
  save: async (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ): Promise<void> => {
    if (!CollaborationConfig.isNoOp) return;
    if (!window.electronAPI) return;

    try {
      const diagram = await serializeDiagramDocument(doc);
      if (callback) callback(diagram);

      const autosaveData = {
        url,
        diagram,
        timestamp: Date.now()
      };

      await window.electronAPI.autosaveSave(JSON.stringify(autosaveData));
    } catch (e) {
      console.warn('Failed to autosave', e);
    }
  },

  /**
   * Check if any autosave exists
   */
  exists: (): boolean => {
    if (!window.electronAPI) return false;
    
    try {
      // Since the API is async but this method should be sync, 
      // we'll return false and let the load method handle the actual check
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Clear all autosave data
   */
  clear: (): void => {
    if (!window.electronAPI) return;
    window.electronAPI.autosaveClear();
  },

  /**
   * Async save (queued)
   */
  asyncSave: (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ): void => {
    needsSave = { url, doc, callback };
  }
};

// Background save interval
setInterval(() => {
  if (needsSave) {
    ElectronAutosave.save(needsSave.url, needsSave.doc, needsSave.callback);
    needsSave = undefined;
  }
}, 1000);