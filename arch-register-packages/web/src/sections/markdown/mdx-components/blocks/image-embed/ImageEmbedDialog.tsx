import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { useMarkdownContent } from '../../../../../hooks/useMarkdownContent';
import { useUploadMarkdownAttachment } from '../../../../../hooks/useAttachments';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import type { ImageEmbedSlateElement } from './types';
import { isEmbeddableImageAttachment } from './imageEmbedUtils';
import styles from './ImageEmbedDialog.module.css';
import { EmptyState } from '../../../../../components/EmptyState';
import type { ContentScope } from '../../../../../hooks/useContentScope';

type EmbedMode = 'upload' | 'existing';
type ImageAlign = 'left' | 'center' | 'right';

const EMBED_MODES: { value: EmbedMode; label: string }[] = [
  { value: 'upload', label: 'Upload new' },
  { value: 'existing', label: 'Choose existing' }
];

const ALIGN_MODES: { value: ImageAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' }
];

export const ImageEmbedDialog = ({
  element,
  open,
  onClose,
  isNew
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const { nodeId, projectId, entityId } = useMdxContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const el = element as ImageEmbedSlateElement;
  const [mode, setMode] = useState<EmbedMode>(el.fileId ? 'existing' : 'upload');
  const [fileId, setFileId] = useState(el.fileId ?? '');
  const [alt, setAlt] = useState(el.alt ?? '');
  const [size, setSize] = useState(el.size ?? '100');
  const [align, setAlign] = useState<ImageAlign>(
    el.align === 'left' || el.align === 'right' ? el.align : 'center'
  );
  const [isUploading, setIsUploading] = useState(false);

  const contentScope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };
  const { data } = useMarkdownContent(workspaceSlug, nodeId ?? '');
  const uploadAttachment = useUploadMarkdownAttachment(contentScope, nodeId ?? '');
  const imageAttachments = useMemo(
    () => (data?.attachments ?? []).filter(isEmbeddableImageAttachment),
    [data?.attachments]
  );

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path || !fileId) {
      if (isNew && path) editor.tf.removeNodes({ at: path });
      onClose();
      return;
    }

    editor.tf.setNodes(
      {
        fileId,
        alt: alt.trim(),
        size: size.trim(),
        align
      },
      { at: path }
    );
    onClose();
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !nodeId) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadAttachment.mutateAsync(file);
      setFileId(uploaded.id);
      setMode('existing');
      if (!alt.trim()) setAlt(uploaded.original_filename ?? uploaded.name);
    } finally {
      setIsUploading(false);
    }
  };

  const isSaveDisabled = isUploading || uploadAttachment.isPending || !fileId;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Image embed"
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', disabled: isSaveDisabled, onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={event => void handleUploadChange(event)}
        />
        <div className={styles.modeSwitcher}>
          <ModeSwitcher modes={EMBED_MODES} value={mode} onChange={setMode} />
        </div>

        {mode === 'upload' ? (
          <DialogSection label="Image">
            <div className={styles.uploadActions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading…' : 'Choose image…'}
              </button>
              <span className={styles.helperText}>Upload an image attachment for this document.</span>
            </div>
          </DialogSection>
        ) : (
          <DialogSection label="Image">
            {imageAttachments.length === 0 ? (
              <EmptyState compact title="No image attachments found." />
            ) : (
              <div className={styles.list}>
                {imageAttachments.map(attachment => (
                  <button
                    type="button"
                    key={attachment.id}
                    className={`${styles.listItem} ${attachment.id === fileId ? styles.selected : ''}`}
                    onClick={() => {
                      setFileId(attachment.id);
                      if (!alt.trim()) {
                        setAlt(attachment.original_filename ?? attachment.name);
                      }
                    }}
                  >
                    <span className={styles.itemName}>
                      {attachment.original_filename ?? attachment.name}
                    </span>
                    <span className={styles.itemMeta}>{attachment.mime_type ?? 'image'}</span>
                  </button>
                ))}
              </div>
            )}
          </DialogSection>
        )}

        <DialogSection label="Alt text (optional)">
          <input
            className={styles.input}
            type="text"
            placeholder="Describe the image…"
            value={alt}
            onChange={event => setAlt(event.target.value)}
          />
        </DialogSection>

        <DialogSection label="Size (percent)">
          <input
            className={styles.input}
            type="text"
            placeholder="100"
            value={size}
            onChange={event => setSize(event.target.value)}
          />
        </DialogSection>

        <DialogSection label="Align">
          <ModeSwitcher modes={ALIGN_MODES} value={align} onChange={value => setAlign(value as ImageAlign)} />
        </DialogSection>
      </DialogContent>
    </Dialog>
  );
};
