import 'dotenv/config';
import { createServer } from 'node:http';
import { toNodeListener } from 'h3/node';
import { createDatabase } from './db/factory.js';
import { createStorage } from './storage/storage.js';
import { YjsCollaborationServer } from './collaboration/yjsCollaborationServer.js';
import { OpenRouterAIServer } from './ai/openRouterAiServer.js';
import { createAIRoutes } from './routes/ai.js';
import { createApp } from './app.js';
const PORT = Number(process.env['PORT'] ?? 3010);

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
    await storage.write(workspace, projectId, fileId, buf);
    await db.updateProjectFileSizeById(workspace, projectId, fileId, buf.length, new Date());
  };

  const collaborationServer = new YjsCollaborationServer('/ws', autoSaveWriter, name => name);

  const openrouterApiKey = process.env['OPENROUTER_API_KEY'];
  if (openrouterApiKey) {
    const aiServer = new OpenRouterAIServer({
      apiKey: openrouterApiKey,
      defaultModel: process.env['OPENROUTER_MODEL'],
      appName: 'ArchRegister'
    });
    app.use(createAIRoutes(aiServer));
    console.log('AI routes enabled (OpenRouter)');
  } else {
    console.log('AI routes disabled (set OPENROUTER_API_KEY to enable)');
  }

  const server = createServer(toNodeListener(app));
  collaborationServer.bind(server);

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`WebSocket collaboration listening on ws://localhost:${PORT}/ws`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    await collaborationServer.close();
    await db.close();
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
