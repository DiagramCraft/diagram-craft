import { useEntityTree } from '../../../hooks/useEntities';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

type UseEntityBrowserTreeDataProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  conditions?: FilterCondition[];
  entityQuery?: EntityQuery | null;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  joinAssessmentId?: string | null;
  asOf?: string | null;
  includePlannedChanges?: boolean | null;
  schemaIds?: string[] | null;
  treeExpansion?: 'ancestors' | 'both';
  treeDepth?: number | null;
  enabled?: boolean;
};

export const useEntityBrowserTreeData = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  conditions,
  entityQuery,
  typeFilter,
  ownerFilter,
  statusFilter,
  joinAssessmentId,
  asOf,
  includePlannedChanges,
  schemaIds,
  treeExpansion,
  treeDepth,
  enabled = true
}: UseEntityBrowserTreeDataProps) => {
  const query = useEntityTree(
    workspaceId,
    {
      schemaId: entityQuery ? undefined : typeFilter,
      schemaIds,
      owner: entityQuery ? undefined : ownerFilter,
      lifecycle: entityQuery ? undefined : statusFilter,
      q: entityQuery ? undefined : q,
      conditions: entityQuery ? undefined : conditions,
      entityQuery,
      assessmentId: entityQuery?.assessmentId ?? joinAssessmentId,
      projectId: projectId ?? undefined,
      projectScope: projectId ? projectScope : undefined,
      asOf: asOf ?? undefined,
      includePlannedChanges: includePlannedChanges ?? undefined,
      treeExpansion,
      treeDepth
    },
    enabled
  );

  return {
    treeEdges: query.data?.edges ?? [],
    treeNodes: query.data?.nodes ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  };
};
