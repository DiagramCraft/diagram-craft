import { installBuffer } from './installBuffer';
import type { FromWorkerMessage, MessagePortLike } from './workerProtocol';

// Server code reads process.env / Buffer at import time, so shim before importing it
installBuffer();
(globalThis as Record<string, unknown>)['process'] ??= {
  env: {},
  versions: {},
  platform: 'browser'
};

const port = self as unknown as MessagePortLike & {
  postMessage(message: FromWorkerMessage): void;
};

const boot = async () => {
  const { serveRequests } = await import('./workerHandler');
  const { createLocalServer } = await import('./serverEntry');
  const server = await createLocalServer();
  serveRequests(port, server.fetch);
  port.postMessage({ type: 'ready' });
};

void boot();
