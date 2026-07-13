import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, downloadUrl } from './browserDownload';

describe('browser downloads', () => {
  const click = vi.fn();
  const remove = vi.fn();
  const appendChild = vi.fn();
  const anchor = { href: '', download: '', click, remove };

  beforeEach(() => {
    click.mockReset();
    remove.mockReset();
    appendChild.mockReset();
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('clicks a temporary anchor and removes it', () => {
    downloadUrl('/download/a', 'a.json');

    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(anchor).toMatchObject({ href: '/download/a', download: 'a.json' });
  });

  it('revokes blob URLs after triggering the download', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    downloadBlob(new Blob(['a']), 'a.csv');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
