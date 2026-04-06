import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseArgs } from './config';
import { type RunningServer } from './server';

const tempDirs: string[] = [];
const runningServers: RunningServer[] = [];
const originalFetch = globalThis.fetch;

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(server => server.close()));
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('parseArgs', () => {
  test('uses explicit host and port values', () => {
    const parsed = parseArgs(['--host', '127.0.0.1', '--port', '4100'], {});

    expect(parsed).toEqual({
      host: '127.0.0.1',
      port: 4100,
      dataDir: './data',
      fsRoot: '../main/public',
      collaboration: false,
      bootstrapData: undefined,
      bootstrapSchemas: undefined,
      openrouterApiKey: undefined,
      openrouterModel: undefined,
      openrouterSiteUrl: undefined,
      openrouterAppName: undefined
    });
  });
});
