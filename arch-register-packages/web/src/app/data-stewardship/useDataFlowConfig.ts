import { useRelationSchemas } from '../../hooks/useRelationSchemas';

/**
 * Runtime relation schemas carry no `symId` (confirmed against
 * `@arch-register/api-types/relationSchemaContract`'s `relationSchemaSchema` — the template-only
 * `symId` on `dataFlowRelationSchema` in `schemaTemplates.ts` doesn't survive to the workspace's
 * persisted schema), so this name is the only stable signal available for detecting whether the
 * `data-flow` composition extension is active in a workspace. There is no #3150 capability binding
 * to resolve instead — see `dataStewardshipQueries.ts`'s `resolveDataStewardshipConfig` for the
 * capability-binding pattern this deliberately does *not* use.
 */
export const DATA_FLOW_RELATION_SCHEMA_NAME = 'Data Flow';

export type DataFlowConfig = {
  relationSchemaId: string;
};

/**
 * Resolves whether Data Flow relations are available in this workspace — the signal the
 * Classification section's Restricted Flows and Cross-boundary Transfers views use to decide
 * between the real view and a plain "not configured" notice (#3150 doesn't exist as an app yet).
 */
export const useDataFlowConfig = (
  workspaceSlug: string
): { data: DataFlowConfig | null; isLoading: boolean } => {
  const relationSchemas = useRelationSchemas(workspaceSlug);
  const schema = relationSchemas.data?.find(
    candidate => candidate.name === DATA_FLOW_RELATION_SCHEMA_NAME
  );
  return {
    data: schema ? { relationSchemaId: schema.id } : null,
    isLoading: relationSchemas.isLoading
  };
};
