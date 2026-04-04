import type { createServer } from 'node:http';

export interface CollaborationServer {
  bind(server: ReturnType<typeof createServer>): void;
  close(): Promise<void>;
}
