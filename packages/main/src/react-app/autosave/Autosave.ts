import type { CRDTRoot } from '@diagram-craft/model/collaboration/crdt';
import { ProgressCallback } from '@diagram-craft/model/types';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/types';
import { MultiWindowAutosave } from './MultiWindowAutosave';

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

  exists: () => boolean;

  clear: () => void;
};

export const Autosave = {
  get(): Autosave {
    return MultiWindowAutosave;
  }
};
