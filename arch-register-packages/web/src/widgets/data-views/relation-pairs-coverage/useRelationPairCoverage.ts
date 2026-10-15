import { useMemo } from 'react';
import { useRelations } from '../../../hooks/useRelations';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { computeRelationPairs, resolveTypedRelationSchemaId } from './relationPairCoverageLogic';
import type { RelationPairsSourceConfig } from './types';

const RELATION_LIMIT = 500;

/** Loads the provider, consumer and coverage relations of a hub schema and pairs them up. */
export const useRelationPairCoverage = (config: RelationPairsSourceConfig) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const hubSchema = schemas.find(candidate => candidate.name === config.hubSchemaName);
  const providerSchemaId = resolveTypedRelationSchemaId(hubSchema, config.providerFieldName);
  const consumerSchemaId = resolveTypedRelationSchemaId(hubSchema, config.consumerFieldName);
  const coverageSchemaId = relationSchemas.find(
    candidate => candidate.name === config.coverageRelationSchemaName
  )?.id;

  const providers = useRelations(
    workspaceSlug,
    { schemaId: providerSchemaId ?? undefined, limit: RELATION_LIMIT },
    { enabled: providerSchemaId != null }
  );
  const consumers = useRelations(
    workspaceSlug,
    { schemaId: consumerSchemaId ?? undefined, limit: RELATION_LIMIT },
    { enabled: consumerSchemaId != null }
  );
  const coverage = useRelations(
    workspaceSlug,
    { schemaId: coverageSchemaId, limit: RELATION_LIMIT },
    { enabled: coverageSchemaId != null }
  );

  const pairs = useMemo(
    () => computeRelationPairs(providers.data, consumers.data, coverage.data),
    [providers.data, consumers.data, coverage.data]
  );

  return {
    hubSchema,
    providerSchemaId,
    consumerSchemaId,
    coverageSchemaId,
    pairs,
    isLoading: providers.isLoading || consumers.isLoading || coverage.isLoading
  };
};
