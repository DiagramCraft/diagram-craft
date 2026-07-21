import { readConfig } from './config.js';
import { createServer } from './server.js';

const config = readConfig();
const server = createServer(config);

server.listen(config.port, config.host, () => {
  console.log(
    `Arch Register external integration listening on http://${config.host}:${config.port}`
  );
});
