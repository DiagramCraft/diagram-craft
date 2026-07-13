import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { markdownContentKeys } from './useMarkdownContent';
import {
  deleteContentFile,
  invalidateContentScope,
  uploadContentFile,
  type ContentScope
} from './useContentScope';

const invalidateAttachmentNode = async (
  queryClient: ReturnType<typeof useQueryClient>,
  scope: ContentScope,
  nodeId: string
) => {
  const { workspaceId } = scope;
  await queryClient.invalidateQueries({
    queryKey: markdownContentKeys.detail(workspaceId, nodeId)
  });
  await invalidateContentScope(queryClient, scope);
};

export const useUploadMarkdownAttachment = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (file: File) =>
      uploadContentFile(
        `/api/${workspaceId}/markdown/${nodeId}/attachments/upload`,
        file,
        file.name
      ),
    onSuccess: () => invalidateAttachmentNode(queryClient, scope, nodeId)
  });
};

export const useCreateMarkdownDiagramAttachment = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: Record<string, unknown> }) =>
      orpcClient.projects.createMarkdownDiagramAttachment({
        params: { workspace: workspaceId, nodeId },
        body: { name, content }
      }),
    onSuccess: () => invalidateAttachmentNode(queryClient, scope, nodeId)
  });
};

export const useDeleteMarkdownAttachment = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filePath: string) => deleteContentFile(scope, filePath),
    onSuccess: () => invalidateAttachmentNode(queryClient, scope, nodeId)
  });
};
