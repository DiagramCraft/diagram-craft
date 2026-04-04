import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
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

export const createYjsWebSocketServer = (basePath = YJS_WEBSOCKET_PATH) => {
  const webSocketServer = new WebSocketServer({ noServer: true });

  webSocketServer.on('connection', (connection: WebSocket, request: IncomingMessage) => {
    setupYjsWebSocketConnection(connection, request, getDocName(request.url ?? basePath, basePath));
  });

  return {
    webSocketServer,
    handleUpgrade: (request: IncomingMessage, socket: Socket, head: Buffer) => {
      if (!matchesPath(request.url ?? '', basePath)) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return false;
      }

      webSocketServer.handleUpgrade(request, socket, head, (connection: WebSocket) => {
        webSocketServer.emit('connection', connection, request);
      });

      return true;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        webSocketServer.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
};
