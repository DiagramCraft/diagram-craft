import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateProjectQueries } from './queryKeys';
import { orpcClient } from '../lib/orpcClient';

// Hook for fetching project templates
export const useProjectTemplates = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: ['project-templates', workspaceId, projectId],
    queryFn: () =>
      orpcClient.templates.listForProject({
        params: { workspace: workspaceId, id: projectId }
      }),
    enabled: !!workspaceId && !!projectId
  });
};

// Hook for fetching workspace-level templates only (no project-specific templates)
export const useWorkspaceOnlyTemplates = (workspaceId: string) => {
  return useQuery({
    queryKey: ['workspace-templates', workspaceId],
    queryFn: async () => {
      const result = await orpcClient.templates.listAll({
        params: { workspace: workspaceId }
      });
      return result.workspaceTemplates;
    },
    enabled: !!workspaceId
  });
};

// Hook for toggling template status
export const useToggleTemplateStatus = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      filePath,
      isTemplate,
      isWorkspaceTemplate
    }: {
      filePath: string;
      isTemplate: boolean;
      isWorkspaceTemplate: boolean;
    }) =>
      orpcClient.projects.updateTemplateStatus({
        params: { workspace: workspaceId, id: projectId },
        query: { path: filePath },
        body: { is_template: isTemplate, is_workspace_template: isWorkspaceTemplate }
      }),
    onSuccess: async () => {
      await invalidateProjectQueries(queryClient, workspaceId, projectId);
      // Invalidate all project templates in the workspace since workspace templates are shared
      await queryClient.invalidateQueries({ queryKey: ['project-templates', workspaceId] });
    }
  });
};
