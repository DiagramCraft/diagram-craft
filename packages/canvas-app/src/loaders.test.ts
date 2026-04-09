import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FileSystem,
  fileLoaderRegistry,
  getFileLoaderForUrl,
  loadFileFromUrl,
  type FileLoader
} from './loaders';

describe('getFileLoaderForUrl()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(fileLoaderRegistry)) {
      delete fileLoaderRegistry[key];
    }
  });

  it('prefers the longest registered compound extension', () => {
    const svgLoader = vi.fn(async () => undefined) as FileLoader;
    const fallbackLoader = vi.fn(async () => undefined) as FileLoader;
    const svgFactory = vi.fn(async () => svgLoader);
    const fallbackFactory = vi.fn(async () => fallbackLoader);

    fileLoaderRegistry['.svg'] = fallbackFactory;
    fileLoaderRegistry['.diagramCraft.svg'] = svgFactory;

    expect(getFileLoaderForUrl('/tmp/foo.v2.diagramCraft.svg')).toBe(svgFactory);
  });

  it('ignores query strings and fragments when resolving the extension', () => {
    const factory = vi.fn(async () => vi.fn(async () => undefined));
    fileLoaderRegistry['.dcd'] = factory;

    expect(getFileLoaderForUrl('https://example.test/diagram.dcd?version=1#preview')).toBe(
      factory
    );
  });
});

describe('loadFileFromUrl()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(fileLoaderRegistry)) {
      delete fileLoaderRegistry[key];
    }
  });

  it('fails before loading content when no loader matches', async () => {
    const loadFromUrl = vi.spyOn(FileSystem, 'loadFromUrl').mockResolvedValue('ignored');

    await expect(
      loadFileFromUrl(
        'unknown.ext',
        {} as never,
        vi.fn() as never,
        {} as never,
        {} as never
      )
    ).rejects.toThrow('File loader for unknown.ext not found');

    expect(loadFromUrl).not.toHaveBeenCalled();
  });

  it('loads content, document state and invokes the resolved loader', async () => {
    const root = { type: 'root' };
    const doc = {
      load: vi.fn(async () => undefined)
    };
    const diagramFactory = { type: 'diagramFactory' };
    const loader = vi.fn(async () => undefined);
    const loaderFactory = vi.fn(async () => loader);
    const documentFactory = {
      loadCRDT: vi.fn(async () => root),
      createDocument: vi.fn(async () => doc)
    };

    fileLoaderRegistry['.dcd'] = loaderFactory;
    vi.spyOn(FileSystem, 'loadFromUrl').mockResolvedValue('serialized');

    const result = await loadFileFromUrl(
      'folder/diagram.dcd?version=1',
      { userId: 'user' } as never,
      vi.fn() as never,
      documentFactory as never,
      diagramFactory as never
    );

    expect(loaderFactory).toHaveBeenCalledOnce();
    expect(FileSystem.loadFromUrl).toHaveBeenCalledWith('folder/diagram.dcd?version=1');
    expect(documentFactory.loadCRDT).toHaveBeenCalledWith(
      'folder/diagram.dcd?version=1',
      { userId: 'user' },
      expect.any(Function)
    );
    expect(documentFactory.createDocument).toHaveBeenCalledWith(
      root,
      'folder/diagram.dcd?version=1',
      expect.any(Function)
    );
    expect(loader).toHaveBeenCalledWith('serialized', doc, diagramFactory);
    expect(doc.load).toHaveBeenCalledOnce();
    expect(result).toBe(doc);
  });
});
