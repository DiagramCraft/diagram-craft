import 'dotenv/config';
import { createServer } from 'node:http';
import { toNodeHandler } from 'h3/node';
import { createDatabase } from './db/factory';
import { createStorage } from './storage/storage';
import { YjsCollaborationServer } from './domain/collaboration/yjsCollaborationServer';
import { createApp } from './app';
import { SERVER_DEFAULTS } from './constants';
import { createLogger } from './utils/logger';
import { getEncryptionWarnings } from './utils/encryption';
import { createAutoSaveWriter } from './domain/collaboration/autoSaveWriter';
import { createRoomAuthorizer } from './domain/collaboration/roomAuthorizer';

const logger = createLogger('server');

const PORT = Number(process.env['PORT'] ?? SERVER_DEFAULTS.PORT);

const main = async () => {
  for (const warning of getEncryptionWarnings()) {
    logger.warn(warning);
  }

  const db = await createDatabase();
  const storage = createStorage();
  const app = createApp(db, storage);

  const autoSaveWriter = createAutoSaveWriter(db, storage);
  const roomAuthorizer = createRoomAuthorizer(db);

  const collaborationServer = new YjsCollaborationServer(
    '/ws',
    autoSaveWriter,
    name => name,
    roomAuthorizer
  );
  const server = createServer(toNodeHandler(app));
  collaborationServer.bind(server);

  // node --watch can respawn before the OS releases the previous instance's port; retry briefly.
  let listenRetriesLeft = 10;

  server.on('listening', () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
    logger.info(`WebSocket collaboration listening on ws://localhost:${PORT}/ws`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && listenRetriesLeft > 0) {
      listenRetriesLeft--;
      logger.warn(`Port ${PORT} still in use, retrying in 300ms...`);
      setTimeout(() => server.listen(PORT), 300);
      return;
    }
    throw error;
  });

  server.listen(PORT);

  const shutdown = async () => {
    logger.info('Shutting down...');
    await collaborationServer.close();
    await db.core.close();
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

main().catch(error => {
  logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
