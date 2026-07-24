import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as Y from 'yjs';
import type { IncomingMessage } from 'node:http';
import type { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import type { CollaborationServer } from './collaborationServer';
import { DiagramAutoSave, type AutoSaveWriter } from './diagramAutoSave';
import { createLogger } from '../../utils/logger';
import type { RoomAuthorizationResult, RoomAuthorizer, RoomGrant } from './roomAuthorizer';

export type TempPathResolver = (name: string) => string;

const log = createLogger('YjsCollaborationServer');

export const YJS_WEBSOCKET_PATH = '/ws';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const messageSync = 0;
const messageAwareness = 1;
const syncStep1 = 0;
const syncStep2 = 1;
const syncUpdate = 2;
const pingTimeout = 30000;

const normalizeDocName = (name: string) => {
  return name.startsWith('/') ? name.slice(1) : name;
};

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

class WSSharedDoc extends Y.Doc {
  readonly conns = new Map<WebSocket, { controlledIds: Set<number>; grant: RoomGrant }>();
  readonly awareness = new awarenessProtocol.Awareness(this);

  constructor(
    readonly name: string,
    private readonly sendCallback: (doc: WSSharedDoc, conn: WebSocket, message: Uint8Array) => void
  ) {
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
          const state = this.conns.get(connection);
          if (state) {
            added.forEach((clientId: number) => state.controlledIds.add(clientId));
            removed.forEach((clientId: number) => state.controlledIds.delete(clientId));
          }
        }

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        );

        const message = encoding.toUint8Array(encoder);
        this.conns.forEach((_state, conn) => this.sendCallback(this, conn, message));
      }
    );

    this.on('update', (update, _origin, _doc) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      this.conns.forEach((_state, conn) => this.sendCallback(this, conn, message));
    });
  }
}

export class YjsCollaborationServer implements CollaborationServer {
  private readonly docs = new Map<string, WSSharedDoc>();
  private readonly autoSaves = new Map<string, DiagramAutoSave>();
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private boundServer?: ReturnType<typeof createServer>;
  private readonly upgradeHandler: (request: IncomingMessage, socket: Socket, head: Buffer) => void;

  constructor(
    private readonly basePath = YJS_WEBSOCKET_PATH,
    private readonly autoSaveWriter?: AutoSaveWriter,
    private readonly tempPathResolver?: TempPathResolver,
    private readonly authorizer?: RoomAuthorizer
  ) {
    this.webSocketServer.on(
      'connection',
      (connection: WebSocket, request: IncomingMessage, grant: RoomGrant) => {
        const docName = getDocName(request.url ?? this.basePath, this.basePath);
        this.setupYjsWebSocketConnection(connection, docName, grant);

        if (!this.autoSaves.has(docName) && this.autoSaveWriter && docName.endsWith('.json')) {
          const doc = this.docs.get(docName);
          if (doc) {
            const tempPath = this.tempPathResolver?.(docName) ?? docName;
            log.debug(`Setting up auto-save on WebSocket connect: ${docName}`);
            this.autoSaves.set(
              docName,
              new DiagramAutoSave(doc, docName, tempPath, this.autoSaveWriter)
            );
          }
        }
      }
    );

    this.upgradeHandler = async (request, socket, head) => {
      if (!matchesPath(request.url ?? '', this.basePath)) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      let authorization: RoomAuthorizationResult;
      try {
        const docName = getDocName(request.url ?? this.basePath, this.basePath);
        authorization = this.authorizer ? await this.authorizer(request, docName) : { status: 403 };
      } catch (error) {
        log.error(`Room authorization failed for ${request.url ?? this.basePath}`, error);
        authorization = { status: 403 };
      }

      if ('status' in authorization) {
        const statusText = authorization.status === 401 ? 'Unauthorized' : 'Forbidden';
        socket.write(`HTTP/1.1 ${authorization.status} ${statusText}\r\n\r\n`);
        socket.destroy();
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (connection: WebSocket) => {
        this.webSocketServer.emit('connection', connection, request, authorization.grant);
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
    const doc = this.getOrCreateYDoc(normalized);
    log.debug(
      `ensureRoom: name=${name} normalized=${normalized} hasWriter=${!!this.autoSaveWriter} hasAutoSave=${this.autoSaves.has(normalized)}`
    );

    if (!this.autoSaves.has(normalized) && this.autoSaveWriter && normalized.endsWith('.json')) {
      const tempPath = this.tempPathResolver?.(normalized) ?? normalized;
      log.debug(`Setting up auto-save for room: ${normalized}`);
      this.autoSaves.set(
        normalized,
        new DiagramAutoSave(doc, normalized, tempPath, this.autoSaveWriter)
      );
    }
  }

  close() {
    const flushes: Promise<void>[] = [];
    for (const [docName, autoSave] of this.autoSaves.entries()) {
      flushes.push(
        autoSave.flushPrimaryIfDirty('dispose').catch(error => {
          log.error(`Failed to flush auto-save on shutdown: ${docName}`, error);
        })
      );
      autoSave.dispose();
    }
    this.autoSaves.clear();

    if (this.boundServer) {
      this.boundServer.off('upgrade', this.upgradeHandler);
      this.boundServer = undefined;
    }

    return Promise.all(flushes).then(
      () =>
        new Promise<void>((resolve, reject) => {
          this.webSocketServer.close((error?: Error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        })
    );
  }

  private getOrCreateYDoc(docName: string): WSSharedDoc {
    const existing = this.docs.get(docName);
    if (existing) {
      return existing;
    }

    const doc = new WSSharedDoc(docName, (doc, conn, msg) => this.send(doc, conn, msg));
    this.docs.set(docName, doc);
    return doc;
  }

  private flushAutoSave(
    docName: string,
    reason: 'room-enter' | 'room-leave' | 'dispose'
  ): Promise<void> {
    const autoSave = this.autoSaves.get(docName);
    return autoSave?.flushPrimaryIfDirty(reason) ?? Promise.resolve();
  }

  private closeConn(doc: WSSharedDoc, conn: WebSocket, code?: number, reason?: string): void {
    const controlledIds = doc.conns.get(conn);
    doc.conns.delete(conn);

    if (controlledIds) {
      awarenessProtocol.removeAwarenessStates(
        doc.awareness,
        [...controlledIds.controlledIds],
        null
      );
    }

    this.flushAutoSave(doc.name, 'room-leave').catch(error => {
      log.error(`Failed to flush auto-save on room leave: ${doc.name}`, error);
    });

    if (doc.conns.size === 0) {
      this.docs.delete(doc.name);
      doc.destroy();
      this.autoSaves.get(doc.name)?.dispose();
      this.autoSaves.delete(doc.name);
    }

    conn.close(code, reason);
  }

  private send(doc: WSSharedDoc, conn: WebSocket, message: Uint8Array): void {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
      this.closeConn(doc, conn);
      return;
    }

    try {
      conn.send(message, {}, (error?: Error) => {
        if (error) {
          this.closeConn(doc, conn);
        }
      });
    } catch {
      this.closeConn(doc, conn);
    }
  }

  private messageListener(conn: WebSocket, doc: WSSharedDoc, message: Uint8Array): void {
    try {
      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync:
          {
            const syncType = decoding.readVarUint(decoder);
            const grant = doc.conns.get(conn)?.grant;
            if (grant?.readOnly && (syncType === syncStep2 || syncType === syncUpdate)) {
              log.warn(
                `Dropped write from read-only collaboration room: docName=${doc.name} userId=${grant.userId}`
              );
              return;
            }

            encoding.writeVarUint(encoder, messageSync);
            switch (syncType) {
              case syncStep1:
                syncProtocol.readSyncStep1(decoder, encoder, doc);
                break;
              case syncStep2:
                syncProtocol.readSyncStep2(decoder, doc, conn);
                break;
              case syncUpdate:
                syncProtocol.readUpdate(decoder, doc, conn);
                break;
              default:
                throw new Error(`Unknown Yjs sync message type: ${syncType}`);
            }
            if (encoding.length(encoder) > 1) {
              this.send(doc, conn, encoding.toUint8Array(encoder));
            }
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
  }

  private setupYjsWebSocketConnection(conn: WebSocket, docName: string, grant: RoomGrant): void {
    conn.binaryType = 'arraybuffer';
    const doc = this.getOrCreateYDoc(docName);
    log.debug(`WebSocket connected: docName=${docName} hasAutoSave=${this.autoSaves.has(docName)}`);
    doc.conns.set(conn, { controlledIds: new Set(), grant });
    this.flushAutoSave(docName, 'room-enter').catch(error => {
      log.error(`Failed to flush auto-save on room enter: ${docName}`, error);
    });

    conn.on('message', (message: Buffer | ArrayBuffer | Buffer[]) => {
      const raw =
        message instanceof Buffer
          ? message
          : Array.isArray(message)
            ? Buffer.concat(message)
            : message;
      const data = new Uint8Array(raw);
      this.messageListener(conn, doc, data);
    });

    let pongReceived = true;
    const pingInterval = setInterval(() => {
      if (!pongReceived) {
        if (doc.conns.has(conn)) {
          this.closeConn(doc, conn);
        }
        clearInterval(pingInterval);
        return;
      }

      if (doc.conns.has(conn)) {
        const connectionGrant = doc.conns.get(conn)?.grant;
        if (connectionGrant && Date.now() / 1000 >= connectionGrant.tokenExpiresAt) {
          log.info(
            `Closing expired collaboration connection: docName=${docName} userId=${connectionGrant.userId}`
          );
          this.closeConn(doc, conn, 4401, 'Access token expired');
          clearInterval(pingInterval);
          return;
        }

        pongReceived = false;
        try {
          conn.ping();
        } catch {
          this.closeConn(doc, conn);
          clearInterval(pingInterval);
        }
      }
    }, pingTimeout);

    conn.on('close', () => {
      clearInterval(pingInterval);
      if (doc.conns.has(conn)) {
        this.closeConn(doc, conn);
      }
    });

    conn.on('pong', () => {
      pongReceived = true;
    });

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    this.send(doc, conn, encoding.toUint8Array(encoder));

    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys()))
      );
      this.send(doc, conn, encoding.toUint8Array(awarenessEncoder));
    }
  }
}
