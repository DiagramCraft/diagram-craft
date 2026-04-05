import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseArgs } from './config';
import { startServer, type RunningServer } from './server';


const tempDirs: string[] = [];
const runningServers: RunningServer[] = [];
const originalFetch = globalThis.fetch;

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(server => server.close()));
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

const createTestServer = async (overrides: Partial<Parameters<typeof startServer>[0]> = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'diagram-craft-server-main-'));
  tempDirs.push(root);

  const dataDir = join(root, 'data');
  const fsRoot = join(root, 'public');
  await mkdir(dataDir, { recursive: true });
  await mkdir(fsRoot, { recursive: true });

  const server = await startServer({
    host: '127.0.0.1',
    port: 0,
    dataDir,
    fsRoot,
    collaboration: false,
    ...overrides
  });
  runningServers.push(server);

  return server;
};

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

describe('server-main runtime', () => {
  test('serves the existing REST app', async () => {
    const server = await createTestServer();

    const response = await fetch(`${server.httpUrl}/api/openapi.json`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      openapi: '3.0.3'
    });
  });



  test('supports data and schema CRUD through the composed REST server', async () => {
    const server = await createTestServer();

    const schemaResponse = await fetch(`${server.httpUrl}/api/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 'customer',
        name: 'Customer',
        source: 'external',
        fields: [{ id: 'name', name: 'Name', type: 'text' }]
      })
    });

    expect(schemaResponse.status).toBe(200);

    const dataCreateResponse = await fetch(`${server.httpUrl}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        _schemaId: 'customer',
        name: 'Ada'
      })
    });

    expect(dataCreateResponse.status).toBe(200);
    const createdData = await dataCreateResponse.json();

    expect(createdData).toMatchObject({
      _schemaId: 'customer',
      name: 'Ada'
    });
    expect(createdData._uid).toEqual(expect.any(String));

    const dataListResponse = await fetch(`${server.httpUrl}/api/data`);
    await expect(dataListResponse.json()).resolves.toEqual([createdData]);

    const dataUpdateResponse = await fetch(`${server.httpUrl}/api/data/${createdData._uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        _schemaId: 'customer',
        name: 'Grace'
      })
    });

    await expect(dataUpdateResponse.json()).resolves.toMatchObject({
      _uid: createdData._uid,
      _schemaId: 'customer',
      name: 'Grace'
    });

    const dataDeleteResponse = await fetch(`${server.httpUrl}/api/data/${createdData._uid}`, {
      method: 'DELETE'
    });
    expect(dataDeleteResponse.status).toBe(200);

    const schemaDeleteResponse = await fetch(`${server.httpUrl}/api/schemas/customer`, {
      method: 'DELETE'
    });
    expect(schemaDeleteResponse.status).toBe(200);
  });

  test('supports filesystem listing, directory creation, file writes, and file reads', async () => {
    const server = await createTestServer();

    const createDirectoryResponse = await fetch(`${server.httpUrl}/api/fs/docs`, {
      method: 'PUT'
    });
    expect(createDirectoryResponse.status).toBe(200);

    const writeFileResponse = await fetch(`${server.httpUrl}/api/fs/docs/hello.txt`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: 'hello world'
    });
    expect(writeFileResponse.status).toBe(200);

    const listDirectoryResponse = await fetch(`${server.httpUrl}/api/fs/docs`);
    await expect(listDirectoryResponse.json()).resolves.toEqual({
      entries: [{ name: 'hello.txt', isDirectory: false }]
    });

    const readFileResponse = await fetch(`${server.httpUrl}/api/fs/docs/hello.txt`);
    expect(readFileResponse.status).toBe(200);
    await expect(readFileResponse.text()).resolves.toBe('hello world');
  });

  test('leaves AI routes unmounted when no API key is configured', async () => {
    const server = await createTestServer();

    const response = await fetch(`${server.httpUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false
      })
    });

    expect(response.status).toBe(404);
  });

  test('serves AI requests through the composed adapter when enabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://openrouter.ai/api/v1/chat/completions') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'resp_1',
              choices: [{ message: { role: 'assistant', content: 'ok' } }]
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
        );
      }

      return originalFetch(input, init);
    });

    const server = await createTestServer({
      openrouterApiKey: 'test-key',
      openrouterModel: 'openai/test-model'
    });

    const response = await fetch(`${server.httpUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
        stream: false
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 'resp_1'
    });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
