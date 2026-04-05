import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as Y from 'yjs';
import type { IncomingMessage } from 'node:http';
import type { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import type { CollaborationServer } from '../collaborationServer';
import { DiagramAutoSave, type AutoSaveWriter } from './diagramAutoSave';
import { createLogger } from '../logger';

const log = createLogger('YjsCollaborationServer');

export const YJS_WEBSOCKET_PATH = '/ws';
const FILESYSTEM_API_PATH_PREFIX = '/api/fs/';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const messageSync = 0;
const messageAwareness = 1;
const pingTimeout = 30000;

const getDocName = (requestUrl: string, basePath: string) => {
  const pathname = new URL(requestUrl, 'http://localhost').pathname;

  if (pathname === basePath) {
    return '';
  }

  return normalizeDocName(pathname.slice(basePath.length + 1));
};

const matchesPath = (requestUrl: string, basePath: string) => {
  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
};

const normalizeDocName = (name: string) => {
  const withoutLeadingSlash = name.startsWith('/') ? name.slice(1) : name;
  return withoutLeadingSlash.startsWith(FILESYSTEM_API_PATH_PREFIX.slice(1))
    ? withoutLeadingSlash.slice(FILESYSTEM_API_PATH_PREFIX.length - 1)
    : withoutLeadingSlash;
};

class WSSharedDoc extends Y.Doc {
  readonly conns = new Map<WebSocket, Set<number>>();
  readonly awareness = new awarenessProtocol.Awareness(this);

  constructor(readonly name: string) {
    super({ gc: true });

    this.awareness.setLocalState(null);
    this.awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        connection: WebSocket | null
      ) => {
        const changedClients = added.concat(updated, removed);

        if (connection !== null) {
          const controlledIds = this.conns.get(connection);
          if (controlledIds) {
            added.forEach((clientId: number) => controlledIds.add(clientId));
            removed.forEach((clientId: number) => controlledIds.delete(clientId));
          }
        }

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        );

        const message = encoding.toUint8Array(encoder);
        this.conns.forEach((_ids, conn) => send(this, conn, message));
      }
    );

    this.on('update', (update, _origin, doc) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      (doc as WSSharedDoc).conns.forEach((_ids, conn) => send(doc as WSSharedDoc, conn, message));
    });
  }
}

const docs = new Map<string, WSSharedDoc>();
const autoSaves = new Map<string, DiagramAutoSave>();

const getOrCreateYDoc = (docName: string) => {
  const existing = docs.get(docName);
  if (existing) {
    return existing;
  }

  const doc = new WSSharedDoc(docName);
  docs.set(docName, doc);
  return doc;
};

const closeConn = (doc: WSSharedDoc, conn: WebSocket) => {
  const controlledIds = doc.conns.get(conn);
  doc.conns.delete(conn);

  if (controlledIds) {
    awarenessProtocol.removeAwarenessStates(doc.awareness, [...controlledIds], null);
  }

  if (doc.conns.size === 0) {
    docs.delete(doc.name);
    doc.destroy();
    autoSaves.get(doc.name)?.dispose();
    autoSaves.delete(doc.name);
  }

  conn.close();
};

const send = (doc: WSSharedDoc, conn: WebSocket, message: Uint8Array) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn);
    return;
  }

  try {
    conn.send(message, {}, (error?: Error) => {
      if (error) {
        closeConn(doc, conn);
      }
    });
  } catch {
    closeConn(doc, conn);
  }
};

const messageListener = (conn: WebSocket, doc: WSSharedDoc, message: Uint8Array) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn
        );
        break;
    }
  } catch (error) {
    log.error('Message handling failed', error);
  }
};

const setupYjsWebSocketConnection = (conn: WebSocket, docName: string) => {
  conn.binaryType = 'arraybuffer';
  const doc = getOrCreateYDoc(docName);
  log.debug(`WebSocket connected: docName=${docName} hasAutoSave=${autoSaves.has(docName)}`);
  doc.conns.set(conn, new Set());

  conn.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
    const raw =
      message instanceof Buffer ? message : Array.isArray(message) ? Buffer.concat(message) : message;
    const data = new Uint8Array(raw);
    messageListener(conn, doc, data);
  });

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
      }
      clearInterval(pingInterval);
      return;
    }

    if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch {
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, pingTimeout);

  conn.on('close', () => {
    clearInterval(pingInterval);
    if (doc.conns.has(conn)) {
      closeConn(doc, conn);
    }
  });

  conn.on('pong', () => {
    pongReceived = true;
  });

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(doc, conn, encoding.toUint8Array(encoder));

  const awarenessStates = doc.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys()))
    );
    send(doc, conn, encoding.toUint8Array(awarenessEncoder));
  }
};

export class YjsCollaborationServer implements CollaborationServer {
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private boundServer?: ReturnType<typeof createServer>;
  private readonly upgradeHandler: (
    request: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => void;

  constructor(
    private readonly basePath = YJS_WEBSOCKET_PATH,
    private readonly autoSaveWriter?: AutoSaveWriter
  ) {
    this.webSocketServer.on('connection', (connection: WebSocket, request: IncomingMessage) => {
      const docName = getDocName(request.url ?? this.basePath, this.basePath);
      setupYjsWebSocketConnection(connection, docName);

      if (!autoSaves.has(docName) && this.autoSaveWriter && docName.endsWith('.json')) {
        const doc = docs.get(docName);
        if (doc) {
          log.debug(`Setting up auto-save on WebSocket connect: ${docName}`);
          autoSaves.set(docName, new DiagramAutoSave(doc, docName, this.autoSaveWriter));
        }
      }
    });

    this.upgradeHandler = (request, socket, head) => {
      if (!matchesPath(request.url ?? '', this.basePath)) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (connection: WebSocket) => {
        this.webSocketServer.emit('connection', connection, request);
      });
    };
  }

  bind(server: ReturnType<typeof createServer>) {
    if (this.boundServer === server) {
      return;
    }

    if (this.boundServer) {
      this.boundServer.off('upgrade', this.upgradeHandler);
    }

    this.boundServer = server;
    server.on('upgrade', this.upgradeHandler);
  }

  ensureRoom(name: string) {
    const normalized = normalizeDocName(name);
    const doc = getOrCreateYDoc(normalized);
    log.debug(`ensureRoom: name=${name} normalized=${normalized} hasWriter=${!!this.autoSaveWriter} hasAutoSave=${autoSaves.has(normalized)}`);

    if (!autoSaves.has(normalized) && this.autoSaveWriter && normalized.endsWith('.json')) {
      log.debug(`Setting up auto-save for room: ${normalized}`);
      autoSaves.set(normalized, new DiagramAutoSave(doc, normalized, this.autoSaveWriter));
    }
  }

  close() {
    for (const autoSave of autoSaves.values()) {
      autoSave.dispose();
    }
    autoSaves.clear();

    if (this.boundServer) {
      this.boundServer.off('upgrade', this.upgradeHandler);
      this.boundServer = undefined;
    }

    return new Promise<void>((resolve, reject) => {
      this.webSocketServer.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}
