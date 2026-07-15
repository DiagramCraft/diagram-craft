import 'dotenv/config';
import { createServer } from 'node:http';
import { toNodeHandler } from 'h3/node';
import { createDatabase } from './db/factory';
import { createStorage } from './storage/storage';
import { YjsCollaborationServer } from './domain/collaboration/yjsCollaborationServer';
import { verifyToken } from './utils/jwt';
import { createApp } from './app';
import { SERVER_DEFAULTS } from './constants';
import { generateSvgPreview } from './domain/diagram/svgPreviewGenerator';
import { generateAccurateSvgPreview } from './domain/diagram/serverDiagramRenderer';
import { getDiagramCommentCounts } from './domain/diagram/commentCounts';
import { createLogger } from './utils/logger';
import { getEncryptionWarnings } from './utils/encryption';

const logger = createLogger('server');

const PORT = Number(process.env['PORT'] ?? SERVER_DEFAULTS.PORT);

const main = async () => {
  for (const warning of getEncryptionWarnings()) {
    logger.warn(warning);
  }

  const db = await createDatabase();
  const storage = createStorage();
  const app = createApp(db, storage);

  const autoSaveWriter = async (relPath: string, content: string) => {
    const parts = relPath.split('/');
    if (parts.length < 3) {
      logger.warn(`Unexpected room path format: ${relPath}`);
      return;
    }

    const workspaceSlug = parts[0]!;
    const projectId = parts[1]!;
    let fileId = parts.slice(2).join('/');
    if (fileId.endsWith('.json')) fileId = fileId.slice(0, -5);

    const workspace = await db.catalog.resolveWorkspaceSlug(workspaceSlug);
    if (!workspace) {
      logger.warn(`Unknown workspace slug in room path: ${workspaceSlug}`);
      return;
    }

    const node = await db.project.getAnyContentNodeById(workspace, fileId);
    if (node?.mount_id) {
      logger.warn(`Ignored collaboration save for read-only mounted node ${fileId}`);
      return;
    }

    const buf = Buffer.from(content, 'utf8');
    const updatedAt = new Date();
    await storage.write(workspace, projectId, fileId, buf);

    try {
      const parsed = JSON.parse(content);
      const commentCounts = getDiagramCommentCounts(parsed);
      const previewSvg = (await generateAccurateSvgPreview(parsed)) ?? generateSvgPreview(parsed);
      await db.project.updateContentNodeDerivedData(
        workspace,
        projectId,
        fileId,
        buf.length,
        commentCounts.commentCount,
        commentCounts.unresolvedCommentCount,
        previewSvg ?? null,
        updatedAt
      );
    } catch {
      await db.project.updateContentNodeDerivedData(
        workspace,
        projectId,
        fileId,
        buf.length,
        0,
        0,
        null,
        updatedAt
      );
    }
  };

  const wsAuthenticator = async (request: import('node:http').IncomingMessage) => {
    const cookieHeader = request.headers.cookie ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)ar_access_token=([^;]*)/);
    const token = match?.[1];
    if (!token) return false;

    try {
      const payload = verifyToken(token);
      if (payload.type !== 'access') return false;
      const user = await db.auth.getUser(payload.sub);
      return !!user?.is_active;
    } catch {
      return false;
    }
  };

  const collaborationServer = new YjsCollaborationServer(
    '/ws',
    autoSaveWriter,
    name => name,
    wsAuthenticator
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
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

main().catch(error => {
  logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
