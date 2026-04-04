import type { IncomingMessage } from 'node:http';
import type { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import type { CollaborationServer } from './serverInterfaces';
import { setupYjsWebSocketConnection } from './yjsWebsocketServer';

export const YJS_WEBSOCKET_PATH = '/ws';

const getDocName = (requestUrl: string, basePath: string) => {
  const pathname = new URL(requestUrl, 'http://localhost').pathname;

  if (pathname === basePath) {
    return '';
  }

  return pathname.slice(basePath.length + 1);
};

const matchesPath = (requestUrl: string, basePath: string) => {
  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
};

export class YjsCollaborationServer implements CollaborationServer {
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private boundServer?: ReturnType<typeof createServer>;
  private readonly upgradeHandler: (
    request: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => void;

  constructor(private readonly basePath = YJS_WEBSOCKET_PATH) {
    this.webSocketServer.on('connection', (connection: WebSocket, request: IncomingMessage) => {
      setupYjsWebSocketConnection(
        connection,
        request,
        getDocName(request.url ?? this.basePath, this.basePath)
      );
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

  close() {
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
