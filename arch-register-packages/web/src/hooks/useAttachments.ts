import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { applicationWorkspacePath } from '../lib/applicationApi';
import { invalidateMarkdownNode } from '../queries/markdownContent';
import { deleteContentFile, uploadContentFile, type ContentScope } from './useContentScope';

const invalidateAttachmentNode = async (
  queryClient: ReturnType<typeof useQueryClient>,
  scope: ContentScope,
  nodeId: string
) => {
  await invalidateMarkdownNode(queryClient, scope, nodeId);
};

export const useUploadMarkdownAttachment = (scope: ContentScope, nodeId: string) => {
  const queryClient = useQueryClient();
  const { workspaceId } = scope;
  return useMutation({
    mutationFn: (file: File) =>
      uploadContentFile(
        applicationWorkspacePath(workspaceId, `/markdown/${nodeId}/attachments/upload`),
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
