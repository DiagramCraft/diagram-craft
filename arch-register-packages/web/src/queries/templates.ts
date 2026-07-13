import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { invalidateProjectQueries } from './projects';

export const templateKeys = {
  projectAll: ['project-templates'] as const,
  projectWorkspace: (workspaceId: string) => [...templateKeys.projectAll, workspaceId] as const,
  project: (workspaceId: string, projectId: string) =>
    [...templateKeys.projectWorkspace(workspaceId), projectId] as const,
  workspaceAll: ['workspace-templates'] as const,
  workspace: (workspaceId: string) => [...templateKeys.workspaceAll, workspaceId] as const
};

export const projectTemplatesQuery = (workspaceId: string, projectId: string) =>
  queryOptions({
    queryKey: templateKeys.project(workspaceId, projectId),
    queryFn: () =>
      orpcClient.templates.listForProject({
        params: { workspace: workspaceId, id: projectId }
      }),
    enabled: !!workspaceId && !!projectId
  });

export const workspaceTemplatesQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: templateKeys.workspace(workspaceId),
    queryFn: async () => {
      const result = await orpcClient.templates.listAll({ params: { workspace: workspaceId } });
      return result.workspaceTemplates;
    },
    enabled: !!workspaceId
  });

export const invalidateTemplateStatus = async (
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string
) => {
  await Promise.all([
    invalidateProjectQueries(queryClient, workspaceId, projectId),
    queryClient.invalidateQueries({ queryKey: templateKeys.projectWorkspace(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: templateKeys.workspace(workspaceId) })
  ]);
};
