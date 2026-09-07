// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import {
  useMarkdownEditorFileActions,
  type MarkdownEditorFileActionsOptions
} from './useMarkdownEditorFileActions';

const file = { id: 'file-1', name: 'Document' } as ProjectFile;

let latest!: ReturnType<typeof useMarkdownEditorFileActions>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorFileActionsOptions }) => {
  latest = useMarkdownEditorFileActions(options);
  return null;
};

const renderFileActions = (options: MarkdownEditorFileActionsOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness options={options} />);
  });
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorFileActions', () => {
  it('does not repeat deletion or navigation for duplicate confirmation calls', async () => {
    const deleteFile = vi.fn(async () => undefined);
    const onNavigateBack = vi.fn();
    renderFileActions({
      file,
      isReadOnly: false,
      transitionKey: 'document-1|preview',
      renameFile: vi.fn(async () => undefined),
      deleteFile,
      onNavigateBack
    });

    act(() => latest.onRequestDelete());
    await act(async () => {
      await Promise.all([latest.onDeleteConfirm(), latest.onDeleteConfirm()]);
    });

    expect(deleteFile).toHaveBeenCalledOnce();
    expect(onNavigateBack).toHaveBeenCalledOnce();
  });
});
