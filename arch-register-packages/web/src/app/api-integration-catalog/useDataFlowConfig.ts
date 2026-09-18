import { useRelationSchemas } from '../../hooks/useRelationSchemas';

/**
 * Runtime relation schemas carry no `symId` (the template-only `symId` on `dataFlowRelationSchema`
 * in `schemaTemplates.ts` doesn't survive to the workspace's persisted schema), so this name is the
 * only stable signal available for detecting whether the `data-flow` composition extension is
 * active in a workspace. Duplicated from `../data-stewardship/useDataFlowConfig.ts` rather than
 * imported — there is no cross-`app/*` import precedent between sibling apps in this codebase.
 */
export const DATA_FLOW_RELATION_SCHEMA_NAME = 'Data Flow';

export type DataFlowConfig = {
  relationSchemaId: string;
};

/**
 * Resolves whether Data Flow relations are available in this workspace — the signal the
 * Integrations section uses to decide between the real table and a "not configured" empty state.
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
