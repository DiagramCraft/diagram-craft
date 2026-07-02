// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MdxContext } from '../../../MdxContext';
import { ImageEmbed } from './ImageEmbed';

const useProjectFileMock = vi.fn();
const fetchWithAuthResponseMock = vi.fn();

vi.mock('../../../../../hooks/useProjectFiles', () => ({
  useProjectFile: (...args: unknown[]) => useProjectFileMock(...args)
}));

vi.mock('../../../../../auth/authClient', () => ({
  fetchWithAuthResponse: (...args: unknown[]) => fetchWithAuthResponseMock(...args)
}));

const makeFile = (overrides: Record<string, unknown> = {}) => ({
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

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('ImageEmbed', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const createObjectURL = vi.fn(() => 'blob:preview');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads and renders an image attachment preview', async () => {
    useProjectFileMock.mockReturnValue({
      data: makeFile(),
      isLoading: false,
      isError: false
    });
    fetchWithAuthResponseMock.mockResolvedValue(
      new Response(new Blob(['png'], { type: 'image/png' }), { status: 200 })
    );

    await act(async () => {
      root.render(
        <MdxContext.Provider value={{ workspaceSlug: 'demo', nodeId: 'node-1' }}>
          <ImageEmbed id="file-1" alt="Architecture" size="75" align="right" />
        </MdxContext.Provider>
      );
      await flush();
    });

    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('blob:preview');
    expect(image?.getAttribute('alt')).toBe('Architecture');
    expect(image?.style.width).toBe('75%');
    expect(image?.style.marginLeft).toBe('auto');
    expect(image?.style.marginRight).toBe('0px');
    expect(fetchWithAuthResponseMock).toHaveBeenCalledWith(
      '/api/demo/content/files/download?path=docs%2Fpage%2F__attachments%2Fimage.png'
    );

    await act(async () => {
      image?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelectorAll('img')).toHaveLength(2);
  });

  it('renders an unsupported state for non-image attachments', async () => {
    useProjectFileMock.mockReturnValue({
      data: makeFile({ mime_type: 'application/pdf' }),
      isLoading: false,
      isError: false
    });

    await act(async () => {
      root.render(
        <MdxContext.Provider value={{ workspaceSlug: 'demo', nodeId: 'node-1' }}>
          <ImageEmbed id="file-1" />
        </MdxContext.Provider>
      );
      await flush();
    });

    expect(container.textContent).toContain('Attachment is not an image');
    expect(fetchWithAuthResponseMock).not.toHaveBeenCalled();
  });

  it('renders a missing file state when metadata lookup fails', async () => {
    useProjectFileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true
    });

    await act(async () => {
      root.render(
        <MdxContext.Provider value={{ workspaceSlug: 'demo', nodeId: 'node-1' }}>
          <ImageEmbed id="missing-file" />
        </MdxContext.Provider>
      );
      await flush();
    });

    expect(container.textContent).toContain('Image not found: missing-file');
  });
});
