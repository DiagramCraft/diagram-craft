import { useEntityTree } from '../../../hooks/useEntities';

type UseEntityBrowserTreeDataProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
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
      schemaId: typeFilter,
      schemaIds,
      owner: ownerFilter,
      lifecycle: statusFilter,
      q,
      assessmentId: joinAssessmentId,
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
