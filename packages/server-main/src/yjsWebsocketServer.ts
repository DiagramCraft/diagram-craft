import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as Y from 'yjs';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const messageSync = 0;
const messageAwareness = 1;
const pingTimeout = 30000;

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

const getYDoc = (docName: string) => {
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
    console.error(error);
  }
};

export const setupYjsWebSocketConnection = (
  conn: WebSocket,
  _req: IncomingMessage,
  docName: string
) => {
  conn.binaryType = 'arraybuffer';
  const doc = getYDoc(docName);
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
