import { describe, expect, test } from 'vitest';
import { isStencilAssetUrl, resolveStencilAssetUrl } from './stencilUrl';

describe('stencil URLs', () => {
  test('recognizes and resolves the stencil root token when no root is configured', () => {
    const url = '$STENCIL_ROOT/stencils/android/android.xml';

    expect(isStencilAssetUrl(url, '')).toBe(true);
    expect(resolveStencilAssetUrl(url, '')).toBe('/stencils/android/android.xml');
  });

  test('recognizes and resolves the stencil root token with a configured root', () => {
    const url = '$STENCIL_ROOT/stencils/android/android.xml';

    expect(isStencilAssetUrl(url, '/assets')).toBe(true);
    expect(resolveStencilAssetUrl(url, '/assets')).toBe('/assets/stencils/android/android.xml');
  });

  test('recognizes already-resolved stencil URLs', () => {
    expect(isStencilAssetUrl('/assets/stencils/android/android.xml', '/assets')).toBe(true);
    expect(isStencilAssetUrl('diagram.drawio', '/assets')).toBe(false);
  });
});
