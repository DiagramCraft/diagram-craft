import type { CRDTRoot } from '@diagram-craft/model/collaboration/crdt';
import { ProgressCallback } from '@diagram-craft/model/types';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/types';
import { assert } from '@diagram-craft/utils/assert';

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
};

let AUTOSAVE_INSTANCE: Autosave | undefined = undefined;

export const Autosave = {
  init(instance: Autosave) {
    AUTOSAVE_INSTANCE = instance;
  },

  get(): Autosave {
    assert.present(AUTOSAVE_INSTANCE);
    return AUTOSAVE_INSTANCE;
  }
};
