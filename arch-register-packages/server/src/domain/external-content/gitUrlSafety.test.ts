import { describe, expect, it } from 'vitest';
import { assertSafeGitUrl } from './gitUrlSafety';

describe('assertSafeGitUrl', () => {
  it.each([
    'file:///tmp/repository.git',
    'ssh://git@example.com/repository.git'
  ])('rejects non-HTTPS Git URLs: %s', async url => {
    await expect(assertSafeGitUrl(url)).rejects.toThrow('must use HTTPS');
  });

  it('rejects private HTTPS Git hosts', async () => {
    await expect(assertSafeGitUrl('https://127.0.0.1/repository.git')).rejects.toThrow(
      'Git source host must be publicly routable'
    );
    await expect(assertSafeGitUrl('https://localhost/repository.git')).rejects.toThrow(
      'Git source host must be publicly routable'
    );
  });
});
