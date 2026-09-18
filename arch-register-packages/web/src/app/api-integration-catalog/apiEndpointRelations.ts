import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { useRelations } from '../../hooks/useRelations';

/** The `api` entity schema's own typed-relation field ids for `Provides API` / `Consumes API`. */
export const PROVIDERS_FIELD = 'providers';
export const CONSUMERS_FIELD = 'consumers';

/** Resolves a `typedRelation` field on an entity schema to its bound relation-schema id, or
 *  `null` when the field is missing or isn't a typed relation. */
export const resolveTypedRelationSchemaId = (
  apiSchema: EntitySchema | undefined,
  fieldId: string
): string | null => {
  const field = apiSchema?.fields.find(candidate => candidate.id === fieldId);
  return field?.type === 'typedRelation' ? field.relationSchemaId : null;
};

/**
 * Fetches every `Provides API` / `Consumes API` typed relation in the workspace, once each —
 * shared by the Integrations screen's "API Usage" pairs (`apiPairCoverage.ts`) and the APIs
 * screen's Providers/Consumers columns and cross-API operations views (#3345). Mirrors
 * `ApiIntegrationCatalogIntegrationsScreen.tsx`'s original inline resolution of these same two
 * relation schemas, extracted once a second call site needed the identical ~20-line lookup.
 */
export const useApiEndpointRelations = (
  workspaceSlug: string,
  apiSchema: EntitySchema | undefined
): { providers: RelationRecord[]; consumers: RelationRecord[]; isLoading: boolean } => {
  const providersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, PROVIDERS_FIELD);
  const consumersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, CONSUMERS_FIELD);

  const providers = useRelations(
    workspaceSlug,
    { schemaId: providersRelationSchemaId ?? undefined, limit: 500 },
    { enabled: providersRelationSchemaId != null }
  );
  const consumers = useRelations(
    workspaceSlug,
    { schemaId: consumersRelationSchemaId ?? undefined, limit: 500 },
    { enabled: consumersRelationSchemaId != null }
  );

  return {
    providers: providers.data,
    consumers: consumers.data,
    isLoading: providers.isLoading || consumers.isLoading
  };
};

/** Groups relations by their API endpoint (`_out` — the API is always the `_out` side of
 *  `Provides API` / `Consumes API` relations, confirmed by how these relations are modeled). */
export const groupByApiId = (relations: RelationRecord[]): Map<string, RelationRecord[]> => {
  const map = new Map<string, RelationRecord[]>();
  for (const relation of relations) {
    const apiId = relation._out.id;
    const existing = map.get(apiId);
    if (existing) existing.push(relation);
    else map.set(apiId, [relation]);
  }
  return map;
};
