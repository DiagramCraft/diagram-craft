import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateAuditQueries, invalidateProjectQueries, entityContentKeys, workspaceContentKeys } from './queryKeys';
import { ProjectFile } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';
import { apiFetchResponse } from '../lib/http';
import { markdownContentKeys } from './useMarkdownContent';

export const uploadFile = async (url: string, file: File, filePath: string): Promise<ProjectFile> => {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await apiFetchResponse(`${url}?path=${encodeURIComponent(filePath)}`, {
    method: 'POST',
    body: formData
  });
  return response.json() as Promise<ProjectFile>;
};

const invalidateAttachmentNode = async (
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  await queryClient.invalidateQueries({ queryKey: markdownContentKeys.detail(workspaceId, nodeId) });
  await invalidateAuditQueries(queryClient, workspaceId);

  if (options?.projectId) {
    await invalidateProjectQueries(queryClient, workspaceId, options.projectId);
    return;
  }

  if (options?.entityId) {
    await queryClient.invalidateQueries({ queryKey: entityContentKeys.all(workspaceId, options.entityId) });
    return;
  }

  await queryClient.invalidateQueries({ queryKey: workspaceContentKeys.all(workspaceId) });
};

export const useUploadMarkdownAttachment = (
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadFile(`/api/${workspaceId}/markdown/${nodeId}/attachments/upload`, file, file.name),
    onSuccess: () => invalidateAttachmentNode(queryClient, workspaceId, nodeId, options)
  });
};

export const useCreateMarkdownDiagramAttachment = (
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: Record<string, unknown> }) =>
      orpcClient.projects.createMarkdownDiagramAttachment({
        params: { workspace: workspaceId, nodeId },
        body: { name, content }
      }),
    onSuccess: () => invalidateAttachmentNode(queryClient, workspaceId, nodeId, options)
  });
};

export const useDeleteMarkdownAttachment = (
  workspaceId: string,
  nodeId: string,
  options?: { projectId?: string; entityId?: string }
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filePath: string) => {
      if (options?.projectId) {
        return orpcClient.projects.deleteFile({
          params: { workspace: workspaceId, id: options.projectId },
          query: { path: filePath }
        });
      }

      if (options?.entityId) {
        return orpcClient.projects.deleteEntityFile({
          params: { workspace: workspaceId, entityId: options.entityId },
          query: { path: filePath }
        });
      }

      return orpcClient.projects.deleteWorkspaceFile({
        params: { workspace: workspaceId },
        query: { path: filePath }
      });
    },
    onSuccess: () => invalidateAttachmentNode(queryClient, workspaceId, nodeId, options)
  });
};
