import type { createServer } from 'node:http';

export interface CollaborationServer {
  bind(server: ReturnType<typeof createServer>): void;
  ensureRoom(name: string): void;
  close(): Promise<void>;
}
