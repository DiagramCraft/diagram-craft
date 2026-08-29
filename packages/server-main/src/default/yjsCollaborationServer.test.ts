import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { YJSRoot } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { YJSWebSocketCollaborationBackend } from '@diagram-craft/collaboration/yjs/yjsWebsocketCollaborationBackend';
import type { RunningServer } from '../server';
import { startServer } from '../server';

const runningServers: RunningServer[] = [];
const providers: WebsocketProvider[] = [];
const backends: YJSWebSocketCollaborationBackend[] = [];
const documents: Y.Doc[] = [];
const tempDirs: string[] = [];

const waitForStatus = (provider: WebsocketProvider, expected: 'connected' | 'disconnected') =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      provider.off('status', onStatus);
      reject(new Error(`Timed out waiting for provider status '${expected}'`));
    }, 5000);

    const onStatus = (event: { status: 'connected' | 'disconnected' | 'connecting' }) => {
      if (event.status !== expected) return;
      clearTimeout(timeout);
      provider.off('status', onStatus);
      resolve();
    };

    provider.on('status', onStatus);
  });

const waitForSync = (provider: WebsocketProvider) =>
  new Promise<void>((resolve, reject) => {
    if (provider.synced) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      provider.off('sync', onSync);
      reject(new Error('Timed out waiting for provider sync'));
    }, 5000);

    const onSync = (synced: boolean) => {
      if (!synced) return;
      clearTimeout(timeout);
      provider.off('sync', onSync);
      resolve();
    };

    provider.on('sync', onSync);
  });

afterEach(async () => {
  for (const backend of backends.splice(0)) {
    backend.disconnect();
  }
  for (const provider of providers.splice(0)) {
    provider.destroy();
  }
  for (const document of documents.splice(0)) {
    document.destroy();
  }
  await Promise.all(runningServers.splice(0).map(server => server.close()));
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Yjs collaboration server', () => {
  it('syncs, reconnects, and preserves room state with the browser client backend', async () => {
    vi.stubGlobal('WebSocket', WebSocket);

    const tempDir = await mkdtemp(join(tmpdir(), 'diagram-craft-yjs-'));
    tempDirs.push(tempDir);
    const server = await startServer({
      host: '127.0.0.1',
      port: 0,
      dataDir: tempDir,
      fsRoot: tempDir,
      collaboration: true
    });
    runningServers.push(server);

    const roomName = 'dependency-upgrade-room';
    const backend = new YJSWebSocketCollaborationBackend(server.wsUrl);
    backends.push(backend);
    const browserDocument = new Y.Doc();
    documents.push(browserDocument);
    const browserRoot = new YJSRoot(browserDocument);
    const progress = vi.fn();

    await backend.connect(roomName, browserRoot, { name: 'Alice', color: '#2563eb' }, progress);

    expect(progress).toHaveBeenNthCalledWith(1, 'pending', {
      message: 'Connecting',
      completion: 0
    });
    expect(progress).toHaveBeenNthCalledWith(2, 'pending', {
      message: 'Syncing',
      completion: 50
    });
    expect(progress).toHaveBeenNthCalledWith(3, 'complete', {
      message: 'Connected',
      completion: 100
    });

    const serverDocument = new Y.Doc();
    documents.push(serverDocument);
    const provider = new WebsocketProvider(server.wsUrl, roomName, serverDocument, {
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
      disableBc: true,
      maxBackoffTime: 25
    });
    providers.push(provider);
    await waitForSync(provider);

    browserRoot.yDoc.getMap('data').set('value', 'before-reconnect');
    await vi.waitFor(() => {
      expect(serverDocument.getMap('data').get('value')).toBe('before-reconnect');
    });

    backend.awareness.updateUser({ name: 'Alice', color: '#2563eb' });
    await vi.waitFor(() => {
      const users = Array.from(provider.awareness.getStates().values()).map(
        state => state?.user?.name
      );
      expect(users).toContain('Alice');
    });

    const disconnected = waitForStatus(provider, 'disconnected');
    const reconnected = waitForStatus(provider, 'connected');
    const socket = (provider as unknown as { ws: { close: () => void } | null }).ws;
    socket?.close();
    await disconnected;
    await reconnected;

    const recoveredDocument = new Y.Doc();
    documents.push(recoveredDocument);
    const recoveredProvider = new WebsocketProvider(server.wsUrl, roomName, recoveredDocument, {
      WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
      disableBc: true,
      maxBackoffTime: 25
    });
    providers.push(recoveredProvider);
    await waitForSync(recoveredProvider);

    expect(recoveredDocument.getMap('data').get('value')).toBe('before-reconnect');

    browserRoot.yDoc.getMap('data').set('value', 'after-reconnect');
    await vi.waitFor(() => {
      expect(serverDocument.getMap('data').get('value')).toBe('after-reconnect');
      expect(recoveredDocument.getMap('data').get('value')).toBe('after-reconnect');
    });
  });
});
