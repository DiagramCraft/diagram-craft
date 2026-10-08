import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
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
 * shared by the API usage pairs widget (`apiPairCoverage.ts`).
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

/**
 * Ranks APIs by consumer count, descending, capped at `limit` — the "Most consumed APIs" panel's
 * row order. An API absent from `consumersByApi` is treated as having 0 consumers.
 */
export const rankMostConsumedApis = (
  apis: readonly EntityRecord[],
  consumersByApi: Map<string, RelationRecord[]>,
  limit: number
): EntityRecord[] =>
  [...apis]
    .sort(
      (a, b) =>
        (consumersByApi.get(b._uid)?.length ?? 0) - (consumersByApi.get(a._uid)?.length ?? 0)
    )
    .slice(0, limit);

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
