import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import type { DataProviderPolicy } from '@diagram-craft/model/diagramDocumentData';
import { Autosave } from '../react-app/autosave/Autosave';
import { AppConfig } from '../appConfig';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import type { AwarenessUserState, Awareness } from '@diagram-craft/collaboration/awareness';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import type { Extent } from '@diagram-craft/geometry/extent';

export type LoadDocumentOpts = {
  /** File url, or CRDT room name. */
  url?: string;
  userState: AwarenessUserState;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory;
  progress?: ProgressCallback;
  forceLoadFromServer?: boolean;
  forceClearServerState?: boolean;
  /** e.g. arch-register: deserialize orpc content into an empty CRDT document. */
  seedContent?: (doc: DiagramDocument) => Promise<void>;
  /** When `url` is not set, whether/how to create an empty default diagram. */
  createDefaultDiagram?: false | { size?: Extent };
  dataProviders?: DataProviderPolicy;
};

export type LoadedDocument = {
  doc: DiagramDocument;
  url?: string;
  disconnect: () => void;
  awareness: Awareness | undefined;
};

const noopProgress: ProgressCallback = () => {};

/**
 * Extraction of AppLoader's loadInitialDocument, generalized with a `seedContent` hook
 * (for hosts that deserialize their own content into a freshly-created CRDT document)
 * and a `dataProviders` policy (applied before seedContent runs, so seeded content never
 * observes the wrong provider set).
 */
export const loadDocument = async (opts: LoadDocumentOpts): Promise<LoadedDocument> => {
  const { documentFactory, diagramFactory, userState } = opts;
  const progress = opts.progress ?? noopProgress;

  const root = await documentFactory.loadCRDT(opts.url, userState, progress);

  if (opts.forceClearServerState || AppConfig.get().collaboration.forceClearServerState()) {
    root.clear();
  }

  const disconnect = () => {
    CollaborationConfig.Backend.disconnect(noopProgress);
  };
  const awareness = CollaborationConfig.Backend.awareness;

  if (opts.url) {
    if (
      opts.forceLoadFromServer ||
      root.hasData() ||
      AppConfig.get().collaboration.forceLoadFromServer()
    ) {
      const doc = await documentFactory.createDocument(root, opts.url, progress, {
        dataProviders: opts.dataProviders
      });
      // Only seed content into an empty document — if collaborative state already
      // synced in diagrams, seeding again would clobber a collaborator's work.
      if (opts.seedContent && doc.diagrams.length === 0) await opts.seedContent(doc);
      return { doc, url: opts.url, disconnect, awareness };
    }

    const multiWindowAutosaved = await Autosave.get().load(
      root,
      progress,
      documentFactory,
      diagramFactory,
      true
    );

    if (multiWindowAutosaved) {
      const restoredUrl = multiWindowAutosaved.url ?? opts.url;
      multiWindowAutosaved.document.url = restoredUrl;
      return { doc: multiWindowAutosaved.document, url: restoredUrl, disconnect, awareness };
    }

    const defDiagram = await loadFileFromUrl(
      opts.url,
      userState,
      progress,
      documentFactory,
      diagramFactory,
      { root }
    );
    defDiagram.url = opts.url;
    return { doc: defDiagram, url: opts.url, disconnect, awareness };
  }

  const doc = await documentFactory.createDocument(root, undefined, progress, {
    dataProviders: opts.dataProviders
  });

  if (opts.seedContent) await opts.seedContent(doc);

  if (opts.createDefaultDiagram !== false) {
    const size = opts.createDefaultDiagram?.size ?? defaultDiagramSize();

    const margin = 30;
    const rulerWidth = 20;
    const offset = {
      x: -(margin + rulerWidth / 2) - 10,
      y: -(margin + rulerWidth / 2)
    };

    const diagram = new Diagram(newid(), 'Untitled', doc, undefined, size, offset);
    UnitOfWork.execute(diagram, uow =>
      diagram.layers.add(new RegularLayer(newid(), 'Default', [], diagram), uow)
    );
    doc.addDiagram(diagram);
  }

  progress('complete', {});

  return { doc, url: undefined, disconnect, awareness };
};

const defaultDiagramSize = (): Extent => {
  const margin = 30;
  const rightIndent = 50;
  const leftIndent = 50;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  return {
    w: windowWidth - (leftIndent + rightIndent) - margin * 2,
    h: windowHeight - margin * 2 - 110
  };
};
