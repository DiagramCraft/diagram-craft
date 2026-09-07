// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import {
  useMarkdownEditorTransitions,
  type MarkdownEditorTransitionsOptions
} from './useMarkdownEditorTransitions';

const savedFile = { id: 'file-1' } as ProjectFile;

let latest!: ReturnType<typeof useMarkdownEditorTransitions>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorTransitionsOptions }) => {
  latest = useMarkdownEditorTransitions(options);
  return null;
};

const renderTransitions = (options: MarkdownEditorTransitionsOptions) => {
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

describe('useMarkdownEditorTransitions', () => {
  it('clears diagram state and navigates only once for a transition', () => {
    const options: MarkdownEditorTransitionsOptions = {
      transitionKey: 'document-1|edit',
      clearDiagramSessionState: vi.fn(),
      onExit: vi.fn(),
      onNavigateBack: vi.fn(),
      onNavigateToSavedDraft: vi.fn()
    };
    renderTransitions(options);

    act(() => {
      latest.finalizeExit();
      latest.finalizeExit();
    });

    expect(options.clearDiagramSessionState).toHaveBeenCalledOnce();
    expect(options.onExit).toHaveBeenCalledOnce();
  });

  it('allows the next transition after the route key changes', () => {
    const options: MarkdownEditorTransitionsOptions = {
      transitionKey: 'document-1|preview',
      clearDiagramSessionState: vi.fn(),
      onExit: vi.fn(),
      onNavigateBack: vi.fn(),
      onNavigateToSavedDraft: vi.fn()
    };
    renderTransitions(options);

    act(() => latest.finalizeExit());
    act(() => {
      root!.render(<Harness options={{ ...options, transitionKey: 'document-1|edit' }} />);
    });
    act(() => latest.finalizeExit());

    expect(options.clearDiagramSessionState).toHaveBeenCalledTimes(2);
    expect(options.onExit).toHaveBeenCalledTimes(2);
  });

  it('navigates to a saved draft without pre-empting the document-change reset', () => {
    const options: MarkdownEditorTransitionsOptions = {
      transitionKey: 'draft|edit',
      clearDiagramSessionState: vi.fn(),
      onExit: vi.fn(),
      onNavigateBack: vi.fn(),
      onNavigateToSavedDraft: vi.fn()
    };
    renderTransitions(options);

    act(() => latest.finalizeSavedDraft(savedFile));

    expect(options.clearDiagramSessionState).not.toHaveBeenCalled();
    expect(options.onNavigateToSavedDraft).toHaveBeenCalledWith(savedFile);
  });
});
