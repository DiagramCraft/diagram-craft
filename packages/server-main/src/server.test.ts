import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { parseArgs } from './config';
import { startServer, type RunningServer } from './server';

const webSocketPolyfill = WebSocket as unknown as typeof globalThis.WebSocket;

const waitFor = async (predicate: () => boolean, timeoutMs = 5000) => {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }

    await new Promise(resolve => setTimeout(resolve, 25));
  }
};

const tempDirs: string[] = [];
const runningServers: RunningServer[] = [];

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(server => server.close()));
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

const createTestServer = async () => {
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
    fsRoot
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

  test('rejects websocket upgrades outside /ws', async () => {
    const server = await createTestServer();

    const result = await new Promise<string>(resolve => {
      const socket = new WebSocket(`${server.httpUrl.replace('http', 'ws')}/invalid`);

      socket.on('open', () => resolve('open'));
      socket.on('error', () => resolve('error'));
      socket.on('close', () => resolve('close'));
    });

    expect(result).not.toBe('open');
  });

  test('syncs document updates and awareness through the embedded websocket server', async () => {
    const server = await createTestServer();
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const provider1 = new WebsocketProvider(server.wsUrl, '/diagrams/demo.dcd', doc1, {
      WebSocketPolyfill: webSocketPolyfill,
      disableBc: true
    });
    const provider2 = new WebsocketProvider(server.wsUrl, '/diagrams/demo.dcd', doc2, {
      WebSocketPolyfill: webSocketPolyfill,
      disableBc: true
    });

    try {
      await Promise.all([
        new Promise<void>(resolve => provider1.once('sync', isSynced => isSynced && resolve())),
        new Promise<void>(resolve => provider2.once('sync', isSynced => isSynced && resolve()))
      ]);

      doc1.getMap('root').set('title', 'shared');

      await waitFor(() => doc2.getMap('root').get('title') === 'shared');

      provider1.awareness.setLocalStateField('user', { name: 'Alice' });

      await waitFor(() => {
        return [...provider2.awareness.getStates().values()].some(state => state.user?.name === 'Alice');
      });
    } finally {
      provider1.destroy();
      provider2.destroy();
      doc1.destroy();
      doc2.destroy();
    }
  });
});
