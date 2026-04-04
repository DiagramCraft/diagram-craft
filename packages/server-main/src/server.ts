import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toNodeListener } from 'h3';
import { createServerApp } from './app';
import type { ServerMainConfig } from './config';
import { YJS_WEBSOCKET_PATH } from './default/yjsCollaborationServer';
import { createServerModules } from './serverFactory';

export type RunningServer = {
  server: ReturnType<typeof createServer>;
  close: () => Promise<void>;
  httpUrl: string;
  wsUrl: string;
};

const getUrlHost = (host: string) => {
  return host === '0.0.0.0' ? 'localhost' : host;
};

export const startServer = async (config: ServerMainConfig): Promise<RunningServer> => {
  const serverModules = createServerModules(config);
  const app = createServerApp(serverModules);
  const nodeListener = toNodeListener(app);
  const server = createServer(nodeListener);
  serverModules.collaborationServer.bind(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve server address');
  }

  const urlHost = getUrlHost(config.host);
  const effectivePort = (address as AddressInfo).port;
  const httpUrl = `http://${urlHost}:${effectivePort}`;
  const wsUrl = `ws://${urlHost}:${effectivePort}${YJS_WEBSOCKET_PATH}`;

  console.log(`REST server listening at ${httpUrl}`);
  console.log(`Yjs websocket listening at ${wsUrl}`);

  return {
    server,
    httpUrl,
    wsUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      await serverModules.collaborationServer.close();
    }
  };
};
