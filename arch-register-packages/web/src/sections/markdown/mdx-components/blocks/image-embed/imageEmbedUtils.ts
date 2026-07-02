import type { ProjectFile } from '@arch-register/api-types/projectContract';

export const isImageMimeType = (mimeType: string | null | undefined) =>
  typeof mimeType === 'string' && mimeType.startsWith('image/');

export const isEmbeddableImageAttachment = (file: ProjectFile) =>
  file.type === 'file' && isImageMimeType(file.mime_type);

export const getMarkdownAttachmentDownloadUrl = (params: {
  workspaceSlug: string;
  attachmentPath: string;
  projectId?: string;
  entityId?: string;
}) => {
  const { workspaceSlug, attachmentPath, projectId, entityId } = params;
  const encodedPath = encodeURIComponent(attachmentPath);

  if (projectId) {
    return `/api/${workspaceSlug}/projects/${projectId}/files/download?path=${encodedPath}`;
  }

  if (entityId) {
    return `/api/${workspaceSlug}/entities/${entityId}/content/files/download?path=${encodedPath}`;
  }

  return `/api/${workspaceSlug}/content/files/download?path=${encodedPath}`;
};
