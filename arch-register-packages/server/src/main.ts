import { createServer } from 'node:http';
import { createApp, defineEventHandler, handleCors, toNodeListener } from 'h3';
import { createDataRoutes } from './routes/data.js';
import { createSchemaRoutes } from './routes/schemas.js';

const app = createApp();

// CORS middleware
app.use(
  defineEventHandler(event => {
    const didHandleCors = handleCors(event, {
      origin: '*',
      preflight: { statusCode: 204 },
      methods: '*'
    });
    if (didHandleCors) return;
  })
);

// Health check
app.use('/hello', defineEventHandler(() => ({ msg: 'Hello' })));

// API routes
app.use(createSchemaRoutes());
app.use(createDataRoutes());

const server = createServer(toNodeListener(app));
const PORT = Number(process.env['PORT'] ?? 3000);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
