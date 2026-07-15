import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import {
  getMarkdownAttachmentDownloadUrl,
  isEmbeddableImageAttachment,
  isImageMimeType
} from './imageEmbedUtils';

const makeFile = (overrides: Partial<ProjectFile> = {}): ProjectFile => ({
  id: 'file-1',
  project_id: null,
  path: 'docs/page/__attachments/image.png',
  name: 'image.png',
  size_bytes: 123,
  created_at: '2026-07-02T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
  type: 'file',
  mime_type: 'image/png',
  original_filename: 'image.png',
  content_metadata: null,
  ...overrides
});

describe('imageEmbedUtils', () => {
  it('recognizes image mime types', () => {
    expect(isImageMimeType('image/png')).toBe(true);
    expect(isImageMimeType('image/svg+xml')).toBe(true);
    expect(isImageMimeType('application/pdf')).toBe(false);
    expect(isImageMimeType(null)).toBe(false);
  });

  it('filters to binary image attachments', () => {
    expect(isEmbeddableImageAttachment(makeFile())).toBe(true);
    expect(isEmbeddableImageAttachment(makeFile({ mime_type: 'application/pdf' }))).toBe(false);
    expect(isEmbeddableImageAttachment(makeFile({ type: 'diagram' }))).toBe(false);
  });

  it('builds project scoped attachment download urls', () => {
    expect(
      getMarkdownAttachmentDownloadUrl({
        workspaceSlug: 'demo',
        projectId: 'project-42',
        attachmentPath: 'docs/page/__attachments/image 1.png'
      })
    ).toBe(
      '/api/demo/projects/project-42/files/download?path=docs%2Fpage%2F__attachments%2Fimage%201.png'
    );
  });

  it('builds entity and workspace scoped attachment download urls', () => {
    expect(
      getMarkdownAttachmentDownloadUrl({
        workspaceSlug: 'demo',
        entityId: 'entity-9',
        attachmentPath: 'docs/page/__attachments/image.png'
      })
    ).toBe(
      '/api/demo/entities/entity-9/content/files/download?path=docs%2Fpage%2F__attachments%2Fimage.png'
    );

    expect(
      getMarkdownAttachmentDownloadUrl({
        workspaceSlug: 'demo',
        attachmentPath: 'docs/page/__attachments/image.png'
      })
    ).toBe('/api/demo/content/files/download?path=docs%2Fpage%2F__attachments%2Fimage.png');
  });
});
