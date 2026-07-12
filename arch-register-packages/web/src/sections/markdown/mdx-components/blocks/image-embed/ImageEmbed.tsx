import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { fetchWithAuthResponse } from '../../../../../auth/authClient';
import { Banner } from '../../../../../components/Banner';
import { useProjectFile } from '../../../../../hooks/useProjectFiles';
import { useMdxContext } from '../../../MdxContext';
import { getMarkdownAttachmentDownloadUrl, isImageMimeType } from './imageEmbedUtils';
import styles from './ImageEmbed.module.css';

const normalizeSize = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}%`;
  if (/^\d+(\.\d+)?%$/.test(trimmed)) return trimmed;
  return undefined;
};

const normalizeAlign = (value?: string) => {
  if (value === 'left' || value === 'center' || value === 'right') return value;
  return 'center';
};

const imageStyle = (size?: string, align?: string): CSSProperties => {
  const width = normalizeSize(size);
  const normalizedAlign = normalizeAlign(align);

  if (normalizedAlign === 'left') {
    return { width, marginLeft: '0', marginRight: 'auto' };
  }

  if (normalizedAlign === 'right') {
    return { width, marginLeft: 'auto', marginRight: '0' };
  }

  return { width, marginLeft: 'auto', marginRight: 'auto' };
};

export const ImageEmbed = ({
  id,
  alt,
  size,
  align
}: {
  id: string;
  alt?: string;
  size?: string;
  align?: string;
}) => {
  const { workspaceSlug, projectId, entityId } = useMdxContext();
  const { data: file, isLoading, isError } = useProjectFile(workspaceSlug ?? '', id);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      setImageUrl(null);
      setLoadError(null);

      if (!id || !workspaceSlug || !file) return;
      if (!isImageMimeType(file.mime_type)) {
        setLoadError('Attachment is not an image');
        return;
      }

      const response = await fetchWithAuthResponse(
        getMarkdownAttachmentDownloadUrl({
          workspaceSlug,
          attachmentPath: file.path,
          projectId,
          entityId
        })
      );

      if (!response.ok) {
        if (active) setLoadError('Failed to load image');
        return;
      }

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!active) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setImageUrl(objectUrl);
    };

    void load().catch(() => {
      if (active) setLoadError('Failed to load image');
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entityId, file, id, projectId, workspaceSlug]);

  useEffect(() => {
    if (!previewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen]);

  if (!id) return null;

  const handleClick = () => {
    if (!imageUrl) return;
    setPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <figure className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </figure>
    );
  }

  if (isError || !file) {
    return <Banner variant="error">Image not found: {id}</Banner>;
  }

  if (loadError) {
    return <Banner variant="error">{loadError}</Banner>;
  }

  if (!imageUrl) {
    return (
      <figure className={styles.container}>
        <div className={styles.loading}>Loading…</div>
      </figure>
    );
  }

  return (
    <>
      <figure className={`${styles.container} ${styles.clickable}`} onClick={handleClick}>
        <img
          className={styles.image}
          src={imageUrl}
          alt={alt ?? file.original_filename ?? file.name}
          style={imageStyle(size, align)}
        />
      </figure>
      {previewOpen &&
        createPortal(
          <div
            className={styles.lightboxBackdrop}
            onClick={() => setPreviewOpen(false)}
            role="presentation"
          >
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setPreviewOpen(false)}
              aria-label="Close image preview"
            >
              ×
            </button>
            <div
              className={styles.lightboxSurface}
              onClick={event => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={file.original_filename ?? file.name}
            >
              <img
                className={styles.lightboxImage}
                src={imageUrl}
                alt={alt ?? file.original_filename ?? file.name}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
