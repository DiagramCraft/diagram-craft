import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { resolveAsset, resolveFile } from './path';
import * as platform from './platform';

vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn()
  }
}));

vi.mock('./platform', () => ({
  isPackaged: vi.fn()
}));

describe('path utilities', () => {
  const mockIsPackaged = vi.mocked(platform.isPackaged);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveAsset', () => {
    test('should resolve asset path in packaged mode', () => {
      mockIsPackaged.mockReturnValue(true);
      const originalResourcesPath = process.resourcesPath;
      (process as any).resourcesPath = '/app/resources';

      const result = resolveAsset('icon.png');

      expect(result).toBe(path.join('/app/resources', 'assets', 'icon.png'));

      (process as any).resourcesPath = originalResourcesPath;
    });

    test('should resolve asset path in development mode', () => {
      mockIsPackaged.mockReturnValue(false);

      const result = resolveAsset('icon.png');

      expect(result).toBe(path.join(__dirname, '../../../../assets', 'icon.png'));
    });

    test('should handle nested asset paths', () => {
      mockIsPackaged.mockReturnValue(false);

      const result = resolveAsset('images/logo.svg');

      expect(result).toBe(path.join(__dirname, '../../../../assets', 'images/logo.svg'));
    });
  });

  describe('resolveFile', () => {
    test('should resolve file path with STENCIL_ROOT replacement in packaged mode', () => {
      mockIsPackaged.mockReturnValue(true);
      const originalResourcesPath = process.resourcesPath;
      (process as any).resourcesPath = '/app/resources';

      const result = resolveFile('$STENCIL_ROOT/components.js');

      expect(result).toBe(path.join('/app/resources', 'main/dist', 'components.js'));

      (process as any).resourcesPath = originalResourcesPath;
    });

    test('should resolve file path with RESOURCE_ROOT replacement in packaged mode', () => {
      mockIsPackaged.mockReturnValue(true);
      const originalResourcesPath = process.resourcesPath;
      (process as any).resourcesPath = '/app/resources';

      const result = resolveFile('$RESOURCE_ROOT/data.json');

      expect(result).toBe(path.join('/app/resources', 'main/dist', 'data.json'));

      (process as any).resourcesPath = originalResourcesPath;
    });

    test('should resolve file path with STENCIL_ROOT replacement in development mode', () => {
      mockIsPackaged.mockReturnValue(false);

      const result = resolveFile('$STENCIL_ROOT/components.js');

      expect(result).toBe(path.join(__dirname, '../../../../../main/dist', 'components.js'));
    });

    test('should resolve file path with RESOURCE_ROOT replacement in development mode', () => {
      mockIsPackaged.mockReturnValue(false);

      const result = resolveFile('$RESOURCE_ROOT/data.json');

      expect(result).toBe(path.join(__dirname, '../../../../../main/dist', 'data.json'));
    });

    test('should handle paths with both replacements', () => {
      mockIsPackaged.mockReturnValue(false);

      const result = resolveFile('$STENCIL_ROOT/lib/$RESOURCE_ROOT/file.js');
      const basePath = path.join(__dirname, '../../../../../main/dist');
      const expected = `${basePath}/lib/${basePath}/file.js`;

      expect(result).toBe(expected);
    });

    test('should return unchanged path when no replacements needed', () => {
      mockIsPackaged.mockReturnValue(false);

      const result = resolveFile('/absolute/path/file.js');

      expect(result).toBe('/absolute/path/file.js');
    });
  });
});
