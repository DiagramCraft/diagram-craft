import { useEntityTree } from '../../../hooks/useEntities';

type UseEntityBrowserTreeDataProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
};

export const useEntityBrowserTreeData = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter
}: UseEntityBrowserTreeDataProps) => {
  const { data: treeData } = useEntityTree(workspaceId, {
    schemaId: typeFilter,
    owner: ownerFilter,
    lifecycle: statusFilter,
    q,
    projectId: projectId ?? undefined,
    projectScope: projectId ? projectScope : undefined
  });

  return {
    treeEdges: treeData?.edges ?? [],
    treeNodes: treeData?.nodes ?? []
  };
};
