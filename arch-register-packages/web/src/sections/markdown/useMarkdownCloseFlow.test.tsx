// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkdownCloseFlow } from './useMarkdownCloseFlow';

const createdDiagramsRef = { current: [] };
let latest!: ReturnType<typeof useMarkdownCloseFlow>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;
const onExit = vi.fn();

const Harness = () => {
  latest = useMarkdownCloseFlow({
    dirty: true,
    hasPendingDiagramChanges: false,
    savedBody: '# Saved',
    sessionId: 'close-flow-session',
    createdDiagramsRef,
    loadDiagramContentByPath: vi.fn(async () => ({})),
    saveDiagramContentByPath: vi.fn(async () => undefined),
    refreshDiagramPreviewCaches: vi.fn(async () => undefined),
    clearDiagramSessionState: vi.fn(),
    deleteAttachment: vi.fn(async () => undefined),
    onExit
  });
  return null;
};

beforeEach(() => {
  onExit.mockClear();
  createdDiagramsRef.current = [];
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness />);
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownCloseFlow', () => {
  it('opens unsaved-change protection before exiting and completes the keep path', async () => {
    await act(async () => {
      await latest.handleClose();
    });

    expect(latest.closeDialogOpen).toBe(true);
    expect(onExit).not.toHaveBeenCalled();

    await act(async () => {
      await latest.handleKeepDiagramChanges();
    });

    expect(onExit).toHaveBeenCalledOnce();
  });
});
