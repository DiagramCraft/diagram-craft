import { ProgressCallback } from './types';
import { CRDT, type CRDTRoot } from './collaboration/crdt';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';
import { SerializedDiagram } from './serialization/types';
import { CollaborationConfig } from './collaboration/collaborationConfig';
import { newid } from '@diagram-craft/utils/id';
import { EdgeDefinitionRegistry, type NodeDefinitionRegistry } from './elementDefinitionRegistry';
import type { AwarenessUserState } from './collaboration/awareness';

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

export const makeDefaultDocumentFactory = (
  nodeRegistry: NodeDefinitionRegistry,
  edgeRegistry: EdgeDefinitionRegistry
): DocumentFactory => {
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
      const doc = new DiagramDocument(nodeRegistry, edgeRegistry, false, root);
      if (url) doc.url = url;
      return doc;
    }
  };
};
