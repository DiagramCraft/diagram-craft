import 'dotenv/config';
import { createServer } from 'node:http';
import { toNodeListener } from 'h3/node';
import { createDatabase } from './db/factory.js';
import { createStorage } from './storage/storage.js';
import { YjsCollaborationServer } from './collaboration/yjsCollaborationServer.js';
import { verifyToken } from './utils/jwt.js';
import { createAIRoutes } from './routes/ai.js';
import { createApp } from './app.js';
import { SERVER_DEFAULTS } from './constants.js';
import { generateSvgPreview } from './preview/svgPreviewGenerator.js';
import { getDiagramCommentCounts } from './diagrams/commentCounts.js';

const PORT = Number(process.env['PORT'] ?? SERVER_DEFAULTS.PORT);

const main = async () => {
  const db = await createDatabase();
  const storage = createStorage();
  const app = createApp(db, storage);

  const autoSaveWriter = async (relPath: string, content: string) => {
    const parts = relPath.split('/');
    if (parts.length < 3) {
      console.warn(`[AutoSave] Unexpected room path format: ${relPath}`);
      return;
    }

    const workspace = parts[0]!;
    const projectId = parts[1]!;
    let fileId = parts.slice(2).join('/');
    if (fileId.endsWith('.json')) fileId = fileId.slice(0, -5);

    const buf = Buffer.from(content, 'utf8');
    const updatedAt = new Date();
    await storage.write(workspace, projectId, fileId, buf);

    try {
      const parsed = JSON.parse(content);
      const commentCounts = getDiagramCommentCounts(parsed);
      const previewSvg = generateSvgPreview(parsed);
      await db.projectsFiles.updateProjectFileDerivedData(
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
      await db.projectsFiles.updateProjectFileDerivedData(
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
      const user = await db.identityAuth.getUser(payload.sub);
      return !!user?.is_active;
    } catch {
      return false;
    }
  };

  const collaborationServer = new YjsCollaborationServer('/ws', autoSaveWriter, name => name, wsAuthenticator);

  app.use(createAIRoutes(db));
  console.log('AI routes enabled');

  const server = createServer(toNodeListener(app));
  collaborationServer.bind(server);

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`WebSocket collaboration listening on ws://localhost:${PORT}/ws`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    await collaborationServer.close();
    await db.core.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
