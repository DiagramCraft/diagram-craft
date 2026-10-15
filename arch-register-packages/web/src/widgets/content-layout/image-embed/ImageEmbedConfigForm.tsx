import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { useMarkdownContent } from '../../../hooks/useMarkdownContent';
import { useUploadMarkdownAttachment } from '../../../hooks/useAttachments';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { EmptyState } from '../../../components/EmptyState';
import type { ContentScope } from '../../../hooks/useContentScope';
import type { ConfigFormProps } from '../../shared/types';
import { isEmbeddableImageAttachment } from './imageEmbedUtils';
import type { ImageEmbedWidgetConfig } from './types';
import styles from './ImageEmbedConfigForm.module.css';

type EmbedMode = 'upload' | 'existing';
type ImageAlign = ImageEmbedWidgetConfig['align'];

const EMBED_MODES: { value: EmbedMode; label: string }[] = [
  { value: 'upload', label: 'Upload new' },
  { value: 'existing', label: 'Choose existing' }
];

const ALIGN_MODES: { value: ImageAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' }
];

export const ImageEmbedConfigForm = ({
  config,
  onChange
}: ConfigFormProps<ImageEmbedWidgetConfig>) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { nodeId, projectId, entityId } = useMdxContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<EmbedMode>(config.fileId ? 'existing' : 'upload');
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

  const select = (fileId: string, filename: string) =>
    onChange({
      ...config,
      fileId,
      alt: config.alt?.trim() ? config.alt : filename
    });

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !nodeId) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadAttachment.mutateAsync(file);
      select(uploaded.id, uploaded.original_filename ?? uploaded.name);
      setMode('existing');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
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
                  className={`${styles.listItem} ${attachment.id === config.fileId ? styles.selected : ''}`}
                  onClick={() =>
                    select(attachment.id, attachment.original_filename ?? attachment.name)
                  }
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

      <DialogSection label="Alt text" required={false}>
        <input
          className={styles.input}
          type="text"
          placeholder="Describe the image…"
          value={config.alt ?? ''}
          onChange={event => onChange({ ...config, alt: event.target.value })}
        />
      </DialogSection>

      <DialogSection label="Size (percent)">
        <input
          className={styles.input}
          type="text"
          placeholder="100"
          value={config.size}
          onChange={event => onChange({ ...config, size: event.target.value })}
        />
      </DialogSection>

      <DialogSection label="Align">
        <ModeSwitcher
          modes={ALIGN_MODES}
          value={config.align}
          onChange={value => onChange({ ...config, align: value as ImageAlign })}
        />
      </DialogSection>
    </>
  );
};
