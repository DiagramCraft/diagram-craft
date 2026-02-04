import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';
import { SerializedDiagram } from './serialization/serializedTypes';
import { newid } from '@diagram-craft/utils/id';
import { Registry } from './elementDefinitionRegistry';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import { CRDT, type CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { AwarenessUserState } from '@diagram-craft/collaboration/awareness';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';

export type DocumentFactory = {
  loadCRDT: (
    url: string | undefined,
    userState: AwarenessUserState,
    callback: ProgressCallback
  ) => Promise<CRDTRoot>;
  createDocument: (
    root: CRDTRoot,
    url: string | undefined,
    callback: ProgressCallback
  ) => Promise<DiagramDocument>;
};

export type DiagramFactory<T extends Diagram = Diagram> = (
  d: SerializedDiagram,
  doc: DiagramDocument
) => T;

export const makeDefaultDiagramFactory = () => (d: SerializedDiagram, doc: DiagramDocument) => {
  return new Diagram(d.id, d.name, doc);
};

export const makeDefaultDocumentFactory = (registry: Registry): DocumentFactory => {
  return {
    loadCRDT: async (
      url: string | undefined,
      userState: AwarenessUserState,
      statusCallback: ProgressCallback
    ) => {
      const root = CRDT.makeRoot();
      if (url) {
        if (location.hash !== '') {
          // TODO: This is a hack for the testing setup
          await CollaborationConfig.Backend.connect(
            `${url}__${newid()}`,
            root,
            userState,
            statusCallback
          );
        } else {
          await CollaborationConfig.Backend.connect(url, root, userState, statusCallback);
        }
      }
      return root;
    },
    createDocument: async (
      root: CRDTRoot,
      url: string | undefined,
      _statusCallback: ProgressCallback
    ) => {
      const doc = new DiagramDocument(registry, false, root);
      if (url) doc.url = url;
      return doc;
    }
  };
};
