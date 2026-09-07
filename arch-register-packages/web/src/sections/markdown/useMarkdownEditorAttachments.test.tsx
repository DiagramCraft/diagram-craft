// @vitest-environment jsdom
import { act, type ChangeEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import {
  useMarkdownEditorAttachments,
  type MarkdownEditorAttachmentsOptions
} from './useMarkdownEditorAttachments';

const mocks = vi.hoisted(() => ({
  upload: { mutateAsync: vi.fn(), isPending: false },
  delete: { mutateAsync: vi.fn(), isPending: false }
}));

vi.mock('../../hooks/useAttachments', () => ({
  useUploadMarkdownAttachment: () => mocks.upload,
  useDeleteMarkdownAttachment: () => mocks.delete
}));

const makeFile = (type: ProjectFile['type'] = 'markdown') =>
  ({
    id: 'file-1',
    name: 'Attachment',
    path: 'Attachment.md',
    type,
    read_only: false
  }) as ProjectFile;

const makeContent = (attachments: ProjectFile[]): MarkdownContent =>
  ({
    body: '',
    attachments,
    document_type: null,
    document_type_id: null,
    metadata: {},
    generated_metadata: {},
    available_fields: [],
    retired_fields: [],
    workflow: []
  }) as MarkdownContent;

const makeOptions = (
  overrides: Partial<MarkdownEditorAttachmentsOptions> = {}
): MarkdownEditorAttachmentsOptions => ({
  contentScope: { kind: 'workspace', workspaceId: 'workspace' },
  nodeId: 'node-1',
  isReadOnly: false,
  data: makeContent([]),
  onOpenAttachment: vi.fn(),
  onDownloadAttachment: vi.fn(),
  ...overrides
});

let latest!: ReturnType<typeof useMarkdownEditorAttachments>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorAttachmentsOptions }) => {
  latest = useMarkdownEditorAttachments(options);
  return null;
};

const renderAttachments = (options: MarkdownEditorAttachmentsOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness options={options} />);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mutateAsync.mockResolvedValue({});
  mocks.delete.mutateAsync.mockResolvedValue({});
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorAttachments', () => {
  it('routes file downloads separately from navigable attachments', () => {
    const options = makeOptions();
    renderAttachments(options);
    const fileAttachment = makeFile('file');
    const markdownAttachment = makeFile('markdown');

    act(() => {
      latest.onOpen(fileAttachment);
      latest.onOpen(markdownAttachment);
    });

    expect(options.onDownloadAttachment).toHaveBeenCalledWith(fileAttachment);
    expect(options.onOpenAttachment).toHaveBeenCalledWith(markdownAttachment);
  });

  it('clears the input before uploading every selected file', async () => {
    renderAttachments(makeOptions());
    const first = new File(['one'], 'one.txt');
    const second = new File(['two'], 'two.txt');
    const input = {
      target: { files: [first, second], value: 'selected' }
    } as unknown as ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await latest.onInputChange(input);
    });

    expect(input.target.value).toBe('');
    expect(mocks.upload.mutateAsync).toHaveBeenNthCalledWith(1, first);
    expect(mocks.upload.mutateAsync).toHaveBeenNthCalledWith(2, second);
  });

  it('deletes the selected attachment and clears its confirmation target', async () => {
    const attachment = makeFile('file');
    renderAttachments(makeOptions({ data: makeContent([attachment]) }));

    act(() => latest.onRequestDelete(attachment));
    expect(latest.attachmentDeleteTarget).toBe(attachment);

    await act(async () => {
      await latest.onDeleteConfirm();
    });

    expect(mocks.delete.mutateAsync).toHaveBeenCalledWith(attachment.path);
    expect(latest.attachmentDeleteTarget).toBeNull();
  });
});
