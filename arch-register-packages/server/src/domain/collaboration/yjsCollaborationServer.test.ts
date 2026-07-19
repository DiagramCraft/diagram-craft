import { createServer, type Server } from 'node:http';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { YjsCollaborationServer } from './yjsCollaborationServer';
import type { RoomGrant } from './roomAuthorizer';

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

const grant = (readOnly = false): RoomGrant => ({
  userId: readOnly ? 'read-only-user' : 'editor-user',
  workspace: 'workspace-1',
  storageScope: 'project-1',
  fileId: 'file-1',
  readOnly,
  tokenExpiresAt: Math.floor(Date.now() / 1000) + 3600
});

const openServer = async (collaboration: YjsCollaborationServer) => {
  const server = createServer();
  collaboration.bind(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return { server, url: `ws://127.0.0.1:${port}/ws` };
};

const closeServer = async (server: Server, collaboration: YjsCollaborationServer) => {
  await collaboration.close();
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
};

const openSocket = (url: string, cookie = 'editor'): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: { Cookie: cookie } });
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });

const upgradeStatus = (url: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('unexpected-response', (_request, response) => {
      resolve(response.statusCode ?? 0);
      socket.close();
    });
    socket.once('error', error => reject(error));
  });

const writeSyncStep1 = (doc: Y.Doc) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
};

const writeUpdate = (update: Uint8Array) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
};

const processServerMessage = (socket: WebSocket, doc: Y.Doc, data: Buffer) => {
  const decoder = decoding.createDecoder(new Uint8Array(data));
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);
  if (messageType !== 0) return;

  encoding.writeVarUint(encoder, 0);
  syncProtocol.readSyncMessage(decoder, encoder, doc, socket);
  if (encoding.length(encoder) > 1) socket.send(encoding.toUint8Array(encoder));
};

describe('YjsCollaborationServer authorization and read-only behavior', () => {
  const resources: Array<{ server: Server; collaboration: YjsCollaborationServer }> = [];

  afterEach(async () => {
    await Promise.all(
      resources.splice(0).map(({ server, collaboration }) => closeServer(server, collaboration))
    );
  });

  it('rejects a room before the WebSocket upgrade when authorization denies it', async () => {
    const collaboration = new YjsCollaborationServer('/ws', undefined, undefined, async () => ({
      status: 403
    }));
    const opened = await openServer(collaboration);
    resources.push({ ...opened, collaboration });

    await expect(upgradeStatus(`${opened.url}/workspace-1/project-1/file-1.json`)).resolves.toBe(
      403
    );
  });

  it('allows initial sync but drops updates from read-only connections', async () => {
    const collaboration = new YjsCollaborationServer(
      '/ws',
      undefined,
      undefined,
      async request => ({ grant: grant(request.headers.cookie === 'read-only') })
    );
    const opened = await openServer(collaboration);
    resources.push({ ...opened, collaboration });

    const editor = await openSocket(`${opened.url}/workspace-1/project-1/file-1.json`);
    const seed = new Y.Doc();
    seed.getMap('state').set('allowed', true);
    editor.send(writeUpdate(Y.encodeStateAsUpdate(seed)));

    const readOnly = await openSocket(
      `${opened.url}/workspace-1/project-1/file-1.json`,
      'read-only'
    );
    const readOnlyDoc = new Y.Doc();
    readOnly.on('message', data =>
      processServerMessage(readOnly, readOnlyDoc, Buffer.from(data as Buffer))
    );
    readOnly.send(writeSyncStep1(readOnlyDoc));

    await viWaitFor(() => readOnlyDoc.getMap('state').get('allowed') === true);

    readOnlyDoc.getMap('state').set('rogue', true);
    readOnly.send(writeUpdate(Y.encodeStateAsUpdate(readOnlyDoc)));

    const observer = await openSocket(`${opened.url}/workspace-1/project-1/file-1.json`);
    const observerDoc = new Y.Doc();
    observer.on('message', data =>
      processServerMessage(observer, observerDoc, Buffer.from(data as Buffer))
    );
    observer.send(writeSyncStep1(observerDoc));

    await viWaitFor(() => observerDoc.getMap('state').get('allowed') === true);
    expect(observerDoc.getMap('state').get('rogue')).toBeUndefined();

    editor.close();
    readOnly.close();
    observer.close();
  });
});

const viWaitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for Yjs state');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
