import { useState, useEffect, useCallback, useRef } from 'react';
import type { NavigateFn } from '../routing';
import styles from './DiagramScreen.module.css';
import { TbArrowLeft } from 'react-icons/tb';
import { initializeDiagramCraft, getIncludedPackages } from '../diagramcraft-initial-config';
import { EmbeddableEditor } from '@diagram-craft/main/EmbeddableEditor';
import { DefaultDataProvider } from '@diagram-craft/model/data-providers/dataProviderDefault';
import { UrlDataProviderId } from '@diagram-craft/model/data-providers/dataProviderUrl';
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

const ARCH_REGISTER_PUBLIC_PROVIDER_ID = 'arch-register-public';
type PublicSchema = Omit<DataSchema, 'providerId'> & { providerId?: string };
type SerializedOverrides = Record<string, Record<string, SerializedOverride>>;

interface DiagramScreenProps {
  workspaceId: string;
  projectId: string;
  diagramId: string;
  navigate: NavigateFn;
}

export const DiagramScreen = ({ workspaceId, projectId, diagramId, navigate }: DiagramScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ path: string; name: string } | null>(null);
  const [doc, setDoc] = useState<DiagramDocument | null>(null);
  const docRef = useRef<DiagramDocument | null>(null);
  const fileInfoRef = useRef<{ path: string; name: string } | null>(null);

  const injectPublicProvider = useCallback(
    (
      diagramData: SerializedDiagramDocument,
      publicSchemas: PublicSchema[]
    ): SerializedDiagramDocument => {
      const currentData =
        typeof diagramData.data === 'object' && diagramData.data !== null
          ? (diagramData.data as Record<string, unknown>)
          : {};
      const normalizedSchemas = publicSchemas.map(schema => ({
        ...schema,
        providerId: ARCH_REGISTER_PUBLIC_PROVIDER_ID
      }));

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
    [workspaceId]
  );

  const suppressDefaultProvider = useCallback(async (document: DiagramDocument) => {
    const defaultProvider = document.data.providers.find(
      provider => provider instanceof DefaultDataProvider
    );

    if (!defaultProvider) return;

    for (const schema of [...defaultProvider.schemas]) {
      await defaultProvider.deleteSchema(schema);
    }
  }, []);

  // Save on close as a safety net (server auto-save handles ongoing persistence)
  const save = useCallback(async () => {
    if (!docRef.current || !fileInfoRef.current) return;

    try {
      const serialized = await serializeDiagramDocument(docRef.current);
      const response = await fetch(
        `/api/${workspaceId}/projects/${projectId}/files/${fileInfoRef.current.path}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serialized)
        }
      );
      if (!response.ok) throw new Error('Failed to save diagram');
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [workspaceId, projectId]);

  const handleClose = useCallback(async () => {
    await save();
    navigate({ view: 'project-detail', projectId });
  }, [save, navigate, projectId]);

  useEffect(() => {
    const loadDiagram = async () => {
      try {
        setLoading(true);

        const { documentFactory, diagramFactory } = initializeDiagramCraft();
        const includedPackages = getIncludedPackages();

        // Fetch project to get file info
        const projectResponse = await fetch(`/api/${workspaceId}/projects/${projectId}`);
        if (!projectResponse.ok) throw new Error('Failed to load project');
        const project = await projectResponse.json();

        // Find the file in the project
        // biome-ignore lint/suspicious/noExplicitAny: API response
        const findFile = (folders: any[], rootFiles: any[]) => {
          for (const file of rootFiles) {
            if (file.id === diagramId) return file;
          }
          for (const folder of folders) {
            for (const file of folder.files) {
              if (file.id === diagramId) return file;
            }
          }
          return null;
        };

        const file = findFile(project.files.folders, project.files.rootFiles);
        if (!file) throw new Error('Diagram file not found');
        setFileInfo({ path: file.path, name: file.name });
        fileInfoRef.current = { path: file.path, name: file.name };

        // Construct the collaboration room name
        const roomName = `${workspaceId}/${projectId}/${file.id}.json`;

        // Connect to collaboration backend and sync CRDT state
        const config = AppConfig.get();
        const userState = {
          name: config.awareness.name(),
          color: config.awareness.color(),
          avatar: config.awareness.avatar()
        };

        const root = await documentFactory.loadCRDT(roomName, userState, () => {});
        const document = await documentFactory.createDocument(root, roomName, () => {});

        // If the CRDT already has state (another client is connected), use it directly.
        // Otherwise, this is the first client — load from REST and deserialize.
        if (document.diagrams.length === 0) {
          const [diagramResponse, publicSchemasResponse] = await Promise.all([
            fetch(`/api/${workspaceId}/projects/${projectId}/files/${file.path}`),
            fetch(`/api/public/${workspaceId}/schemas`)
          ]);
          if (!diagramResponse.ok) throw new Error('Failed to load diagram content');
          if (!publicSchemasResponse.ok) throw new Error('Failed to load public schemas');
          const [rawDiagramData, publicSchemas] = await Promise.all([
            diagramResponse.json(),
            publicSchemasResponse.json()
          ]);
          const serializedDiagramData = rawDiagramData as SerializedDiagramDocument;
          const diagramData = injectPublicProvider(serializedDiagramData, publicSchemas as PublicSchema[]);

          await deserializeDiagramDocument(diagramData, document, diagramFactory, {
            includedPackages
          });
        }

        await document.load();
        await suppressDefaultProvider(document);

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
      if (docRef.current) {
        docRef.current.deactivate(() => {});
        docRef.current.release();
        docRef.current = null;
      }
    };
  }, [workspaceId, projectId, diagramId, injectPublicProvider, suppressDefaultProvider]);

  const { documentFactory, diagramFactory } = initializeDiagramCraft();

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
