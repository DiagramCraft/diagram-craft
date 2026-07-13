import type { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { UrlDataProviderId } from '@diagram-craft/model/data-providers/dataProviderUrl';
import type {
  SerializedDiagramDocument,
  SerializedOverride
} from '@diagram-craft/model/serialization/serializedTypes';

export const ARCH_REGISTER_PUBLIC_PROVIDER_ID = 'arch-register-public';
export type PublicDiagramSchema = Omit<DataSchema, 'providerId'> & { providerId?: string };
type SerializedOverrides = Record<string, Record<string, SerializedOverride>>;

export const deriveDiagramScope = (params: {
  workspaceSlug?: string;
  diagramId?: string;
  projectId?: string;
  entityId?: string;
}) => {
  const workspaceId = params.workspaceSlug!;
  const isEntityDiagram = !!params.entityId;
  const isWorkspaceContent = !params.projectId && !params.entityId;
  return {
    workspaceId,
    diagramId: params.diagramId!,
    projectId: params.projectId ?? params.entityId ?? workspaceId,
    isEntityDiagram,
    isWorkspaceContent
  };
};

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
};
