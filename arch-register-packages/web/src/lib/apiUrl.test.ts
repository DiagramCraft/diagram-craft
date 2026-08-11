import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveApiUrl } from './apiUrl';

describe('resolveApiUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://app.example.test'
      }
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    ['https://api.example.test', 'https://api.example.test/api/workspaces'],
    ['https://api.example.test/', 'https://api.example.test/api/workspaces'],
    ['https://api.example.test/backend', 'https://api.example.test/backend/api/workspaces'],
    ['https://api.example.test/backend/', 'https://api.example.test/backend/api/workspaces']
  ])('resolves %s as a URL prefix', (configuredBase, expected) => {
    vi.stubEnv('VITE_API_URL', configuredBase);

    expect(resolveApiUrl('/api/workspaces')).toBe(expected);
  });

  it('uses the browser origin when no API URL is configured', () => {
    vi.stubEnv('VITE_API_URL', '');

    expect(resolveApiUrl('/api/workspaces')).toBe('https://app.example.test/api/workspaces');
  });

  it('leaves absolute request URLs unchanged', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/backend/');

    expect(resolveApiUrl('https://upload.example.test/import')).toBe(
      'https://upload.example.test/import'
    );
  });
});
