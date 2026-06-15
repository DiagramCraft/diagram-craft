import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import styles from './DiagramScreen.module.css';
import { TbArrowLeft } from 'react-icons/tb';
import { initializeDiagramCraft, getIncludedPackages } from '../../diagramcraft-initial-config';
import { EmbeddableEditor } from '@diagram-craft/main/EmbeddableEditor';
import { DefaultDataProvider } from '@diagram-craft/model/data-providers/dataProviderDefault';
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
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { AppConfig } from '@diagram-craft/main/appConfig';
import { useAuth } from '../../auth/AuthContext';
import { orpcClient } from '../../lib/orpcClient';
import { projectFileKeys } from '../../hooks/useProjectFiles';
import { projectKeys } from '../../hooks/useProjects';
import { stableHue } from '../../components/MemberAvatar';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';

const ARCH_REGISTER_PUBLIC_PROVIDER_ID = 'arch-register-public';
type PublicSchema = Omit<DataSchema, 'providerId'> & { providerId?: string };
type SerializedOverrides = Record<string, Record<string, SerializedOverride>>;

export const DiagramScreen = () => {
  const params = useParams({ strict: false }) as {
    workspaceSlug: string;
    projectId?: string;
    entityId?: string;
    diagramId: string;
  };
  const { workspaceSlug, diagramId } = params;
  const workspaceId = workspaceSlug;
  const isEntityDiagram = !!params.entityId;
  const isWorkspaceContent = !params.projectId && !params.entityId;
  const projectId = params.projectId ?? params.entityId ?? workspaceId;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const userDisplayName = user?.display_name;
  const userColor = user?.color;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ path: string; name: string } | null>(null);
  const [doc, setDoc] = useState<DiagramDocument | null>(null);
  const docRef = useRef<DiagramDocument | null>(null);
  const fileInfoRef = useRef<{ path: string; name: string } | null>(null);

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
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [workspaceId, projectId, isWorkspaceContent]);

  const handleClose = useCallback(async () => {
    await save();

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
      await queryClient.refetchQueries({
        queryKey: projectFileKeys.list(workspaceId, projectId)
      });
      await queryClient.refetchQueries({
        queryKey: projectKeys.detail(workspaceId, projectId)
      });
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
  }, [save, queryClient, navigate, workspaceId, workspaceSlug, projectId, isEntityDiagram, isWorkspaceContent]);

  useEffect(() => {
    let releaseDataChange = () => {};

    const loadDiagram = async () => {
      try {
        setLoading(true);

        const suppressDefaultProvider = async (document: DiagramDocument) => {
          const defaultProvider = document.data.providers.find(
            provider => provider instanceof DefaultDataProvider
          );

          if (!defaultProvider) return;

          for (const schema of [...defaultProvider.schemas]) {
            await defaultProvider.deleteSchema(schema);
          }
        };

        let reconcileInFlight = false;

        const reconcilePublicProvider = async (
          document: DiagramDocument,
          publicSchemas: PublicSchema[]
        ) => {
          if (reconcileInFlight) return;
          reconcileInFlight = true;

          try {
            document.data.setProviders([makePublicProvider(publicSchemas)]);
            await suppressDefaultProvider(document);
          } finally {
            reconcileInFlight = false;
          }
        };

        const hasExpectedSchemas = (document: DiagramDocument, publicSchemas: PublicSchema[]) => {
          const currentSchemaIds = document.data.db.schemas.map(schema => schema.id).sort();
          const expectedSchemaIds = publicSchemas.map(schema => schema.id).sort();

          return (
            currentSchemaIds.length === expectedSchemaIds.length &&
            currentSchemaIds.every((schemaId, index) => schemaId === expectedSchemaIds[index])
          );
        };

        const enforcePublicProvider = async (
          document: DiagramDocument,
          publicSchemas: PublicSchema[]
        ) => {
          if (hasExpectedSchemas(document, publicSchemas)) return;

          await reconcilePublicProvider(document, publicSchemas);
        };

        const { documentFactory, diagramFactory } = initializeDiagramCraft(workspaceId);
        const includedPackages = getIncludedPackages();

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
        
        if (!file) throw new Error('Diagram file not found');
        setFileInfo({ path: file.path, name: file.name });
        fileInfoRef.current = { path: file.path, name: file.name };

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

        const root = await documentFactory.loadCRDT(roomName, userState, () => {});
        const document = await documentFactory.createDocument(root, roomName, () => {});

        const publicSchemasResponse = await fetch(`/api/public/${workspaceId}/schemas`);
        if (!publicSchemasResponse.ok) throw new Error('Failed to load public schemas');
        const publicSchemas = (await publicSchemasResponse.json()) as PublicSchema[];

        // If the CRDT already has state (another client is connected), use it directly.
        // Otherwise, this is the first client — load from REST and deserialize.
        if (document.diagrams.length === 0) {
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
          const diagramData = injectPublicProvider(serializedDiagramData, publicSchemas);

          await deserializeDiagramDocument(diagramData, document, diagramFactory, {
            includedPackages
          });
        }

        await document.load();
        await reconcilePublicProvider(document, publicSchemas);

        const handleDataChange = () => {
          void enforcePublicProvider(document, publicSchemas);
        };
        releaseDataChange = document.data.on('change', handleDataChange);

        if (document.diagrams.length === 0) {
          throw new Error('Diagram file contains no diagrams');
        }

        docRef.current = document;
        setDoc(document);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load diagram');
        setLoading(false);
      }
    };

    loadDiagram();

    return () => {
      CollaborationConfig.Backend.disconnect(() => {});
      releaseDataChange();
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
    isWorkspaceContent
  ]);

  const { documentFactory, diagramFactory } = initializeDiagramCraft(workspaceId);

  if (loading) {
    return (
      <div className={styles.diagramScreen}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading diagram...</p>
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
        dirty={false}
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
