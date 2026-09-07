import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import {
  useDeleteMarkdownAttachment,
  useUploadMarkdownAttachment
} from '../../hooks/useAttachments';
import type { ContentScope } from '../../hooks/useContentScope';

export type MarkdownEditorAttachmentsOptions = {
  contentScope: ContentScope;
  nodeId: string;
  isReadOnly: boolean;
  data: MarkdownContent | undefined;
  onOpenAttachment: (attachment: ProjectFile) => void;
  onDownloadAttachment: (attachment: ProjectFile) => void;
};

export const useMarkdownEditorAttachments = ({
  contentScope,
  nodeId,
  isReadOnly,
  data,
  onOpenAttachment,
  onDownloadAttachment
}: MarkdownEditorAttachmentsOptions) => {
  const uploadAttachmentMutation = useUploadMarkdownAttachment(contentScope, nodeId);
  const deleteAttachmentMutation = useDeleteMarkdownAttachment(contentScope, nodeId);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<ProjectFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deleteAttachment = useCallback(
    (path: string) => deleteAttachmentMutation.mutateAsync(path),
    [deleteAttachmentMutation]
  );

  const onOpen = useCallback(
    (attachment: ProjectFile) => {
      if (attachment.type === 'file') {
        onDownloadAttachment(attachment);
        return;
      }
      onOpenAttachment(attachment);
    },
    [onDownloadAttachment, onOpenAttachment]
  );

  const onInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      for (const file of files) {
        await uploadAttachmentMutation.mutateAsync(file);
      }
    },
    [uploadAttachmentMutation]
  );

  const onRequestDelete = useCallback((attachment: ProjectFile) => {
    setAttachmentDeleteTarget(attachment);
  }, []);

  const onDeleteConfirm = useCallback(async () => {
    if (!attachmentDeleteTarget || isReadOnly) return;
    await deleteAttachment(attachmentDeleteTarget.path);
    setAttachmentDeleteTarget(null);
  }, [attachmentDeleteTarget, deleteAttachment, isReadOnly]);

  const cancelDelete = useCallback(() => setAttachmentDeleteTarget(null), []);

  return {
    items: data?.attachments ?? [],
    fileInputRef,
    isUploading: uploadAttachmentMutation.isPending,
    isDeleting: deleteAttachmentMutation.isPending,
    onOpen,
    onInputChange,
    onRequestDelete,
    attachmentDeleteTarget,
    onDeleteConfirm,
    cancelDelete,
    deleteAttachment
  };
};
