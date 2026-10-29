import type { ContentScope } from '../../queries/content';
import type { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { UrlDataProviderId } from '@diagram-craft/model/data-providers/dataProviderUrl';
import type {
  SerializedDiagramDocument,
  SerializedOverride
} from '@diagram-craft/model/serialization/serializedTypes';

export const ARCH_REGISTER_PUBLIC_PROVIDER_ID = 'arch-register-public';
export type PublicDiagramSchema = Omit<DataSchema, 'providerId'> & { providerId?: string };
type SerializedOverrides = Record<string, Record<string, SerializedOverride>>;

/**
 * Which content a diagram route belongs to. Entity routes carry an `entityId`, project routes a
 * `projectId`; the workspace content routes carry neither.
 */
export const deriveDiagramScope = (params: {
  workspaceSlug?: string;
  diagramId?: string;
  projectId?: string;
  entityId?: string;
}): { diagramId: string; scope: ContentScope } => {
  const workspaceId = params.workspaceSlug!;
  const diagramId = params.diagramId!;
  if (params.entityId) {
    return { diagramId, scope: { kind: 'entity', workspaceId, entityId: params.entityId } };
  }
  if (params.projectId) {
    return { diagramId, scope: { kind: 'project', workspaceId, projectId: params.projectId } };
  }
  return { diagramId, scope: { kind: 'workspace', workspaceId } };
};

/** The id of the project, entity or workspace that owns the diagram. */
export const diagramScopeOwnerId = (scope: ContentScope): string =>
  scope.kind === 'project'
    ? scope.projectId
    : scope.kind === 'entity'
      ? scope.entityId
      : scope.workspaceId;

/** Name of the collaboration room (CRDT document) a diagram file is edited in. */
export const diagramRoomName = (scope: ContentScope, fileId: string): string =>
  scope.kind === 'workspace'
    ? `${scope.workspaceId}/workspace-content/${fileId}.json`
    : `${scope.workspaceId}/${diagramScopeOwnerId(scope)}/${fileId}.json`;

export const normalizePublicSchemas = (schemas: PublicDiagramSchema[]) =>
  schemas.map(schema => ({ ...schema, providerId: ARCH_REGISTER_PUBLIC_PROVIDER_ID }));

export const injectPublicDiagramProvider = (
  diagram: SerializedDiagramDocument,
  schemas: PublicDiagramSchema[],
  workspaceId: string
): SerializedDiagramDocument => {
  const currentData =
    typeof diagram.data === 'object' && diagram.data !== null
      ? (diagram.data as Record<string, unknown>)
      : {};
  const normalizedSchemas = normalizePublicSchemas(schemas);
  return {
    ...diagram,
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
            schemaUrl: `/api/adapters/diagram-craft/${workspaceId}/schemas`,
            dataUrl: `/api/adapters/diagram-craft/${workspaceId}/data`
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
};
