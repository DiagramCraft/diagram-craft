import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { assert } from '@diagram-craft/utils/assert';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import type { CRDTRoot } from '@diagram-craft/collaboration/crdt';

export type Autosave = {
  load: (
    root: CRDTRoot,
    progressCallback: ProgressCallback,
    documentFactory: DocumentFactory,
    diagramFactory: DiagramFactory,
    failSilently?: boolean
  ) => Promise<{ document: DiagramDocument; url?: string } | undefined>;

  save: (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ) => Promise<void>;

  asyncSave: (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ) => void;

  exists: () => Promise<boolean>;

  clear: () => void;

  init: () => void;
};

let AUTOSAVE_INSTANCE: Autosave | undefined;

export const Autosave = {
  init(instance: Autosave) {
    AUTOSAVE_INSTANCE = instance;
    AUTOSAVE_INSTANCE.init();
  },

  get(): Autosave {
    assert.present(AUTOSAVE_INSTANCE);
    return AUTOSAVE_INSTANCE;
  }
};
