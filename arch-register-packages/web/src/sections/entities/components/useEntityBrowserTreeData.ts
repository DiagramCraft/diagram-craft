import { useEntityTree } from '../../../hooks/useEntities';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';

type UseEntityBrowserTreeDataProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  entityQuery?: EntityQuery | null;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  joinAssessmentId?: string | null;
  schemaIds?: string[] | null;
  enabled?: boolean;
};

export const useEntityBrowserTreeData = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  entityQuery,
  typeFilter,
  ownerFilter,
  statusFilter,
  joinAssessmentId,
  schemaIds,
  enabled = true
}: UseEntityBrowserTreeDataProps) => {
  const { data: treeData } = useEntityTree(
    workspaceId,
    {
      schemaId: entityQuery ? undefined : typeFilter,
      schemaIds: entityQuery ? undefined : schemaIds,
      owner: entityQuery ? undefined : ownerFilter,
      lifecycle: entityQuery ? undefined : statusFilter,
      q: entityQuery ? undefined : q,
      entityQuery,
      assessmentId: entityQuery?.assessmentId ?? joinAssessmentId,
      projectId: projectId ?? undefined,
      projectScope: projectId ? projectScope : undefined
    },
    enabled
  );

  return {
    treeEdges: treeData?.edges ?? [],
    treeNodes: treeData?.nodes ?? []
  };
};
