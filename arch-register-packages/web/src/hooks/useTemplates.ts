import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invalidateTemplateStatus,
  projectTemplatesQuery,
  workspaceTemplatesQuery
} from '../queries/templates';
import { orpcClient } from '../lib/orpcClient';

// Hook for fetching project templates
export const useProjectTemplates = (workspaceId: string, projectId: string) => {
  return useQuery(projectTemplatesQuery(workspaceId, projectId));
};

// Hook for fetching workspace-level templates only (no project-specific templates)
export const useWorkspaceOnlyTemplates = (workspaceId: string) => {
  return useQuery(workspaceTemplatesQuery(workspaceId));
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
      await invalidateTemplateStatus(queryClient, workspaceId, projectId);
    }
  });
};
