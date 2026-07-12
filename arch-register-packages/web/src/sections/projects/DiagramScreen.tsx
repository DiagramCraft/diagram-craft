import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearch, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import styles from './DiagramScreen.module.css';
import '@diagram-craft/main/embed/embed.css';
import { TbArrowLeft } from 'react-icons/tb';
import { initializeDiagramCraft } from '../../diagramcraft-initial-config';
import { EmbeddableEditor } from '@diagram-craft/main/EmbeddableEditor';
import { loadDocument } from '@diagram-craft/main/embed/loadDocument';
import { registerDocumentStencils } from '@diagram-craft/main/embed/registerStencils';
import {
  UrlDataProvider,
  UrlDataProviderId
} from '@diagram-craft/model/data-providers/dataProviderUrl';
import type { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import type {
  SerializedDiagramDocument,
  SerializedOverride
} from '@diagram-craft/model/serialization/serializedTypes';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { AppConfig } from '@diagram-craft/main/appConfig';
import { useAuth } from '../../auth/AuthContext';
import { orpcClient } from '../../lib/orpcClient';
import {
  entityContentKeys,
  projectEntityKeys,
  projectFileKeys,
  projectKeys,
  workspaceContentKeys
} from '../../hooks/queryKeys';
import { searchKeys } from '../../hooks/useSearch';
import { stableHue } from '../../components/MemberAvatar';
import { LoadingState } from '../../components/LoadingState';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';
import {
  hashDiagramContent,
  rememberMarkdownDiagramOriginal,
  updateMarkdownDiagramSessionRecord
} from '../markdown/markdownDiagramSession';

const ARCH_REGISTER_PUBLIC_PROVIDER_ID = 'arch-register-public';
type PublicSchema = Omit<DataSchema, 'providerId'> & { providerId?: string };
type SerializedOverrides = Record<string, Record<string, SerializedOverride>>;

export const DiagramScreen = () => {
  const params = useParams({ strict: false });
  // workspaceSlug/diagramId are always present: this screen only mounts under
  // the entity/project/content diagram routes, all of which define both params.
  const workspaceSlug = params.workspaceSlug!;
  const diagramId = params.diagramId!;
  const workspaceId = workspaceSlug;
  const isEntityDiagram = !!params.entityId;
  const isWorkspaceContent = !params.projectId && !params.entityId;
  const projectId = params.projectId ?? params.entityId ?? workspaceId;

  const navigate = useNavigate();
  const router = useRouter();
  const search = useSearch({ strict: false });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const userDisplayName = user?.display_name;
  const userColor = user?.color;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ path: string; name: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [doc, setDoc] = useState<DiagramDocument | null>(null);
  const docRef = useRef<DiagramDocument | null>(null);
  const fileInfoRef = useRef<{ path: string; name: string } | null>(null);
  const dirtyRef = useRef(false);
  const sawCollaboratorsRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const normalizePublicSchemas = useCallback(
    (publicSchemas: PublicSchema[]) =>
      publicSchemas.map(schema => ({
        ...schema,
        providerId: ARCH_REGISTER_PUBLIC_PROVIDER_ID
      })),
    []
  );

  const makePublicProvider = useCallback(
    (publicSchemas: PublicSchema[]) => {
      const normalizedSchemas = normalizePublicSchemas(publicSchemas);
      const provider = new UrlDataProvider(
        JSON.stringify({
          schemas: normalizedSchemas,
          data: [],
          schemaUrl: `/api/public/${workspaceId}/schemas`,
          dataUrl: `/api/public/${workspaceId}/data`
        })
      );
      provider.id = ARCH_REGISTER_PUBLIC_PROVIDER_ID;
      return provider;
    },
    [normalizePublicSchemas, workspaceId]
  );

  const injectPublicProvider = useCallback(
    (
      diagramData: SerializedDiagramDocument,
      publicSchemas: PublicSchema[]
    ): SerializedDiagramDocument => {
      const currentData =
        typeof diagramData.data === 'object' && diagramData.data !== null
          ? (diagramData.data as Record<string, unknown>)
          : {};
      const normalizedSchemas = normalizePublicSchemas(publicSchemas);

      return {
        ...diagramData,
        schemas: normalizedSchemas,
        data: {
          ...currentData,
          providers: [
            {
              id: ARCH_REGISTER_PUBLIC_PROVIDER_ID,
              providerId: UrlDataProviderId,
              data: JSON.stringify({
                schemas: normalizedSchemas,
                data: [],
                schemaUrl: `/api/public/${workspaceId}/schemas`,
                dataUrl: `/api/public/${workspaceId}/data`
              })
            }
          ],
          templates: Array.isArray(currentData.templates) ? currentData.templates : [],
          overrides:
            typeof currentData.overrides === 'object' && currentData.overrides !== null
              ? (currentData.overrides as SerializedOverrides)
              : {}
        }
      };
    },
    [normalizePublicSchemas, workspaceId]
  );

  // Save on close as a safety net (server auto-save handles ongoing persistence)
  const save = useCallback(async () => {
    if (!docRef.current || !fileInfoRef.current) return;

    try {
      const serialized = await serializeDiagramDocument(docRef.current);
      if (isWorkspaceContent) {
        await orpcClient.projects.saveWorkspaceFile({
          params: { workspace: workspaceId },
          query: { path: fileInfoRef.current.path },
          body: serialized as unknown as Record<string, unknown>
        });
      } else {
        await orpcClient.projects.saveFile({
          params: { workspace: workspaceId, id: projectId },
          query: { path: fileInfoRef.current.path },
          body: serialized as unknown as Record<string, unknown>
        });
      }

      if (search.markdownSessionId && dirtyRef.current) {
        updateMarkdownDiagramSessionRecord(search.markdownSessionId, diagramId, {
          path: fileInfoRef.current.path,
          name: fileInfoRef.current.name,
          lastSavedContentHash: hashDiagramContent(JSON.stringify(serialized)),
          sawCollaborators: sawCollaboratorsRef.current
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [workspaceId, projectId, isWorkspaceContent, search.markdownSessionId, diagramId]);

  const refreshDiagramCaches = useCallback(async () => {
    if (isWorkspaceContent) {
      await queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) });
    } else if (isEntityDiagram) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: entityContentKeys.all(workspaceId, projectId) }),
        queryClient.invalidateQueries({
          queryKey: projectEntityKeys.entityDiagramFiles(workspaceId, projectId)
        })
      ]);
    } else {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: projectFileKeys.list(workspaceId, projectId)
        }),
        queryClient.refetchQueries({
          queryKey: projectKeys.detail(workspaceId, projectId)
        })
      ]);
    }

    await queryClient.invalidateQueries({ queryKey: searchKeys.all });
    await queryClient.invalidateQueries({ queryKey: projectFileKeys.detail(workspaceId, diagramId) });
    await queryClient.invalidateQueries({ queryKey: projectFileKeys.content(workspaceId, diagramId) });
  }, [isWorkspaceContent, isEntityDiagram, queryClient, workspaceId, projectId, diagramId]);

  const handleClose = useCallback(async () => {
    await save();
    await refreshDiagramCaches();

    if (search.returnTo) {
      router.history.push(search.returnTo);
      return;
    }

    if (isWorkspaceContent) {
      const folderPath = fileInfoRef.current?.path.includes('/')
        ? fileInfoRef.current.path.substring(0, fileInfoRef.current.path.lastIndexOf('/'))
        : undefined;
      navigate({
        to: '/$workspaceSlug/content',
        params: { workspaceSlug },
        search: folderPath ? { contentFolder: folderPath } : {}
      });
    } else if (isEntityDiagram) {
      // Navigate back to entity detail page with folder context
      const folderPath = fileInfoRef.current?.path.includes('/')
        ? fileInfoRef.current.path.substring(0, fileInfoRef.current.path.lastIndexOf('/'))
        : undefined;

      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(projectId), folderPath ? { contentFolder: folderPath } : {}));
    } else {
      // Navigate back to project detail page
      navigate(
        projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
          tab: 'projects' as const,
          section: 'home' as const,
          folder:
            fileInfoRef.current?.path.includes('/')
              ? fileInfoRef.current.path.substring(0, fileInfoRef.current.path.lastIndexOf('/'))
              : undefined
        })
      );
    }
  }, [
    save,
    refreshDiagramCaches,
    navigate,
    router,
    search.returnTo,
    workspaceSlug,
    projectId,
    isEntityDiagram,
    isWorkspaceContent
  ]);

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

        // biome-ignore lint/suspicious/noExplicitAny: API response
        const findFileInFolders = (folders: any[], rootFiles?: any[]) => {
          if (rootFiles) {
            // biome-ignore lint/suspicious/noExplicitAny: API response
            const rf = rootFiles.find((f: any) => f.id === diagramId);
            if (rf) return rf;
          }
          for (const folder of folders) {
            // biome-ignore lint/suspicious/noExplicitAny: API response
            const f = folder.files.find((f: any) => f.id === diagramId);
            if (f) return f;
          }
          return null;
        };

        // Fetch file info based on diagram type
        let file: { id: string; path: string; name: string } | null = null;

        if (isWorkspaceContent) {
          const wsNodes = await orpcClient.projects.listWorkspaceFiles({
            params: { workspace: workspaceId }
          });
          file = findFileInFolders(wsNodes.folders, wsNodes.rootFiles);
        } else if (isEntityDiagram) {
          // Fetch entity content
          const entityNodes = await orpcClient.projects.listEntityFiles({
            params: { workspace: workspaceId, entityId: projectId }
          });
          file = findFileInFolders(entityNodes.folders);
        } else {
          // Fetch project
          const project = await orpcClient.projects.get({
            params: {
              workspace: workspaceId,
              id: projectId
            }
          });
          file = findFileInFolders(project.files.folders, project.files.rootFiles);
        }

        // Attachment diagrams are hidden from the file tree — look them up directly by ID
        if (!file) {
          const directFile = await orpcClient.projects.getFile({
            params: { workspace: workspaceId, fileId: diagramId }
          });
          if (directFile) file = directFile;
        }

        if (!file) throw new Error('Diagram file not found');
        setFileInfo({ path: file.path, name: file.name });
        fileInfoRef.current = { path: file.path, name: file.name };

        const rawDiagramData = isWorkspaceContent
          ? await orpcClient.projects.getWorkspaceFileContent({
              params: { workspace: workspaceId },
              query: { path: file.path }
            })
          : await orpcClient.projects.getFileContent({
              params: { workspace: workspaceId, id: projectId },
              query: { path: file.path }
            });
        const serializedDiagramData = rawDiagramData as unknown as SerializedDiagramDocument;

        if (search.markdownSessionId) {
          rememberMarkdownDiagramOriginal(search.markdownSessionId, {
            diagramId,
            path: file.path,
            name: file.name,
            originalContent: JSON.stringify(serializedDiagramData)
          });
        }

        // Construct the collaboration room name
        const roomName = isWorkspaceContent
          ? `${workspaceId}/workspace-content/${file.id}.json`
          : `${workspaceId}/${projectId}/${file.id}.json`;

        // Connect to collaboration backend and sync CRDT state
        const config = AppConfig.get();
        const userState =
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

        const publicSchemasResponse = await fetch(`/api/public/${workspaceId}/schemas`);
        if (!publicSchemasResponse.ok) throw new Error('Failed to load public schemas');
        const publicSchemas = (await publicSchemasResponse.json()) as PublicSchema[];

        const { doc: document, disconnect: docDisconnect, awareness } = await loadDocument({
          url: roomName,
          userState,
          documentFactory,
          diagramFactory,
          // roomName is a CRDT identifier, not a fetchable file URL — always create the
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
    workspaceId,
    projectId,
    diagramId,
    injectPublicProvider,
    makePublicProvider,
    userId,
    userDisplayName,
    userColor,
    isEntityDiagram,
    isWorkspaceContent,
    search.markdownSessionId
  ]);

  const { documentFactory, diagramFactory } = initializeDiagramCraft(workspaceId);

  if (loading) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.loading}>
          <LoadingState text="Loading diagram..." />
        </div>
      </div>
    );
  }

  if (error || !fileInfo || !doc) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.error}>
          <p>Error: {error ?? 'Failed to load diagram'}</p>
          <button type="button" onClick={handleClose} className={styles.button}>
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dc ${styles.diagramScreen}`}>
      <EmbeddableEditor
        doc={doc}
        documentFactory={documentFactory}
        diagramFactory={diagramFactory}
        documentName={fileInfo.name}
        dirty={dirty}
        onDirtyChange={setDirty}
        headerLeft={
          <button
            type={'button'}
            className={'embeddable-back-button'}
            onClick={handleClose}
            title={'Back'}
          >
            <TbArrowLeft size={'13px'} />
            <span>Back</span>
          </button>
        }
      />
    </div>
  );
};
