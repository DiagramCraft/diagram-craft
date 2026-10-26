import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeDiagramCraft } from '../../diagramcraft-initial-config';
import { loadDocument } from '@diagram-craft/main/embed/loadDocument';
import { registerDocumentStencils } from '@diagram-craft/main/embed/registerStencils';
import { UrlDataProvider } from '@diagram-craft/model/data-providers/dataProviderUrl';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { AppConfig } from '@diagram-craft/main/appConfig';
import { useAuth } from '../../auth/AuthContext';
import { stableHue } from '../../components/MemberAvatar';
import type { ContentScope } from '../../queries/content';
import {
  hashDiagramContent,
  rememberMarkdownDiagramOriginal,
  updateMarkdownDiagramSessionRecord
} from '../markdown/markdownDiagramSession';
import { findDiagramFile, loadDiagramContent, saveDiagramContent } from './diagramFileApi';
import {
  ARCH_REGISTER_PUBLIC_PROVIDER_ID,
  diagramRoomName,
  injectPublicDiagramProvider,
  normalizePublicSchemas,
  type PublicDiagramSchema
} from './diagramScreenState';

export type DiagramFileInfo = { path: string; name: string };

/**
 * Loads a diagram file into a collaborative document (joining its room), and saves it back on
 * request. `scope` must be referentially stable.
 */
export const useDiagramDocument = ({
  scope,
  diagramId,
  markdownSessionId
}: {
  scope: ContentScope;
  diagramId: string;
  /** Set when the diagram was opened from a markdown page, to track its edit session */
  markdownSessionId?: string;
}) => {
  const workspaceId = scope.workspaceId;
  const { user } = useAuth();
  const userId = user?.id;
  const userDisplayName = user?.display_name;
  const userColor = user?.color;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<DiagramFileInfo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [doc, setDoc] = useState<DiagramDocument | null>(null);
  const docRef = useRef<DiagramDocument | null>(null);
  const fileInfoRef = useRef<DiagramFileInfo | null>(null);
  const dirtyRef = useRef(false);
  const sawCollaboratorsRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const makePublicProvider = useCallback(
    (publicSchemas: PublicDiagramSchema[]) => {
      const normalizedSchemas = normalizePublicSchemas(publicSchemas);
      const provider = new UrlDataProvider(
        JSON.stringify({
          schemas: normalizedSchemas,
          data: [],
          schemaUrl: `/api/adapters/diagram-craft/${workspaceId}/schemas`,
          dataUrl: `/api/adapters/diagram-craft/${workspaceId}/data`
        })
      );
      provider.id = ARCH_REGISTER_PUBLIC_PROVIDER_ID;
      return provider;
    },
    [workspaceId]
  );

  const injectPublicProvider = useCallback(
    (diagramData: SerializedDiagramDocument, publicSchemas: PublicDiagramSchema[]) =>
      injectPublicDiagramProvider(diagramData, publicSchemas, workspaceId),
    [workspaceId]
  );

  // Save on close as a safety net (server auto-save handles ongoing persistence)
  const save = useCallback(async () => {
    if (!docRef.current || !fileInfoRef.current) return;

    try {
      const serialized = await serializeDiagramDocument(docRef.current);
      await saveDiagramContent(
        scope,
        fileInfoRef.current.path,
        serialized as unknown as Record<string, unknown>
      );

      if (markdownSessionId && dirtyRef.current) {
        updateMarkdownDiagramSessionRecord(markdownSessionId, diagramId, {
          path: fileInfoRef.current.path,
          name: fileInfoRef.current.name,
          lastSavedContentHash: hashDiagramContent(JSON.stringify(serialized)),
          sawCollaborators: sawCollaboratorsRef.current
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [scope, markdownSessionId, diagramId]);

  useEffect(() => {
    let disconnect = () => {};
    let releaseAwarenessChange = () => {};
    let cancelled = false;

    const loadDiagram = async () => {
      try {
        setLoading(true);
        sawCollaboratorsRef.current = false;

        const { documentFactory, diagramFactory, includedPackages, stencilConfig } =
          initializeDiagramCraft(workspaceId);

        const file = await findDiagramFile(scope, diagramId);
        if (!file) throw new Error('Diagram file not found');
        setFileInfo({ path: file.path, name: file.name });
        fileInfoRef.current = { path: file.path, name: file.name };

        const serializedDiagramData = (await loadDiagramContent(
          scope,
          file.path
        )) as unknown as SerializedDiagramDocument;

        if (markdownSessionId) {
          rememberMarkdownDiagramOriginal(markdownSessionId, {
            diagramId,
            path: file.path,
            name: file.name,
            originalContent: JSON.stringify(serializedDiagramData)
          });
        }

        // Connect to collaboration backend and sync CRDT state
        const config = AppConfig.get();
        const awarenessState =
          userId && userDisplayName
            ? {
                name: userDisplayName,
                color: userColor ?? `oklch(0.52 0.13 ${stableHue(userId)})`,
                avatar: config.awareness.avatar()
              }
            : {
                name: config.awareness.name(),
                color: config.awareness.color(),
                avatar: config.awareness.avatar()
              };

        const publicSchemasResponse = await fetch(
          `/api/adapters/diagram-craft/${workspaceId}/schemas`
        );
        if (!publicSchemasResponse.ok) throw new Error('Failed to load public schemas');
        const publicSchemas = (await publicSchemasResponse.json()) as PublicDiagramSchema[];

        const {
          doc: document,
          disconnect: docDisconnect,
          awareness
        } = await loadDocument({
          url: diagramRoomName(scope, file.id),
          awareness: awarenessState,
          documentFactory,
          diagramFactory,
          // The room name is a CRDT identifier, not a fetchable file URL — always create the
          // document straight from the CRDT root rather than falling back to the
          // autosave/file-URL loading path (which is standalone-only).
          forceLoadFromServer: true,
          // Only the first client to connect sees an empty CRDT — subsequent
          // clients sync existing collaborative state instead of re-seeding it.
          seedContent: async doc => {
            const diagramData = injectPublicProvider(serializedDiagramData, publicSchemas);
            await deserializeDiagramDocument(diagramData, doc, diagramFactory, {
              includedPackages
            });
          },
          dataProviders: {
            providers: () => [makePublicProvider(publicSchemas)],
            includeDefaultProvider: false
          }
        });

        // The effect was cleaned up (unmount/navigation/dep change) while loadDocument
        // was still pending — the cleanup below already ran with the no-op `disconnect`,
        // so it never closed the connection loadDocument just opened. Close it now
        // instead of wiring it up for a component that's already gone.
        if (cancelled) {
          docDisconnect();
          document.release();
          return;
        }
        disconnect = docDisconnect;

        registerDocumentStencils(document, stencilConfig);

        const handleAwarenessChange = () => {
          if ((awareness?.getUserStates().length ?? 0) > 1) {
            sawCollaboratorsRef.current = true;
          }
        };
        releaseAwarenessChange = awareness?.on('changeUser', handleAwarenessChange) ?? (() => {});
        handleAwarenessChange();

        if (document.diagrams.length === 0) {
          throw new Error('Diagram file contains no diagrams');
        }

        docRef.current = document;
        setDoc(document);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load diagram:', err);
        setError(err instanceof Error ? err.message : 'Failed to load diagram');
        setLoading(false);
      }
    };

    loadDiagram();

    return () => {
      cancelled = true;
      disconnect();
      releaseAwarenessChange();
      if (docRef.current) {
        docRef.current.deactivate(() => {});
        docRef.current.release();
        docRef.current = null;
      }
    };
  }, [
    scope,
    workspaceId,
    diagramId,
    injectPublicProvider,
    makePublicProvider,
    userId,
    userDisplayName,
    userColor,
    markdownSessionId
  ]);

  return { loading, error, fileInfo, doc, dirty, setDirty, save };
};
