import { installBuffer } from './installBuffer';
import type { FromWorkerMessage, MessagePortLike, ToWorkerMessage } from './workerProtocol';

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
  const { createSnapshotPersister } = await import('./snapshotPersister');
  const { clearSnapshot, currentSnapshotVersion, saveSnapshot } = await import('./snapshotStore');
  const server = await createLocalServer();

  const persister = createSnapshotPersister({
    sources: [server.db, server.storage],
    save: async () => {
      const db = server.db.exportSnapshot();
      if (!db) return;
      await saveSnapshot({
        version: currentSnapshotVersion(),
        savedAt: Date.now(),
        db,
        files: server.storage.exportSnapshot()
      });
    }
  });

  serveRequests(port, server.fetch, persister.notify);

  port.addEventListener('message', e => {
    const msg = (e as MessageEvent<ToWorkerMessage>).data;
    if (msg.type === 'flush') {
      void persister.flush();
    } else if (msg.type === 'reset') {
      persister.disable();
      void clearSnapshot().then(() => port.postMessage({ type: 'reset-done' }));
    }
  });

  port.postMessage({ type: 'ready' });
};

void boot();
