import { createServer } from 'node:http';
import { createApp, defineEventHandler, toNodeListener } from 'h3';

const app = createApp();

app.use(
  '/hello',
  defineEventHandler(() => {
    return { msg: 'Hello' };
  })
);

const server = createServer(toNodeListener(app));

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
