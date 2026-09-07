// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkdownRevisionSummary } from '@arch-register/api-types/projectMarkdownContract';
import type { ContentScope } from '../../hooks/useContentScope';
import {
  useMarkdownEditorHistory,
  type MarkdownEditorHistoryOptions
} from './useMarkdownEditorHistory';

const mocks = vi.hoisted(() => ({
  restore: { mutateAsync: vi.fn(), isPending: false }
}));

vi.mock('../../hooks/useMarkdownContent', () => ({
  useRestoreMarkdownRevision: () => mocks.restore
}));

const revision = { id: 'revision-1' } as MarkdownRevisionSummary;

const makeOptions = (
  overrides: Partial<MarkdownEditorHistoryOptions> = {}
): MarkdownEditorHistoryOptions => ({
  nodeId: 'node-1',
  isDraft: false,
  isReadOnly: false,
  contentScope: { kind: 'workspace', workspaceId: 'workspace' } satisfies ContentScope,
  requestedPanel: 'history',
  historyMode: 'preview',
  compareMode: 'to-current',
  selectedRevisionId: undefined,
  revisions: [revision],
  revisionsLoading: false,
  updateSearch: vi.fn(),
  document: { markClean: vi.fn() },
  transitions: {
    finalizeExit: vi.fn(() => true),
    finalizeBack: vi.fn(() => true),
    finalizeSavedDraft: vi.fn(() => true)
  },
  ...overrides
});

let latest!: ReturnType<typeof useMarkdownEditorHistory>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorHistoryOptions }) => {
  latest = useMarkdownEditorHistory(options);
  return null;
};

const renderHistory = (options: MarkdownEditorHistoryOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness options={options} />);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.restore.mutateAsync.mockResolvedValue({});
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorHistory', () => {
  it('selects the newest revision when history opens without a selection', () => {
    const options = makeOptions();
    renderHistory(options);

    expect(options.updateSearch).toHaveBeenCalledWith(
      { mode: 'preview', panel: 'history', revisionId: 'revision-1' },
      true
    );
  });

  it('restores a revision and finalizes through the editor transition boundary', async () => {
    const options = makeOptions({ selectedRevisionId: 'revision-1' });
    renderHistory(options);

    await act(async () => {
      await latest.onRestore('revision-1');
    });

    expect(mocks.restore.mutateAsync).toHaveBeenCalledWith({
      revisionId: 'revision-1',
      change_kind: 'major'
    });
    expect(options.document.markClean).toHaveBeenCalledOnce();
    expect(options.transitions.finalizeExit).toHaveBeenCalledOnce();
  });
});
