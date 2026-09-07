// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentAiAction, DocumentType } from '@arch-register/api-types/documentContract';
import type { RunAiActionResponse } from '@arch-register/api-types/projectDocumentAiContract';
import { useMarkdownEditorAi, type MarkdownEditorAiOptions } from './useMarkdownEditorAi';

const mocks = vi.hoisted(() => ({
  createConversation: { mutateAsync: vi.fn() },
  runAiAction: vi.fn(),
  writeAiActionSeed: vi.fn()
}));

vi.mock('../../hooks/useAiConversations', () => ({
  useCreateConversation: () => mocks.createConversation
}));

vi.mock('../../hooks/useAiConfig', () => ({
  useAiStatus: () => ({ data: { configured: true } })
}));

vi.mock('../../hooks/useDocumentAiActions', () => ({
  runDocumentAiAction: (...args: unknown[]) => mocks.runAiAction(...args)
}));

vi.mock('../../lib/aiActionSeed', () => ({
  writeAiActionSeed: (...args: unknown[]) => mocks.writeAiActionSeed(...args)
}));

const result: RunAiActionResponse = {
  actionId: 'summarize',
  actionName: 'Summarize',
  prompt: 'Summarize this document',
  answer: 'Summary',
  documentTitle: 'Document',
  nodeId: 'node-1'
};

const makeOptions = (): MarkdownEditorAiOptions => ({
  workspaceSlug: 'workspace',
  nodeId: 'node-1',
  isDraft: false,
  selectedDocumentType: {
    id: 'type-1',
    name: 'Document type',
    fields: [],
    aiActions: [{ id: 'summarize', name: 'Summarize', enabled: true, kind: 'interactive' }]
  } as unknown as DocumentType,
  onNavigateToConversation: vi.fn()
});

let latest!: ReturnType<typeof useMarkdownEditorAi>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorAiOptions }) => {
  latest = useMarkdownEditorAi(options);
  return null;
};

const renderAi = (options: MarkdownEditorAiOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness options={options} />);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createConversation.mutateAsync.mockResolvedValue({ id: 'conversation-1' });
  mocks.runAiAction.mockImplementation(async (...args: unknown[]) => {
    const onDelta = args[3] as (delta: string) => void;
    onDelta('Part ');
    onDelta('one');
    return result;
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorAi', () => {
  it('streams an action result and continues it in a new conversation', async () => {
    const options = makeOptions();
    renderAi(options);
    const action = { id: 'summarize' } as unknown as DocumentAiAction;

    await act(async () => {
      await latest.onRunAiAction(action);
    });

    expect(latest.aiActionStreamingText).toBe('Part one');
    expect(latest.aiActionResult).toEqual(result);
    expect(latest.aiActions).toHaveLength(1);

    await act(async () => {
      await latest.onContinueInConversation(result);
    });

    expect(mocks.writeAiActionSeed).toHaveBeenCalledWith({
      documentTitle: 'Document',
      documentLink: window.location.href,
      actionPrompt: 'Summarize this document',
      answer: 'Summary'
    });
    expect(options.onNavigateToConversation).toHaveBeenCalledWith('conversation-1');
  });
});
